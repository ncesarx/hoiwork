import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { createManualAsset, ManualAssetError, updateManualAsset } from "./manual-assets";

test("manual edits are scoped and audited, preserve availability, and reject conflicting writes", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const organizations = await Promise.all(["first", "other"].map((kind) =>
    prisma.organization.create({ data: { name: kind, slug: `manual-edit-${kind}-${suffix}` } })));
  const [company, other] = organizations;
  const users = await Promise.all(["admin", "tech", "client", "manager", "outsider"].map((kind) =>
    prisma.user.create({ data: { email: `${kind}-edit-${suffix}@example.test` } })));
  const [admin, tech, client, manager, outsider] = users;
  try {
    await prisma.membership.createMany({ data: [
      { userId: admin.id, organizationId: company.id, role: "ADMIN" },
      { userId: tech.id, organizationId: company.id, role: "TECHNICIAN" },
      { userId: client.id, organizationId: company.id, role: "CLIENT" },
      { userId: manager.id, organizationId: company.id, role: "MANAGER" },
      { userId: outsider.id, organizationId: other.id, role: "TECHNICIAN" },
    ] });
    const created = await createManualAsset(company.id, admin.id, {
      name: "Computador", type: "WORKSTATION", location: "Recepção", ipAddress: "192.168.1.10", requestId: randomUUID(),
    });
    const original = await prisma.asset.findUniqueOrThrow({ where: { id: created.id } });
    const fields = { name: "Computador revisado", type: "WORKSTATION", location: "Sala 2", ipAddress: "", expectedUpdatedAt: original.updatedAt.toISOString() };
    const forbidden = (error: unknown) => error instanceof ManualAssetError && error.status === 403;
    const invalid = (error: unknown) => error instanceof ManualAssetError && error.status === 400;
    const missing = (error: unknown) => error instanceof ManualAssetError && error.status === 404;
    const conflict = (error: unknown) => error instanceof ManualAssetError && error.status === 409;
    for (const user of [client, manager, outsider]) await assert.rejects(updateManualAsset(company.id, user.id, created.id, fields), forbidden);
    await assert.rejects(updateManualAsset(other.id, outsider.id, created.id, fields), missing);
    await assert.rejects(updateManualAsset(company.id, admin.id, created.id, { ...fields, status: "ONLINE" }), invalid);
    await assert.rejects(updateManualAsset(company.id, admin.id, created.id, { ...fields, organizationId: other.id }), invalid);
    await assert.rejects(updateManualAsset(company.id, admin.id, created.id, { ...fields, type: "NODE" }), invalid);
    await assert.rejects(updateManualAsset(company.id, admin.id, created.id, { ...fields, ipAddress: "not-an-ip" }), invalid);
    const legacy = await prisma.asset.create({ data: { organizationId: company.id, name: "Legado", type: "SERVER" } });
    await assert.rejects(updateManualAsset(company.id, admin.id, legacy.id, { ...fields, expectedUpdatedAt: legacy.updatedAt.toISOString() }), missing);

    const updated = await updateManualAsset(company.id, tech.id, created.id, fields);
    assert.deepEqual(await updateManualAsset(company.id, tech.id, created.id, fields), updated);
    const asset = await prisma.asset.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(asset.name, fields.name);
    assert.equal(asset.location, fields.location);
    assert.equal(asset.ipAddress, null);
    assert.equal(asset.status, original.status);
    assert.equal(asset.organizationId, company.id);
    assert.deepEqual(asset.createdAt, original.createdAt);
    assert.deepEqual(asset.metadata, original.metadata);
    assert.ok(asset.updatedAt > original.updatedAt);
    const events = await prisma.auditLog.findMany({ where: { organizationId: company.id, action: "ASSET_UPDATED" } });
    assert.equal(events.length, 1);
    assert.equal(events[0].userId, tech.id);
    assert.equal(events[0].entityId, asset.id);
    assert.deepEqual(events[0].metadata, { source: "MANUAL", changes: {
      name: { previous: "Computador", next: fields.name }, location: { previous: "Recepção", next: "Sala 2" },
      ipAddress: { previous: "192.168.1.10", next: null },
    } });
    await assert.rejects(updateManualAsset(company.id, admin.id, created.id, { ...fields, name: "Edição antiga" }), conflict);
    const concurrent = await Promise.allSettled([
      updateManualAsset(company.id, admin.id, created.id, { ...fields, name: "Opção A", expectedUpdatedAt: updated.updatedAt }),
      updateManualAsset(company.id, tech.id, created.id, { ...fields, name: "Opção B", expectedUpdatedAt: updated.updatedAt }),
    ]);
    assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(concurrent.filter((result) => result.status === "rejected" && conflict(result.reason)).length, 1);
    assert.equal(await prisma.auditLog.count({ where: { organizationId: company.id, action: "ASSET_UPDATED" } }), 2);
    await prisma.membership.update({ where: { userId_organizationId: { userId: admin.id, organizationId: company.id } }, data: { active: false } });
    await assert.rejects(updateManualAsset(company.id, admin.id, created.id, fields), forbidden);
    await prisma.user.update({ where: { id: tech.id }, data: { active: false } });
    await assert.rejects(updateManualAsset(company.id, tech.id, created.id, fields), forbidden);
    await prisma.user.update({ where: { id: tech.id }, data: { active: true } });
    await prisma.organization.update({ where: { id: company.id }, data: { active: false } });
    await assert.rejects(updateManualAsset(company.id, tech.id, created.id, fields), forbidden);
    assert.equal(await prisma.auditLog.count({ where: { organizationId: other.id } }), 0);
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: organizations.map((organization) => organization.id) } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizations.map((organization) => organization.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  }
});
