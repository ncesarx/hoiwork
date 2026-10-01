import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { listAccessAudit } from "./access-audit";
import { changeOwnPassword, PasswordChangeError } from "./change-password";

test("password change checks current password, rotates session version, and audits without secrets", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const organization = await prisma.organization.create({ data: { name: "Conta", slug: `account-${suffix}` } });
  const user = await prisma.user.create({ data: {
    email: `account-${suffix}@example.test`, passwordHash: await hash("old-password-123", 12),
  } });
  try {
    const membership = await prisma.membership.create({ data: { organizationId: organization.id, userId: user.id, role: "CLIENT" } });
    const change = (currentPassword: string, newPassword: string, sessionVersion = 0) =>
      changeOwnPassword({ organizationId: organization.id, userId: user.id, sessionVersion, currentPassword, newPassword });

    await assert.rejects(change("wrong-password", "new-password-456"), (error) => error instanceof PasswordChangeError && error.status === 403);
    await assert.rejects(change("old-password-123", "old-password-123"), (error) => error instanceof PasswordChangeError && error.status === 400);
    assert.deepEqual(await change("old-password-123", "new-password-456"), { sessionVersion: 1 });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(await compare("old-password-123", updated.passwordHash!), false);
    assert.equal(await compare("new-password-456", updated.passwordHash!), true);
    assert.equal(updated.sessionVersion, 1);
    await assert.rejects(change("new-password-456", "another-password-789"), (error) => error instanceof PasswordChangeError && error.status === 409);
    assert.equal((await listAccessAudit(organization.id))[0].target, user.email);
    const audit = await prisma.auditLog.findMany({ where: { organizationId: organization.id, action: "USER_PASSWORD_CHANGED" } });
    assert.equal(audit.length, 1);
    assert.equal(audit[0].entityId, user.id);
    assert.equal(JSON.stringify(audit).includes("new-password-456"), false);

    await prisma.membership.update({ where: { id: membership.id }, data: { active: false } });
    await assert.rejects(change("new-password-456", "another-password-789", 1), (error) => error instanceof PasswordChangeError && error.status === 403);
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("two password changes from one session cannot both succeed", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const organization = await prisma.organization.create({ data: { name: "Concorrência", slug: `account-race-${suffix}` } });
  const user = await prisma.user.create({ data: {
    email: `race-${suffix}@example.test`, passwordHash: await hash("old-password-123", 12),
  } });
  try {
    await prisma.membership.create({ data: { organizationId: organization.id, userId: user.id, role: "CLIENT" } });
    const results = await Promise.allSettled(["first-password-456", "second-password-456"].map((newPassword) =>
      changeOwnPassword({ organizationId: organization.id, userId: user.id, sessionVersion: 0, currentPassword: "old-password-123", newPassword }),
    ));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected" && result.reason instanceof PasswordChangeError && result.reason.status === 409).length, 1);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion, 1);
    assert.equal(await prisma.auditLog.count({ where: { organizationId: organization.id, action: "USER_PASSWORD_CHANGED" } }), 1);
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});
