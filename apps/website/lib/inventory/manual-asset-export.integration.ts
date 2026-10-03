import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { createManualAsset, ManualAssetError } from "./manual-assets";
import { exportManualAssets } from "./manual-asset-export";

test("CSV export is company-scoped, role-checked, filtered, bounded and read-only", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const organizations = await Promise.all(["first", "other"].map((name) =>
    prisma.organization.create({ data: { name, slug: `export-${name}-${suffix}` } })));
  const [company, other] = organizations;
  const users = await Promise.all(["admin", "tech", "client", "manager", "outsider"].map((name) =>
    prisma.user.create({ data: { name, email: `${name}-export-${suffix}@example.test` } })));
  const [admin, tech, client, manager, outsider] = users;
  const forbidden = (error: unknown) => error instanceof ManualAssetError && error.status === 403;
  const invalid = (error: unknown) => error instanceof ManualAssetError && error.status === 400;
  try {
    await prisma.membership.createMany({ data: [
      { userId: admin.id, organizationId: company.id, role: "ADMIN" },
      { userId: tech.id, organizationId: company.id, role: "TECHNICIAN" },
      { userId: client.id, organizationId: company.id, role: "CLIENT" },
      { userId: manager.id, organizationId: company.id, role: "MANAGER" },
      { userId: outsider.id, organizationId: other.id, role: "TECHNICIAN" },
    ] });
    await createManualAsset(company.id, admin.id, { name: "Impressora", type: "PRINTER", location: "Sala Azul", requestId: randomUUID() });
    await createManualAsset(company.id, admin.id, { name: "Computador", type: "WORKSTATION", model: "Modelo X", requestId: randomUUID() });
    await createManualAsset(other.id, outsider.id, { name: "Foreign equipment", type: "SERVER", requestId: randomUUID() });
    await prisma.asset.create({ data: { organizationId: company.id, name: "Legacy equipment", type: "SERVER" } });
    const before = await prisma.asset.findMany({ where: { organizationId: company.id }, orderBy: { id: "asc" } });
    const auditCount = await prisma.auditLog.count({ where: { organizationId: company.id } });
    const csv = await exportManualAssets(company.id, admin.id, {});
    assert.equal(csv, await exportManualAssets(company.id, tech.id, {}));
    assert.match(csv, /Impressora/); assert.match(csv, /Computador/);
    assert.doesNotMatch(csv, /Foreign equipment|Legacy equipment|createdById|requestId/);
    for (const user of [client, manager, outsider]) await assert.rejects(exportManualAssets(company.id, user.id, {}), forbidden);
    assert.doesNotMatch(await exportManualAssets(other.id, outsider.id, {}), /Impressora|Computador/);
    assert.doesNotMatch(await exportManualAssets(company.id, admin.id, { type: "PRINTER" }), /Computador/);
    assert.doesNotMatch(await exportManualAssets(company.id, admin.id, { q: " sala AZUL " }), /Computador/);
    assert.match(await exportManualAssets(company.id, admin.id, { q: "modelo x" }), /Computador/);
    assert.equal((await exportManualAssets(company.id, admin.id, { type: "NODE" })).split("\r\n").length, 2);
    assert.equal((await exportManualAssets(company.id, admin.id, { q: "absent" })).split("\r\n").length, 2);
    for (const input of [{ type: "invalid" }, { q: "a".repeat(201) }, { organizationId: other.id }]) {
      await assert.rejects(exportManualAssets(company.id, admin.id, input), invalid);
    }
    assert.deepEqual(await prisma.asset.findMany({ where: { organizationId: company.id }, orderBy: { id: "asc" } }), before);
    assert.equal(await prisma.auditLog.count({ where: { organizationId: company.id } }), auditCount);
    await prisma.asset.createMany({ data: Array.from({ length: 1000 }, (_, index) => ({ organizationId: company.id,
      name: `Bulk ${index}`, type: "SWITCH", status: "UNKNOWN", metadata: { source: "MANUAL" } })) });
    assert.equal((await exportManualAssets(company.id, admin.id, { type: "SWITCH" })).split("\r\n").length, 1002);
    await assert.rejects(exportManualAssets(company.id, admin.id, {}), invalid);
    await prisma.membership.update({ where: { userId_organizationId: { userId: admin.id, organizationId: company.id } }, data: { active: false } });
    await assert.rejects(exportManualAssets(company.id, admin.id, {}), forbidden);
    await prisma.user.update({ where: { id: tech.id }, data: { active: false } });
    await assert.rejects(exportManualAssets(company.id, tech.id, {}), forbidden);
    await prisma.user.update({ where: { id: tech.id }, data: { active: true } });
    await prisma.organization.update({ where: { id: company.id }, data: { active: false } });
    await assert.rejects(exportManualAssets(company.id, tech.id, {}), forbidden);
  } finally {
    const ids = organizations.map((organization) => organization.id);
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.organization.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  }
});
