import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { getSelectedMembership } from "./access";
import { listAccessAudit } from "./access-audit";
import { organizationProfileSchema, OrganizationProfileError, updateOrganizationProfile } from "./profile";

test("company name is validated, restricted to its active admin, and audited without moving data", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const organizations = await Promise.all([
    prisma.organization.create({ data: { name: "Cliente Demonstração", slug: `company-${suffix}` } }),
    prisma.organization.create({ data: { name: "Outra empresa", slug: `company-other-${suffix}` } }),
  ]);
  const [company, other] = organizations;
  const users = await Promise.all(["admin", "client", "outsider"].map((kind) =>
    prisma.user.create({ data: { email: `${kind}-company-${suffix}@example.test` } })));
  const [admin, client, outsider] = users;
  try {
    await prisma.membership.createMany({ data: [
      { userId: admin.id, organizationId: company.id, role: "ADMIN" },
      { userId: client.id, organizationId: company.id, role: "CLIENT" },
      { userId: outsider.id, organizationId: other.id, role: "ADMIN" },
    ] });
    const update = (actorUserId: string, name = "  Empresa do Cliente  ") => updateOrganizationProfile({
      organizationId: company.id, actorUserId, name,
    });
    const forbidden = (error: unknown) => error instanceof OrganizationProfileError && error.status === 403;
    await assert.rejects(update(client.id), forbidden);
    await assert.rejects(update(outsider.id), forbidden);
    await assert.rejects(update(admin.id, "   "), (error) => error instanceof OrganizationProfileError && error.status === 400);
    assert.equal(organizationProfileSchema.safeParse({ name: "Empresa", organizationId: other.id }).success, false);
    assert.equal(organizationProfileSchema.safeParse({ name: "x".repeat(121) }).success, false);

    assert.deepEqual(await update(admin.id), { name: "Empresa do Cliente" });
    assert.deepEqual(await update(admin.id), { name: "Empresa do Cliente" });
    const current = await prisma.organization.findUniqueOrThrow({ where: { id: company.id } });
    assert.equal(current.slug, company.slug);
    assert.equal(current.id, company.id);
    assert.equal((await prisma.organization.findUniqueOrThrow({ where: { id: other.id } })).name, other.name);
    assert.equal((await getSelectedMembership(client.id, company.id, null))?.organization.name, current.name);
    const events = await prisma.auditLog.findMany({ where: { organizationId: company.id } });
    assert.equal(events.length, 1);
    assert.equal(events[0].userId, admin.id);
    assert.equal(events[0].action, "ORGANIZATION_PROFILE_UPDATED");
    assert.deepEqual(events[0].metadata, { previousName: company.name, newName: current.name });
    const audit = await listAccessAudit(company.id);
    assert.equal(audit[0].action, "Nome da empresa alterado");
    assert.equal(audit[0].details, "Cliente Demonstração → Empresa do Cliente");
    assert.deepEqual(await listAccessAudit(other.id), []);

    await prisma.membership.update({ where: { userId_organizationId: { userId: admin.id, organizationId: company.id } }, data: { active: false } });
    await assert.rejects(update(admin.id, "Não permitido"), forbidden);
    await prisma.membership.update({ where: { userId_organizationId: { userId: admin.id, organizationId: company.id } }, data: { active: true } });
    await prisma.user.update({ where: { id: admin.id }, data: { active: false } });
    await assert.rejects(update(admin.id, "Não permitido"), forbidden);
    await prisma.user.update({ where: { id: admin.id }, data: { active: true } });
    await prisma.organization.update({ where: { id: company.id }, data: { active: false } });
    await assert.rejects(update(admin.id, "Não permitido"), forbidden);
    assert.equal(await prisma.auditLog.count({ where: { organizationId: company.id } }), 1);
  } finally {
    const ids = organizations.map((organization) => organization.id);
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.organization.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  }
});
