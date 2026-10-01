import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { getActiveOrganizationsForUser, getSelectedMembership } from "./access";
import { acceptInvitation, createInvitation, InvitationError, listOrganizationInvitations, revokeInvitation } from "./invitations";

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

test("only a tenant ADMIN can revoke a pending invite; revoked links cannot be activated", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const [organization, other] = await Promise.all([
    prisma.organization.create({ data: { name: "Revogação", slug: `revoke-${suffix}` } }),
    prisma.organization.create({ data: { name: "Outra", slug: `another-${suffix}` } }),
  ]);
  const [admin, otherAdmin] = await Promise.all([
    prisma.user.create({ data: { email: `admin-${suffix}@example.test` } }),
    prisma.user.create({ data: { email: `other-${suffix}@example.test` } }),
  ]);
  const email = `invite-${suffix}@example.test`;
  let activatedId: string | undefined;
  try {
    await Promise.all([
      prisma.membership.create({ data: { organizationId: organization.id, userId: admin.id, role: "ADMIN" } }),
      prisma.membership.create({ data: { organizationId: other.id, userId: otherAdmin.id, role: "ADMIN" } }),
    ]);
    const create = () => createInvitation({ organizationId: organization.id, actorUserId: admin.id, name: "Convidado", email, role: "CLIENT" });
    const original = await create();
    const [invite] = await listOrganizationInvitations(organization.id);
    assert.equal(invite.email, email);
    assert.equal(invite.state, "Pendente");
    assert.equal("tokenHash" in invite, false);
    assert.equal((await listOrganizationInvitations(other.id)).length, 0);
    const revoke = (actorUserId: string, organizationId = organization.id) => revokeInvitation({ organizationId, actorUserId, invitationId: invite.id });
    await assert.rejects(revoke(otherAdmin.id), (error) => error instanceof InvitationError && error.status === 403);
    await assert.rejects(revoke(otherAdmin.id, other.id), (error) => error instanceof InvitationError && error.status === 404);
    await revoke(admin.id);
    assert.equal((await listOrganizationInvitations(organization.id))[0].state, "Revogado");
    await assert.rejects(revoke(admin.id), (error) => error instanceof InvitationError && error.status === 409);
    await assert.rejects(acceptInvitation({ token: original.token, email, password: "secure-password-123" }), (error) => error instanceof InvitationError && error.status === 400);
    assert.equal(await prisma.user.count({ where: { email } }), 0);
    const replacement = await create();
    const activated = await acceptInvitation({ token: replacement.token, email, password: "secure-password-123" });
    activatedId = activated.userId;
    const [newest] = await listOrganizationInvitations(organization.id);
    assert.equal(newest.state, "Aceito");
    await assert.rejects(revokeInvitation({ organizationId: organization.id, actorUserId: admin.id, invitationId: newest.id }), (error) => error instanceof InvitationError && error.status === 409);
    const audit = await prisma.auditLog.findMany({ where: { entityId: invite.id } });
    assert.deepEqual(audit.map((entry) => entry.action).sort(), ["ORGANIZATION_INVITATION_CREATED", "ORGANIZATION_INVITATION_REVOKED"]);
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [organization.id, other.id] } } });
    await Promise.all([prisma.organization.delete({ where: { id: organization.id } }), prisma.organization.delete({ where: { id: other.id } })]);
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, otherAdmin.id, ...(activatedId ? [activatedId] : [])] } } });
  }
});

test("activation and revocation of one invite have exactly one winner", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const organization = await prisma.organization.create({ data: { name: "Corrida", slug: `invite-race-${suffix}` } });
  const admin = await prisma.user.create({ data: { email: `admin-${suffix}@example.test` } });
  const email = `race-${suffix}@example.test`;
  try {
    await prisma.membership.create({ data: { userId: admin.id, organizationId: organization.id, role: "ADMIN" } });
    const { token } = await createInvitation({ organizationId: organization.id, actorUserId: admin.id, name: "Corrida", email, role: "CLIENT" });
    const [invitation] = await listOrganizationInvitations(organization.id);
    const results = await Promise.allSettled([
      acceptInvitation({ token, email, password: "secure-password-123" }),
      revokeInvitation({ organizationId: organization.id, actorUserId: admin.id, invitationId: invitation.id }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected" && result.reason instanceof InvitationError).length, 1);
    const saved = await prisma.organizationInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
    assert.equal(Boolean(saved.acceptedAt) !== Boolean(saved.revokedAt), true);
    assert.equal(await prisma.user.count({ where: { email } }), saved.acceptedAt ? 1 : 0);
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.user.deleteMany({ where: { email: { in: [admin.email, email] } } });
  }
});

test("existing account accepts a second organization with current password and switches context safely", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const [first, second] = await Promise.all([
    prisma.organization.create({ data: { name: "Primeira", slug: `first-${suffix}` } }),
    prisma.organization.create({ data: { name: "Segunda", slug: `second-${suffix}` } }),
  ]);
  const passwordHash = await hash("existing-password", 12);
  const [admin, person] = await Promise.all([
    prisma.user.create({ data: { email: `admin-${suffix}@example.test` } }),
    prisma.user.create({ data: { email: `person-${suffix}@example.test`, name: "Nome anterior", passwordHash } }),
  ]);
  try {
    await Promise.all([
      prisma.membership.create({ data: { userId: admin.id, organizationId: second.id, role: "ADMIN" } }),
      prisma.membership.create({ data: { userId: person.id, organizationId: first.id, role: "CLIENT" } }),
    ]);
    const create = (email = person.email) => createInvitation({
      organizationId: second.id, actorUserId: admin.id, email, name: "Nome do convite", role: "TECHNICIAN",
    });
    await assert.rejects(create(admin.email), (error) => error instanceof InvitationError && error.status === 409);
    const { token } = await create();
    await assert.rejects(acceptInvitation({ token, email: person.email, password: "wrong-password" }),
      (error) => error instanceof InvitationError && error.status === 403);
    const result = await acceptInvitation({ token, email: person.email, password: "existing-password" });
    assert.equal(result.userId, person.id);
    assert.equal(await prisma.user.count({ where: { email: person.email } }), 1);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: person.id } });
    assert.equal(saved.name, "Nome anterior");
    assert.equal(saved.passwordHash, passwordHash);
    assert.equal((await getSelectedMembership(person.id, second.id, first.id))?.role, "TECHNICIAN");
    assert.equal((await getActiveOrganizationsForUser(person.id)).length, 2);
    const secondMembership = await prisma.membership.findUniqueOrThrow({
      where: { userId_organizationId: { userId: person.id, organizationId: second.id } },
    });
    await prisma.membership.update({ where: { id: secondMembership.id }, data: { active: false } });
    assert.equal((await getSelectedMembership(person.id, second.id, first.id))?.organizationId, first.id);
    assert.equal((await getActiveOrganizationsForUser(person.id)).length, 1);
    assert.equal(await getSelectedMembership(person.id, second.id, null), null);
    await assert.rejects(create(), (error) => error instanceof InvitationError && error.status === 409);
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [first.id, second.id] } } });
    await Promise.all([prisma.organization.delete({ where: { id: first.id } }), prisma.organization.delete({ where: { id: second.id } })]);
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, person.id] } } });
  }
});
