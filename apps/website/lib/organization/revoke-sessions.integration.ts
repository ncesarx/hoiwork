import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { getActiveMembership } from "./access";
import { listAccessAudit } from "./access-audit";
import { revokeOwnSessions, SessionRevocationError } from "./revoke-sessions";

test("session revocation verifies the password and invalidates sessions across organizations without changing it", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const [first, second] = await Promise.all([
    prisma.organization.create({ data: { name: "One", slug: `revoke-one-${suffix}` } }),
    prisma.organization.create({ data: { name: "Two", slug: `revoke-two-${suffix}` } }),
  ]);
  const passwordHash = await hash("current-password-123", 12);
  const user = await prisma.user.create({ data: { email: `sessions-${suffix}@example.test`, passwordHash } });
  try {
    await Promise.all([
      prisma.membership.create({ data: { organizationId: first.id, userId: user.id, role: "CLIENT" } }),
      prisma.membership.create({ data: { organizationId: second.id, userId: user.id, role: "TECHNICIAN" } }),
    ]);
    const revoke = (organizationId: string, currentPassword: string, sessionVersion = 0) => revokeOwnSessions({
      organizationId, userId: user.id, sessionVersion, currentPassword,
    });
    await assert.rejects(revoke(first.id, "wrong-password-123"),
      (error) => error instanceof SessionRevocationError && error.status === 403);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion, 0);
    assert.deepEqual(await revoke(second.id, "current-password-123"), { sessionVersion: 1 });
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(saved.passwordHash, passwordHash);
    assert.equal(await compare("current-password-123", saved.passwordHash!), true);
    assert.equal((await getActiveMembership(user.id, first.id))?.user.sessionVersion, 1);
    assert.equal((await getActiveMembership(user.id, second.id))?.user.sessionVersion, 1);
    await assert.rejects(revoke(first.id, "current-password-123"),
      (error) => error instanceof SessionRevocationError && error.status === 409);
    assert.equal((await listAccessAudit(second.id))[0].action, "Sessões encerradas");
    assert.equal((await listAccessAudit(second.id))[0].target, user.email);
    assert.equal((await listAccessAudit(first.id)).length, 0);
    assert.equal(await prisma.auditLog.count({ where: { organizationId: second.id, action: "USER_SESSIONS_REVOKED" } }), 1);
    assert.equal(JSON.stringify(await prisma.auditLog.findMany({ where: { organizationId: second.id } })).includes("current-password-123"), false);
    await prisma.membership.update({
      where: { userId_organizationId: { userId: user.id, organizationId: second.id } }, data: { active: false },
    });
    await assert.rejects(revoke(second.id, "current-password-123", 1),
      (error) => error instanceof SessionRevocationError && error.status === 403);
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [first.id, second.id] } } });
    await Promise.all([prisma.organization.delete({ where: { id: first.id } }), prisma.organization.delete({ where: { id: second.id } })]);
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("two session revocations from the same session have exactly one winner", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const organization = await prisma.organization.create({ data: { name: "Race", slug: `revoke-race-${suffix}` } });
  const user = await prisma.user.create({ data: {
    email: `race-${suffix}@example.test`, passwordHash: await hash("current-password-123", 12),
  } });
  try {
    await prisma.membership.create({ data: { organizationId: organization.id, userId: user.id, role: "CLIENT" } });
    const input = { organizationId: organization.id, userId: user.id, sessionVersion: 0, currentPassword: "current-password-123" };
    const results = await Promise.allSettled([revokeOwnSessions(input), revokeOwnSessions(input)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected" && result.reason instanceof SessionRevocationError && result.reason.status === 409).length, 1);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion, 1);
    assert.equal(await prisma.auditLog.count({ where: { organizationId: organization.id, action: "USER_SESSIONS_REVOKED" } }), 1);
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});
