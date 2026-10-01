import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { acceptInvitation, createInvitation, InvitationError } from "./invitations";

test("organization invite is scoped, hashed, single use, and provisions credentials with audit", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const [organization, other] = await Promise.all([
    prisma.organization.create({ data: { name: "Convites", slug: `convites-${suffix}` } }),
    prisma.organization.create({ data: { name: "Outra", slug: `outra-${suffix}` } }),
  ]);
  const admin = await prisma.user.create({ data: { email: `admin-${suffix}@example.test` } });
  const outsider = await prisma.user.create({ data: { email: `outsider-${suffix}@example.test` } });
  const invitedEmail = `invited-${suffix}@example.test`;
  let activatedId: string | undefined;
  try {
    await Promise.all([
      prisma.membership.create({ data: { userId: admin.id, organizationId: organization.id, role: "ADMIN" } }),
      prisma.membership.create({ data: { userId: outsider.id, organizationId: other.id, role: "ADMIN" } }),
    ]);
    const create = (actorUserId: string, email = invitedEmail) => createInvitation({
      organizationId: organization.id, actorUserId, name: "Pessoa Convidada", email, role: "TECHNICIAN",
    });
    await assert.rejects(create(outsider.id), (error) => error instanceof InvitationError && error.status === 403);
    const { token, expiresAt } = await create(admin.id);
    const stored = await prisma.organizationInvitation.findUniqueOrThrow({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } });
    assert.equal(stored.organizationId, organization.id);
    assert.equal(stored.tokenHash.includes(token), false);
    assert.ok(expiresAt > new Date());
    await assert.rejects(create(admin.id), (error) => error instanceof InvitationError && error.status === 409);
    await assert.rejects(acceptInvitation({ token, email: outsider.email, password: "secure-password-123" }), (error) => error instanceof InvitationError && error.status === 400);
    const result = await acceptInvitation({ token, email: invitedEmail.toUpperCase(), password: "secure-password-123" });
    activatedId = result.userId;
    assert.equal(result.organizationId, organization.id);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId }, include: { memberships: true } });
    assert.equal(user.email, invitedEmail);
    assert.equal(user.memberships[0].role, "TECHNICIAN");
    assert.equal(user.memberships[0].organizationId, organization.id);
    assert.equal(await compare("secure-password-123", user.passwordHash!), true);
    await assert.rejects(acceptInvitation({ token, email: invitedEmail, password: "secure-password-123" }), (error) => error instanceof InvitationError && error.status === 400);
    const events = await prisma.auditLog.findMany({ where: { organizationId: organization.id, entityId: stored.id } });
    assert.deepEqual(events.map((event) => event.action).sort(), ["ORGANIZATION_INVITATION_ACCEPTED", "ORGANIZATION_INVITATION_CREATED"]);

    const expired = await create(admin.id, `expired-${suffix}@example.test`);
    await prisma.organizationInvitation.update({ where: { tokenHash: createHash("sha256").update(expired.token).digest("hex") }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await assert.rejects(acceptInvitation({ token: expired.token, email: `expired-${suffix}@example.test`, password: "secure-password-123" }), (error) => error instanceof InvitationError && error.status === 400);
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [organization.id, other.id] } } });
    await Promise.all([prisma.organization.delete({ where: { id: organization.id } }), prisma.organization.delete({ where: { id: other.id } })]);
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, outsider.id, ...(activatedId ? [activatedId] : [])] } } });
  }
});

test("two activations of the same token create one account", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const organization = await prisma.organization.create({ data: { name: "Uso único", slug: `uso-unico-${suffix}` } });
  const admin = await prisma.user.create({ data: { email: `admin-${suffix}@example.test` } });
  const email = `person-${suffix}@example.test`;
  try {
    await prisma.membership.create({ data: { organizationId: organization.id, userId: admin.id, role: "ADMIN" } });
    const { token } = await createInvitation({ organizationId: organization.id, actorUserId: admin.id, name: "Person", email, role: "CLIENT" });
    const results = await Promise.allSettled(Array.from({ length: 2 }, () => acceptInvitation({ token, email, password: "secure-password-123" })));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected" && result.reason instanceof InvitationError).length, 1);
    assert.equal(await prisma.user.count({ where: { email } }), 1);
    assert.equal(await prisma.membership.count({ where: { organizationId: organization.id, user: { email } } }), 1);
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.user.deleteMany({ where: { email: { in: [admin.email, email] } } });
  }
});
