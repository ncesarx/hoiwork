import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { createManualAsset, updateManualAsset, ManualAssetError } from "./manual-assets";
import { getManualAssetHistory, formatManualAssetChanges } from "./manual-asset-history";

test("manual history enforces company and role access, projects safe fields, and bounds read-only results", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const organizations = await Promise.all(["first", "other"].map((name) =>
    prisma.organization.create({ data: { name, slug: `history-${name}-${suffix}` } })));
  const [company, other] = organizations;
  const users = await Promise.all(["admin", "tech", "client", "manager", "outsider"].map((name) =>
    prisma.user.create({ data: { name, email: `${name}-history-${suffix}@example.test` } })));
  const [admin, tech, client, manager, outsider] = users;
  const forbidden = (error: unknown) => error instanceof ManualAssetError && error.status === 403;
  const missing = (error: unknown) => error instanceof ManualAssetError && error.status === 404;
  try {
    await prisma.membership.createMany({ data: [
      { userId: admin.id, organizationId: company.id, role: "ADMIN" },
      { userId: tech.id, organizationId: company.id, role: "TECHNICIAN" },
      { userId: client.id, organizationId: company.id, role: "CLIENT" },
      { userId: manager.id, organizationId: company.id, role: "MANAGER" },
      { userId: outsider.id, organizationId: other.id, role: "TECHNICIAN" },
    ] });
    const created = await createManualAsset(company.id, admin.id, { name: "Computador", type: "WORKSTATION", requestId: randomUUID() });
    const original = await prisma.asset.findUniqueOrThrow({ where: { id: created.id } });
    await updateManualAsset(company.id, tech.id, created.id, {
      name: "Computador revisado", type: "WORKSTATION", location: "Sala 2", expectedUpdatedAt: original.updatedAt.toISOString(),
    });
    const assetBeforeRead = await prisma.asset.findUniqueOrThrow({ where: { id: created.id } });
    const history = await getManualAssetHistory(company.id, admin.id, created.id);
    assert.deepEqual(await getManualAssetHistory(company.id, tech.id, created.id), history);
    assert.equal(history.hasMore, false);
    assert.equal(history.events.length, 2);
    assert.equal(history.events[0].actor, "tech");
    assert.equal(history.events[0].action, "Equipamento alterado");
    assert.deepEqual(history.events[0].changes, [
      { field: "Nome", previous: "Computador", next: "Computador revisado" },
      { field: "Localização", previous: "Não informado", next: "Sala 2" },
    ]);
    assert.equal(history.events[1].actor, "admin");
    assert.equal(history.events[1].action, "Equipamento cadastrado");
    for (const user of [client, manager, outsider]) await assert.rejects(getManualAssetHistory(company.id, user.id, created.id), forbidden);
    await assert.rejects(getManualAssetHistory(other.id, outsider.id, created.id), missing);
    const legacy = await prisma.asset.create({ data: { organizationId: company.id, name: "Legado", type: "SERVER" } });
    await assert.rejects(getManualAssetHistory(company.id, admin.id, legacy.id), missing);
    const metadata = { source: "MANUAL", secret: "internal-secret", changes: {
      type: { previous: "WORKSTATION", next: "SERVER" },
      token: { previous: "private-token", next: "private-secret" },
      name: { previous: {}, next: "invalid" },
    } };
    assert.deepEqual(formatManualAssetChanges(metadata), [{ field: "Tipo", previous: "Computador", next: "Servidor" }]);
    assert.deepEqual(formatManualAssetChanges({ ...metadata, source: "PROXMOX" }), []);
    await prisma.auditLog.createMany({ data: Array.from({ length: 21 }, (_, index) => ({
      organizationId: company.id, userId: tech.id, entity: "Asset", entityId: created.id,
      action: "ASSET_UPDATED", metadata, createdAt: new Date(Date.now() + 1000 + index),
    })) });
    await prisma.auditLog.create({ data: { organizationId: other.id, userId: outsider.id, entity: "Asset", entityId: created.id,
      action: "ASSET_UPDATED", metadata: { source: "MANUAL", changes: { name: { previous: "foreign-company", next: "foreign-record" } } },
      createdAt: new Date(Date.now() + 10000) } });
    const count = await prisma.auditLog.count({ where: { organizationId: company.id } });
    const bounded = await getManualAssetHistory(company.id, admin.id, created.id);
    assert.equal(bounded.events.length, 20);
    assert.equal(bounded.hasMore, true);
    assert.ok(bounded.events.every((event, index, events) => index === 0 || event.createdAt <= events[index - 1].createdAt));
    assert.doesNotMatch(JSON.stringify(bounded), /internal-secret|private-token|private-secret|foreign-record|metadata/);
    assert.equal(await prisma.auditLog.count({ where: { organizationId: company.id } }), count);
    assert.deepEqual(await prisma.asset.findUniqueOrThrow({ where: { id: created.id } }), assetBeforeRead);
    await prisma.membership.update({ where: { userId_organizationId: { userId: admin.id, organizationId: company.id } }, data: { active: false } });
    await assert.rejects(getManualAssetHistory(company.id, admin.id, created.id), forbidden);
    await prisma.user.update({ where: { id: tech.id }, data: { active: false } });
    await assert.rejects(getManualAssetHistory(company.id, tech.id, created.id), forbidden);
    await prisma.user.update({ where: { id: tech.id }, data: { active: true } });
    await prisma.organization.update({ where: { id: company.id }, data: { active: false } });
    await assert.rejects(getManualAssetHistory(company.id, tech.id, created.id), forbidden);
  } finally {
    const ids = organizations.map((organization) => organization.id);
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.organization.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  }
});
