import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProxmoxInventory } from "./proxmox-topology";

type Instances = Parameters<typeof buildProxmoxInventory>[0];
type Assets = Parameters<typeof buildProxmoxInventory>[1];

test("two endpoints of one cluster yield one inventory and retain another cluster", () => {
  const now = new Date("2026-09-28T13:18:41Z");
  const instances: Instances = [
    { id: "a", name: "Principal", site: "Principal", baseUrl: "https://a:8006", status: "HEALTHY", lastSyncAt: now },
    { id: "b", name: "Homeoffice", site: "DR", baseUrl: "https://b:8006", status: "HEALTHY", lastSyncAt: now },
    { id: "c", name: "Outro cluster", site: "Outro", baseUrl: "https://c:8006", status: "HEALTHY", lastSyncAt: now },
  ];
  const assets: Assets = [];

  for (const instanceId of ["a", "b"]) {
    for (const name of ["hoi", "homeoffice"]) {
      assets.push({
        externalId: `proxmox/${instanceId}/node/${name}`,
        assetType: "NODE", name, nodeName: name, status: "ONLINE", ipAddress: null,
        metadata: { sourceExternalId: `node/${name}` }, lastSeenAt: now,
      });
    }
    assets.push({
      externalId: `proxmox/${instanceId}/qemu/105`,
      assetType: "VM", name: "works-www", nodeName: "hoi", status: "RUNNING", ipAddress: null,
      metadata: { sourceExternalId: "qemu/105", vmid: 105 }, lastSeenAt: now,
    });
  }
  assets.push({
    externalId: "proxmox/c/node/other", assetType: "NODE", name: "other", nodeName: "other",
    status: "ONLINE", ipAddress: null, metadata: { sourceExternalId: "node/other" }, lastSeenAt: now,
  });

  const clusters = buildProxmoxInventory(instances, assets);
  assert.equal(clusters.length, 2);
  const hoi = clusters.find((cluster) => cluster.nodes.some((node) => node.resource.name === "hoi"));
  assert.equal(hoi?.endpoints.length, 2);
  assert.equal(hoi?.nodes.length, 2);
  assert.deepEqual(hoi?.nodes.find((node) => node.resource.name === "hoi")?.guests.map((guest) => guest.vmid), [105]);
  assert.equal(clusters.find((cluster) => cluster.nodes[0].resource.name === "other")?.endpoints.length, 1);
});
