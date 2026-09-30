import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import { encryptCredential } from "@/lib/proxmox/credentials";
import { discoverProxmoxInstance } from "./multi-proxmox-engine";
import { recordProxmoxDiscoveryFailure } from "./proxmox-failure";
import type { SnapshotClient } from "./proxmox-snapshot";

function requireDisposableDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url || url !== process.env.HOIWORK_TEST_DATABASE_URL) {
    throw new Error("O teste exige HOIWORK_TEST_DATABASE_URL igual a DATABASE_URL.");
  }
  const parsed = new URL(url);
  if (
    !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
    parsed.pathname !== "/hoiwork_test"
  ) {
    throw new Error("O teste só pode usar o banco local descartável hoiwork_test.");
  }
}

function client(): SnapshotClient {
  return {
    version: async () => ({ version: "9.2" }),
    nodes: async () => [
      { node: "hoi", status: "online" },
      { node: "homeoffice", status: "online" },
    ],
    guests: async () => [
      { id: "qemu/105", type: "qemu", vmid: 105, node: "hoi", status: "running" },
    ],
    storages: async () => [],
    clusterStatus: async () => [{ type: "cluster", name: "hoi-cloud" }],
    network: async () => [{ iface: "vmbr0", type: "bridge", active: 1 }],
  };
}

async function withFixture(run: (input: {
  organizationId: string;
  instanceId: string;
  oldSync: Date;
  oldNodeId: string;
  oldStorageId: string;
}) => Promise<void>) {
  requireDisposableDatabase();
  process.env.HOIWORK_CREDENTIALS_SECRET = "ci-only-proxmox-discovery-integration";
  const organization = await prisma.organization.create({
    data: { name: "Discovery integration test", slug: `discovery-test-${randomUUID()}` },
  });

  try {
    const oldSync = new Date("2026-01-01T00:00:00Z");
    const instance = await prisma.proxmoxInstance.create({
      data: {
        organizationId: organization.id,
        slug: "endpoint",
        name: "Endpoint teste",
        baseUrl: "https://127.0.0.1:8006",
        tokenId: "test@pve!ci",
        tokenSecretEncrypted: encryptCredential("test-secret"),
        status: "HEALTHY",
        lastSyncAt: oldSync,
      },
    });
    const oldNodeId = `proxmox/${instance.id}/node/hoi`;
    const oldStorageId = `proxmox/${instance.id}/storage/hoi/old`;
    await prisma.infrastructureAsset.createMany({
      data: [
        {
          organizationId: organization.id,
          externalId: oldNodeId,
          provider: "PROXMOX",
          assetType: "NODE",
          name: "hoi",
          status: "OFFLINE",
          lastSeenAt: oldSync,
        },
        {
          organizationId: organization.id,
          externalId: oldStorageId,
          provider: "PROXMOX",
          assetType: "STORAGE",
          name: "old",
          status: "AVAILABLE",
          lastSeenAt: oldSync,
        },
      ],
    });

    await run({ organizationId: organization.id, instanceId: instance.id, oldSync, oldNodeId, oldStorageId });
  } finally {
    await prisma.organization.delete({ where: { id: organization.id } });
  }
}

test("failed collection preserves assets and last successful sync, recording ERROR", async () => {
  await withFixture(async ({ organizationId, instanceId, oldSync, oldNodeId, oldStorageId }) => {
    const startedAt = new Date();
    const source = client();
    await assert.rejects(
      discoverProxmoxInstance(
        { organizationId, instanceId },
        { createClient: () => ({
          ...source,
          network: async (node) => {
            if (node === "homeoffice") throw new Error("Proxmox API HTTP 403");
            return source.network(node);
          },
        }) },
      ),
      /HTTP 403/,
    );
    await recordProxmoxDiscoveryFailure({
      organizationId, instanceId, startedAt, message: "Proxmox API HTTP 403",
    });

    const [instance, assets] = await Promise.all([
      prisma.proxmoxInstance.findUniqueOrThrow({ where: { id: instanceId } }),
      prisma.infrastructureAsset.findMany({ where: { organizationId }, orderBy: { externalId: "asc" } }),
    ]);
    assert.equal(instance.status, "ERROR");
    assert.equal(instance.lastError, "Proxmox API HTTP 403");
    assert.equal(instance.lastSyncAt?.getTime(), oldSync.getTime());
    assert.deepEqual(assets.map((asset) => asset.externalId), [oldNodeId, oldStorageId]);
    assert.ok(assets.every((asset) => asset.active && asset.lastSeenAt.getTime() === oldSync.getTime()));
  });
});

test("complete collection atomically updates inventory and marks absent resources missing", async () => {
  await withFixture(async ({ organizationId, instanceId, oldSync, oldNodeId, oldStorageId }) => {
    const result = await discoverProxmoxInstance(
      { organizationId, instanceId },
      { createClient: client },
    );
    assert.equal(result.skipped, false);
    if (result.skipped) throw new Error("A coleta completa não deveria ser ignorada.");
    const [instance, assets] = await Promise.all([
      prisma.proxmoxInstance.findUniqueOrThrow({ where: { id: instanceId } }),
      prisma.infrastructureAsset.findMany({ where: { organizationId } }),
    ]);
    assert.equal(result.discovered, 5);
    assert.equal(result.verifiedCount, 5);
    assert.equal(instance.status, "HEALTHY");
    assert.ok(instance.lastSyncAt && instance.lastSyncAt > oldSync);
    assert.equal(instance.lastError, null);
    assert.equal(assets.find((asset) => asset.externalId === oldNodeId)?.status, "ONLINE");
    assert.equal(assets.find((asset) => asset.externalId === oldStorageId)?.status, "MISSING");
    assert.equal(assets.find((asset) => asset.externalId === oldStorageId)?.active, false);
    assert.equal(assets.filter((asset) => asset.active).length, 5);
  });
});

test("older collection finishing last cannot replace a newer snapshot", async () => {
  await withFixture(async ({ organizationId, instanceId, oldNodeId, oldStorageId }) => {
    let releaseOld!: () => void;
    let oldCollecting!: () => void;
    const oldGate = new Promise<void>((resolve) => { releaseOld = resolve; });
    const collecting = new Promise<void>((resolve) => { oldCollecting = resolve; });
    const source = client();
    const slow = discoverProxmoxInstance(
      { organizationId, instanceId },
      { createClient: () => ({
        ...source,
        nodes: async () => [{ node: "hoi", status: "offline" }],
        guests: async () => [],
        network: async () => {
          oldCollecting();
          await oldGate;
          return [];
        },
      }) },
    );

    await collecting;
    // Ensure the older request began in a different timestamp millisecond.
    await new Promise((resolve) => setTimeout(resolve, 5));
    let fresh;
    try {
      fresh = await discoverProxmoxInstance(
        { organizationId, instanceId },
        { createClient: client },
      );
    } finally {
      releaseOld();
    }
    assert.equal(fresh.skipped, false);
    const stale = await slow;
    assert.deepEqual(stale, {
      skipped: true,
      reason: "NEWER_SYNC",
      instanceId,
      instanceName: "Endpoint teste",
    });

    const assets = await prisma.infrastructureAsset.findMany({ where: { organizationId } });
    assert.equal(assets.find((asset) => asset.externalId === oldNodeId)?.status, "ONLINE");
    assert.equal(assets.find((asset) => asset.externalId === oldStorageId)?.active, false);
    assert.equal(assets.filter((asset) => asset.active).length, 5);
  });
});

test("late failure cannot mark a newer successful sync as ERROR", async () => {
  await withFixture(async ({ organizationId, instanceId }) => {
    const startedAt = new Date();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const result = await discoverProxmoxInstance(
      { organizationId, instanceId },
      { createClient: client },
    );
    assert.equal(result.skipped, false);

    const update = await recordProxmoxDiscoveryFailure({
      organizationId, instanceId, startedAt, message: "Falha antiga",
    });
    const instance = await prisma.proxmoxInstance.findUniqueOrThrow({ where: { id: instanceId } });
    assert.equal(update.count, 0);
    assert.equal(instance.status, "HEALTHY");
    assert.equal(instance.lastError, null);
  });
});

test("database failure inside transaction rolls back earlier asset writes", async () => {
  await withFixture(async ({ organizationId, instanceId, oldSync, oldNodeId, oldStorageId }) => {
    const source = client();
    await assert.rejects(discoverProxmoxInstance(
      { organizationId, instanceId },
      { createClient: () => ({
        ...source,
        nodes: async () => [
          { node: "hoi", status: "online" },
          { node: "homeoffice", status: "online", maxcpu: 2 ** 32 },
        ],
      }) },
    ));
    const [instance, assets] = await Promise.all([
      prisma.proxmoxInstance.findUniqueOrThrow({ where: { id: instanceId } }),
      prisma.infrastructureAsset.findMany({ where: { organizationId }, orderBy: { externalId: "asc" } }),
    ]);
    assert.equal(instance.lastSyncAt?.getTime(), oldSync.getTime());
    assert.deepEqual(assets.map((asset) => asset.externalId), [oldNodeId, oldStorageId]);
    assert.equal(assets.find((asset) => asset.externalId === oldNodeId)?.status, "OFFLINE");
    assert.ok(assets.every((asset) => asset.active && asset.lastSeenAt.getTime() === oldSync.getTime()));
  });
});
