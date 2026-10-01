import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { listAccessAudit, listOwnSecurityActivity } from "./access-audit";
import { verifyCredentialLogin } from "./credential-login";

test("failed credentials are throttled across concurrent attempts and expire after the window", async () => {
  requireDisposableDatabase();
  const organization = await prisma.organization.create({ data: {
    name: "Credential audit", slug: `credential-audit-${randomUUID()}`,
  } });
  const user = await prisma.user.create({ data: {
    email: `throttle-${randomUUID()}@example.test`,
    passwordHash: await hash("correct-password-123", 4),
  } });
  try {
    await prisma.membership.create({ data: {
      organizationId: organization.id, userId: user.id, role: "CLIENT",
    } });
    const failures = await Promise.all(Array.from({ length: 12 }, () =>
      verifyCredentialLogin(user.id, "incorrect-password-123")));
    assert.ok(failures.every((result) => result === null));
    const locked = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(locked.failedLoginAttempts, 10);
    assert.equal(await verifyCredentialLogin(user.id, "correct-password-123"), null);
    const throttled = await prisma.auditLog.findMany({ where: {
      action: "ACCOUNT_LOGIN_THROTTLED", entityId: user.id,
    } });
    assert.equal(throttled.length, 1);
    assert.equal(throttled[0].organizationId, organization.id);
    assert.equal(throttled[0].userId, null);
    assert.equal(throttled[0].metadata, null);
    assert.equal((await listOwnSecurityActivity(user.id))[0].action, "Acesso temporariamente bloqueado");
    const adminAudit = await listAccessAudit(organization.id);
    assert.equal(adminAudit[0].target, user.email);
    assert.equal(adminAudit[0].actor, "Acesso não autenticado");

    await prisma.user.update({ where: { id: user.id }, data: {
      lastFailedLoginAt: new Date(Date.now() - 16 * 60_000),
    } });
    assert.deepEqual(await verifyCredentialLogin(user.id, "correct-password-123"), { sessionVersion: 0 });
    const reset = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(reset.failedLoginAttempts, 0);
    assert.equal(reset.lastFailedLoginAt, null);
    assert.equal(await verifyCredentialLogin(user.id, "incorrect-password-123"), null);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).failedLoginAttempts, 1);
  } finally {
    await prisma.auditLog.deleteMany({ where: { entityId: user.id, action: "ACCOUNT_LOGIN_THROTTLED" } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("a locked account cannot authenticate with a stale password after it changes", async () => {
  requireDisposableDatabase();
  const user = await prisma.user.create({ data: {
    email: `throttle-change-${randomUUID()}@example.test`,
    passwordHash: await hash("new-password-123", 4),
    sessionVersion: 2,
    failedLoginAttempts: 9,
    lastFailedLoginAt: new Date(),
  } });
  try {
    assert.equal(await verifyCredentialLogin(user.id, "old-password-123"), null);
    assert.equal(await verifyCredentialLogin(user.id, "new-password-123"), null);
    await prisma.user.update({ where: { id: user.id }, data: {
      lastFailedLoginAt: new Date(Date.now() - 16 * 60_000),
    } });
    assert.deepEqual(await verifyCredentialLogin(user.id, "new-password-123"), { sessionVersion: 2 });
  } finally {
    await prisma.auditLog.deleteMany({ where: { entityId: user.id, action: "ACCOUNT_LOGIN_THROTTLED" } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});
