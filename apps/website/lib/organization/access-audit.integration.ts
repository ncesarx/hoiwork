import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { listAccessAudit, listOwnSecurityActivity } from "./access-audit";

test("access history is tenant-scoped and never returns raw metadata or invitation tokens", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const [organization, other] = await Promise.all([
    prisma.organization.create({ data: { name: "Audit", slug: `audit-${suffix}` } }),
    prisma.organization.create({ data: { name: "Other", slug: `other-audit-${suffix}` } }),
  ]);
  const [actor, target] = await Promise.all([
    prisma.user.create({ data: { email: `actor-${suffix}@example.test`, name: "Responsável" } }),
    prisma.user.create({ data: { email: `target-${suffix}@example.test` } }),
  ]);
  try {
    const membership = await prisma.membership.create({ data: { organizationId: organization.id, userId: target.id, role: "CLIENT" } });
    const invite = await prisma.organizationInvitation.create({ data: {
      organizationId: organization.id, email: `invited-${suffix}@example.test`, name: "Invitee",
      role: "CLIENT", invitedById: actor.id, tokenHash: `private-digest-${suffix}`,
      expiresAt: new Date(Date.now() + 60_000),
    } });
    const replacement = await prisma.organizationInvitation.create({ data: {
      organizationId: organization.id, email: invite.email, name: "Invitee corrected",
      role: "TECHNICIAN", invitedById: actor.id, tokenHash: `replacement-digest-${suffix}`,
      expiresAt: new Date(Date.now() + 60_000),
    } });
    await Promise.all([
      prisma.auditLog.create({ data: {
        organizationId: organization.id, userId: actor.id, action: "ORGANIZATION_INVITATION_CREATED",
        entity: "OrganizationInvitation", entityId: invite.id,
        metadata: { token: "private-token-never-display" },
      } }),
      prisma.auditLog.create({ data: {
        organizationId: organization.id, userId: actor.id, action: "MEMBERSHIP_ROLE_CHANGED",
        entity: "Membership", entityId: membership.id,
        metadata: { previousRole: "CLIENT", newRole: "TECHNICIAN", secret: "must-not-display" },
      } }),
      prisma.auditLog.create({ data: {
        organizationId: other.id, userId: actor.id, action: "MEMBERSHIP_ACCESS_SUSPENDED",
        entity: "Membership", entityId: membership.id,
      } }),
      prisma.auditLog.create({ data: {
        organizationId: organization.id, userId: actor.id, action: "UNRELATED_SYSTEM_EVENT",
        entity: "Membership", entityId: membership.id,
      } }),
      prisma.auditLog.create({ data: {
        organizationId: organization.id, userId: actor.id, action: "ORGANIZATION_INVITATION_REVOKED",
        entity: "OrganizationInvitation", entityId: invite.id,
        metadata: { reason: "REPLACED", replacementId: replacement.id, secret: "must-not-display" },
      } }),
      prisma.auditLog.create({ data: {
        organizationId: organization.id, userId: actor.id, action: "ORGANIZATION_INVITATION_CREATED",
        entity: "OrganizationInvitation", entityId: replacement.id,
        metadata: { replacedInvitationId: invite.id, secret: "must-not-display" },
      } }),
      prisma.auditLog.create({ data: {
        organizationId: organization.id, userId: actor.id, action: "ACCOUNT_SIGNED_IN",
        entity: "User", entityId: actor.id,
      } }),
      prisma.auditLog.create({ data: {
        organizationId: organization.id, userId: actor.id, action: "ACCOUNT_SIGNED_OUT",
        entity: "User", entityId: actor.id,
      } }),
    ]);
    const events = await listAccessAudit(organization.id);
    assert.equal(events.length, 6);
    assert.equal((await listAccessAudit(organization.id, { limit: 1 })).length, 1);
    assert.equal((await listAccessAudit(organization.id, { from: new Date(Date.now() + 60_000) })).length, 0);
    const roleEvent = events.find((event) => event.action === "Papel alterado");
    const inviteEvent = events.find((event) => event.action === "Convite criado" && event.details === null);
    assert.equal(roleEvent?.actor, `Responsável <${actor.email}>`);
    assert.equal(roleEvent?.target, target.email);
    assert.equal(roleEvent?.details, "CLIENT → TECHNICIAN");
    assert.equal(inviteEvent?.target, invite.email);
    assert.equal(events.find((event) => event.action === "Convite revogado")?.details, "Substituído; link anterior invalidado");
    assert.equal(events.find((event) => event.action === "Convite criado" && event.details !== null)?.details, "Novo link após correção");
    assert.equal(events.find((event) => event.action === "Entrada no portal")?.target, actor.email);
    assert.equal(events.find((event) => event.action === "Saída do portal")?.target, actor.email);
    assert.ok(events.every((event) => !event.actor.includes("must-not-display")));
    assert.equal(JSON.stringify(events).includes("must-not-display"), false);
    assert.equal(JSON.stringify(events).includes("private-token-never-display"), false);
    assert.equal(JSON.stringify(events).includes("private-digest"), false);
    assert.equal(JSON.stringify(events).includes("replacement-digest"), false);
    assert.equal(JSON.stringify(events).includes(replacement.id), false);
    const outsiderEvents = await listAccessAudit(other.id);
    assert.equal(outsiderEvents.length, 1);
    assert.equal(outsiderEvents[0].target, "Registro removido");
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [organization.id, other.id] } } });
    await Promise.all([prisma.organization.delete({ where: { id: organization.id } }), prisma.organization.delete({ where: { id: other.id } })]);
    await prisma.user.deleteMany({ where: { id: { in: [actor.id, target.id] } } });
  }
});

test("own security history is bounded across organizations and never includes another person's activity", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const [first, second] = await Promise.all([
    prisma.organization.create({ data: { name: "My first", slug: `own-first-${suffix}` } }),
    prisma.organization.create({ data: { name: "My second", slug: `own-second-${suffix}` } }),
  ]);
  const [user, other] = await Promise.all([
    prisma.user.create({ data: { email: `mine-${suffix}@example.test` } }),
    prisma.user.create({ data: { email: `other-${suffix}@example.test` } }),
  ]);
  try {
    await prisma.auditLog.createMany({ data: Array.from({ length: 21 }, (_, index) => ({
      organizationId: index % 2 ? first.id : second.id,
      userId: user.id, action: index % 2 ? "ACCOUNT_SIGNED_IN" : "USER_SESSIONS_REVOKED",
      entity: "User", entityId: user.id, metadata: { secret: "never-show" },
      createdAt: new Date(Date.UTC(2026, 9, 1, 12, index)),
    })) });
    await prisma.auditLog.createMany({ data: [
      { organizationId: first.id, userId: other.id, action: "ACCOUNT_SIGNED_IN", entity: "User", entityId: other.id },
      { organizationId: first.id, userId: user.id, action: "ACCOUNT_SIGNED_IN", entity: "User", entityId: other.id },
      { organizationId: first.id, userId: user.id, action: "UNRELATED_SYSTEM_EVENT", entity: "User", entityId: user.id },
    ] });
    const activity = await listOwnSecurityActivity(user.id);
    assert.equal(activity.length, 20);
    assert.equal(activity[0].action, "Sessões encerradas");
    assert.equal(activity[0].organizationName, "My second");
    assert.equal(activity[1].organizationName, "My first");
    assert.ok(activity[0].createdAt > activity[19].createdAt);
    assert.equal(JSON.stringify(activity).includes("never-show"), false);
    assert.equal(JSON.stringify(activity).includes(other.id), false);
    assert.equal((await listOwnSecurityActivity(other.id)).length, 1);
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [first.id, second.id] } } });
    await Promise.all([prisma.organization.delete({ where: { id: first.id } }), prisma.organization.delete({ where: { id: second.id } })]);
    await prisma.user.deleteMany({ where: { id: { in: [user.id, other.id] } } });
  }
});
