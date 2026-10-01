import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { listAccessAudit } from "./access-audit";

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
    ]);
    const events = await listAccessAudit(organization.id);
    assert.equal(events.length, 2);
    const roleEvent = events.find((event) => event.action === "Papel alterado");
    const inviteEvent = events.find((event) => event.action === "Convite criado");
    assert.equal(roleEvent?.actor, "Responsável");
    assert.equal(roleEvent?.target, target.email);
    assert.equal(roleEvent?.details, "CLIENT → TECHNICIAN");
    assert.equal(inviteEvent?.target, invite.email);
    assert.equal(JSON.stringify(events).includes("must-not-display"), false);
    assert.equal(JSON.stringify(events).includes("private-token-never-display"), false);
    assert.equal(JSON.stringify(events).includes("private-digest"), false);
    const outsiderEvents = await listAccessAudit(other.id);
    assert.equal(outsiderEvents.length, 1);
    assert.equal(outsiderEvents[0].target, "Registro removido");
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [organization.id, other.id] } } });
    await Promise.all([prisma.organization.delete({ where: { id: organization.id } }), prisma.organization.delete({ where: { id: other.id } })]);
    await prisma.user.deleteMany({ where: { id: { in: [actor.id, target.id] } } });
  }
});
