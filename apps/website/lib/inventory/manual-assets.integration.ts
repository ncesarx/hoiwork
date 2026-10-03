import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { createManualAsset, ManualAssetError } from "@/lib/inventory/manual-assets";

test("manual inventory is scoped, audited, does not assert uptime, and safely reuses creation requests", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const organizations = await Promise.all(["first", "other"].map((kind) =>
    prisma.organization.create({ data: { name: kind, slug: `manual-inventory-${kind}-${suffix}` } })));
  const [company, other] = organizations;
  const users = await Promise.all(["admin", "tech", "client", "manager", "outsider"].map((kind) =>
    prisma.user.create({ data: { email: `${kind}-manual-${suffix}@example.test` } })));
  const [admin, tech, client, manager, outsider] = users;
  try {
    await prisma.membership.createMany({ data: [
      { userId: admin.id, organizationId: company.id, role: "ADMIN" },
      { userId: tech.id, organizationId: company.id, role: "TECHNICIAN" },
      { userId: client.id, organizationId: company.id, role: "CLIENT" },
      { userId: manager.id, organizationId: company.id, role: "MANAGER" },
      { userId: outsider.id, organizationId: other.id, role: "TECHNICIAN" },
    ] });
    const input = { name: "  Computador recepção  ", type: "WORKSTATION", ipAddress: "192.168.1.20", location: "Recepção", requestId: randomUUID() };
    const forbidden = (error: unknown) => error instanceof ManualAssetError && error.status === 403;
    const invalid = (error: unknown) => error instanceof ManualAssetError && error.status === 400;
    for (const user of [client, manager, outsider]) await assert.rejects(createManualAsset(company.id, user.id, input), forbidden);
    await assert.rejects(createManualAsset(company.id, admin.id, { ...input, organizationId: other.id }), invalid);
    await assert.rejects(createManualAsset(company.id, admin.id, { ...input, status: "ONLINE" }), invalid);
    await assert.rejects(createManualAsset(company.id, admin.id, { ...input, type: "NODE" }), invalid);
    await assert.rejects(createManualAsset(company.id, admin.id, { ...input, name: " " }), invalid);
    await assert.rejects(createManualAsset(company.id, admin.id, { ...input, ipAddress: "999.1.1.1" }), invalid);
    const results = await Promise.all([createManualAsset(company.id, admin.id, input), createManualAsset(company.id, admin.id, input)]);
    assert.deepEqual(results[0], results[1]);
    const asset = await prisma.asset.findUniqueOrThrow({ where: { id: results[0].id } });
    assert.equal(asset.name, "Computador recepção");
    assert.equal(asset.organizationId, company.id);
    assert.equal(asset.status, "UNKNOWN");
    assert.equal(asset.manufacturer, null);
    assert.equal(await prisma.asset.count({ where: { organizationId: other.id } }), 0);
    assert.equal(await prisma.infrastructureAsset.count({ where: { organizationId: company.id } }), 0);
    const events = await prisma.auditLog.findMany({ where: { organizationId: company.id, action: "ASSET_CREATED" } });
    assert.equal(events.length, 1);
    assert.equal(events[0].userId, admin.id);
    assert.equal(events[0].entityId, asset.id);
    assert.deepEqual(events[0].metadata, { source: "MANUAL", name: asset.name, type: "WORKSTATION" });
    const conflict = (error: unknown) => error instanceof ManualAssetError && error.status === 409;
    await assert.rejects(createManualAsset(company.id, tech.id, input), conflict);
    await assert.rejects(createManualAsset(company.id, admin.id, { ...input, location: "Outro local" }), conflict);
    const second = await createManualAsset(company.id, tech.id, { name: "Impressora", type: "PRINTER", ipAddress: "2001:db8::1", requestId: randomUUID() });
    assert.equal((await prisma.asset.findUniqueOrThrow({ where: { id: second.id } })).status, "UNKNOWN");
    const third = await createManualAsset(company.id, admin.id, { name: "Switch", type: "SWITCH", ipAddress: "", requestId: randomUUID() });
    assert.equal((await prisma.asset.findUniqueOrThrow({ where: { id: third.id } })).ipAddress, null);
    await prisma.membership.update({ where: { userId_organizationId: { userId: admin.id, organizationId: company.id } }, data: { active: false } });
    await assert.rejects(createManualAsset(company.id, admin.id, input), forbidden);
    await prisma.user.update({ where: { id: tech.id }, data: { active: false } });
    await assert.rejects(createManualAsset(company.id, tech.id, input), forbidden);
    await prisma.user.update({ where: { id: tech.id }, data: { active: true } });
    await prisma.organization.update({ where: { id: company.id }, data: { active: false } });
    await assert.rejects(createManualAsset(company.id, tech.id, input), forbidden);
    assert.equal(await prisma.asset.count({ where: { organizationId: company.id } }), 3);
  } finally {
    const ids = organizations.map((organization) => organization.id);
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.organization.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  }
});
