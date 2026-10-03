import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { getOrganizationOnboardingAccess } from "./onboarding";

test("onboarding counts only current-company active users and valid pending invitations", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const organizations = await Promise.all(["current", "other"].map((kind) =>
    prisma.organization.create({ data: { name: kind, slug: `onboarding-${kind}-${suffix}` } })));
  const [company, other] = organizations;
  const users = await Promise.all(["admin", "active", "suspended", "inactive", "outsider"].map((kind) =>
    prisma.user.create({ data: { email: `${kind}-onboarding-${suffix}@example.test`, active: kind !== "inactive" } })));
  const [admin, active, suspended, inactive, outsider] = users;
  try {
    await prisma.membership.createMany({ data: [
      { userId: admin.id, organizationId: company.id, role: "ADMIN" },
      { userId: suspended.id, organizationId: company.id, role: "CLIENT", active: false },
      { userId: inactive.id, organizationId: company.id, role: "CLIENT" },
      { userId: outsider.id, organizationId: other.id, role: "CLIENT" },
    ] });
    const read = () => getOrganizationOnboardingAccess(company.id, admin.id);
    assert.deepEqual(await read(), { activeOtherUsers: 0, pendingInvitations: 0 });
    const future = new Date(Date.now() + 60_000);
    const past = new Date(Date.now() - 60_000);
    const pending = await prisma.organizationInvitation.create({ data: {
      organizationId: company.id, invitedById: admin.id, name: "Pending", email: active.email,
      role: "CLIENT", tokenHash: randomUUID(), expiresAt: future,
    } });
    await prisma.organizationInvitation.createMany({ data: [
      { organizationId: company.id, expiresAt: past },
      { organizationId: company.id, expiresAt: future, acceptedAt: past },
      { organizationId: company.id, expiresAt: future, revokedAt: past },
      { organizationId: other.id, expiresAt: future },
    ].map((data) => ({
      ...data, invitedById: admin.id, name: "Other invite", email: `invite-${randomUUID()}@example.test`,
      role: "CLIENT", tokenHash: randomUUID(),
    })) });
    assert.deepEqual(await read(), { activeOtherUsers: 0, pendingInvitations: 1 });
    await prisma.organizationInvitation.update({ where: { id: pending.id }, data: { acceptedAt: new Date() } });
    await prisma.membership.create({ data: { userId: active.id, organizationId: company.id, role: "CLIENT" } });
    assert.deepEqual(await read(), { activeOtherUsers: 1, pendingInvitations: 0 });
    await prisma.organization.update({ where: { id: company.id }, data: { active: false } });
    assert.deepEqual(await read(), { activeOtherUsers: 0, pendingInvitations: 0 });
  } finally {
    await prisma.organization.deleteMany({ where: { id: { in: organizations.map((organization) => organization.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  }
});
