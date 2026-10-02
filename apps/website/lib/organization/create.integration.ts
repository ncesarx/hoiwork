import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { getActiveMembership, getActiveOrganizationsForUser } from "./access";
import { listAccessAudit } from "./access-audit";
import { createClientOrganization, OrganizationCreationError } from "./create";
import { createInvitation } from "./invitations";

test("an active admin creates an empty isolated client company and keeps prior memberships", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const source = await prisma.organization.create({ data: { name: "Empresa atual", slug: `create-source-${suffix}` } });
  const users = await Promise.all(["admin", "client", "outsider"].map((kind) =>
    prisma.user.create({ data: { email: `${kind}-create-${suffix}@example.test` } })));
  const [admin, client, outsider] = users;
  const ids = [source.id];
  try {
    await prisma.membership.createMany({ data: [
      { userId: admin.id, organizationId: source.id, role: "ADMIN" },
      { userId: client.id, organizationId: source.id, role: "CLIENT" },
    ] });
    const originalAsset = await prisma.asset.create({ data: { organizationId: source.id, name: "Servidor atual", type: "SERVER" } });
    const create = (actorUserId: string, name = "  Empresa nova  ") => createClientOrganization({
      sourceOrganizationId: source.id, actorUserId, name,
    });
    const forbidden = (error: unknown) => error instanceof OrganizationCreationError && error.status === 403;
    await assert.rejects(create(client.id), forbidden);
    await assert.rejects(create(outsider.id), forbidden);
    await assert.rejects(create(admin.id, " "), (error) => error instanceof OrganizationCreationError && error.status === 400);
    const created = await create(admin.id);
    ids.push(created.id);
    assert.notEqual(created.id, source.id);
    assert.equal(created.name, "Empresa nova");
    const own = await getActiveMembership(admin.id, created.id);
    assert.equal(own?.role, "ADMIN");
    assert.equal(await getActiveMembership(client.id, created.id), null);
    assert.equal(await getActiveMembership(outsider.id, created.id), null);
    assert.equal((await getActiveMembership(admin.id, source.id))?.role, "ADMIN");
    assert.equal((await getActiveOrganizationsForUser(admin.id)).length, 2);
    assert.equal((await getActiveOrganizationsForUser(client.id)).length, 1);
    const counts = await Promise.all([
      prisma.asset.count({ where: { organizationId: created.id } }),
      prisma.infrastructureAsset.count({ where: { organizationId: created.id } }),
      prisma.ticket.count({ where: { organizationId: created.id } }),
      prisma.contract.count({ where: { organizationId: created.id } }),
      prisma.proxmoxInstance.count({ where: { organizationId: created.id } }),
    ]);
    assert.deepEqual(counts, [0, 0, 0, 0, 0]);
    assert.equal((await prisma.asset.findUniqueOrThrow({ where: { id: originalAsset.id } })).organizationId, source.id);
    const events = await prisma.auditLog.findMany({ where: { organizationId: created.id } });
    assert.equal(events.length, 1);
    assert.equal(events[0].action, "ORGANIZATION_CREATED");
    assert.equal(events[0].userId, admin.id);
    assert.equal((await listAccessAudit(created.id))[0].action, "Empresa cadastrada");
    await createInvitation({ organizationId: created.id, actorUserId: admin.id, name: "Cliente novo", email: `invited-create-${suffix}@example.test`, role: "CLIENT" });
    assert.equal(await prisma.organizationInvitation.count({ where: { organizationId: created.id } }), 1);
    assert.equal(await prisma.organizationInvitation.count({ where: { organizationId: source.id } }), 0);

    const membershipKey = { userId_organizationId: { userId: admin.id, organizationId: source.id } };
    await prisma.membership.update({ where: membershipKey, data: { active: false } });
    await assert.rejects(create(admin.id), forbidden);
    await prisma.membership.update({ where: membershipKey, data: { active: true } });
    await prisma.user.update({ where: { id: admin.id }, data: { active: false } });
    await assert.rejects(create(admin.id), forbidden);
    await prisma.user.update({ where: { id: admin.id }, data: { active: true } });
    await prisma.organization.update({ where: { id: source.id }, data: { active: false } });
    await assert.rejects(create(admin.id), forbidden);
    assert.equal(await prisma.membership.count({ where: { userId: admin.id } }), 2);
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.organization.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  }
});
