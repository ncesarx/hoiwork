import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { verifyCredentialLogin } from "./credential-login";

test("failed credentials are throttled across concurrent attempts and expire after the window", async () => {
  requireDisposableDatabase();
  const user = await prisma.user.create({ data: {
    email: `throttle-${randomUUID()}@example.test`,
    passwordHash: await hash("correct-password-123", 4),
  } });
  try {
    const failures = await Promise.all(Array.from({ length: 12 }, () =>
      verifyCredentialLogin(user.id, "incorrect-password-123")));
    assert.ok(failures.every((result) => result === null));
    const locked = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(locked.failedLoginAttempts, 10);
    assert.equal(await verifyCredentialLogin(user.id, "correct-password-123"), null);

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
    await prisma.user.delete({ where: { id: user.id } });
  }
});
