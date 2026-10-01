import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { getActiveMembership } from "./access";
import { changeMemberAccess, MembershipAccessError } from "./change-member-access";

test("member suspension is tenant-scoped, audited, and takes effect on existing sessions", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const [organization, other] = await Promise.all([
    prisma.organization.create({ data: { name: "Acessos", slug: `access-${suffix}` } }),
    prisma.organization.create({ data: { name: "Outro", slug: `other-${suffix}` } }),
  ]);
  const [admin, member, outsider] = await Promise.all(["admin", "member", "outsider"].map((label) =>
    prisma.user.create({ data: { email: `${label}-${suffix}@example.test` } }),
  ));
  try {
    const [adminLink, memberLink, otherLink] = await Promise.all([
      prisma.membership.create({ data: { userId: admin.id, organizationId: organization.id, role: "ADMIN" } }),
      prisma.membership.create({ data: { userId: member.id, organizationId: organization.id, role: "CLIENT" } }),
      prisma.membership.create({ data: { userId: member.id, organizationId: other.id, role: "CLIENT" } }),
      prisma.membership.create({ data: { userId: outsider.id, organizationId: other.id, role: "ADMIN" } }),
    ]);
    const change = (actorUserId: string, membershipId: string, expectedActive: boolean, active: boolean) =>
      changeMemberAccess({ organizationId: organization.id, actorUserId, membershipId, expectedActive, active });

    await assert.rejects(change(member.id, adminLink.id, true, false), (error) => error instanceof MembershipAccessError && error.status === 403);
    await assert.rejects(change(outsider.id, memberLink.id, true, false), (error) => error instanceof MembershipAccessError && error.status === 403);
    await assert.rejects(change(admin.id, otherLink.id, true, false), (error) => error instanceof MembershipAccessError && error.status === 404);
    await assert.rejects(change(admin.id, adminLink.id, true, false), (error) => error instanceof MembershipAccessError && error.status === 409);

    assert.deepEqual(await change(admin.id, memberLink.id, true, false), { changed: true, active: false });
    assert.equal(await getActiveMembership(member.id, organization.id), null);
    assert.ok(await getActiveMembership(member.id, other.id));
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).active, true);
    await assert.rejects(change(admin.id, memberLink.id, true, true), (error) => error instanceof MembershipAccessError && error.status === 409);
    assert.deepEqual(await change(admin.id, memberLink.id, false, true), { changed: true, active: true });
    assert.ok(await getActiveMembership(member.id, organization.id));
    const audit = await prisma.auditLog.findMany({ where: { organizationId: organization.id, entityId: memberLink.id }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(audit.map((event) => event.action), ["MEMBERSHIP_ACCESS_SUSPENDED", "MEMBERSHIP_ACCESS_RESTORED"]);
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [organization.id, other.id] } } });
    await Promise.all([prisma.organization.delete({ where: { id: organization.id } }), prisma.organization.delete({ where: { id: other.id } })]);
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, member.id, outsider.id] } } });
  }
});

test("concurrent admins cannot suspend each other and leave no active ADMIN", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const organization = await prisma.organization.create({ data: { name: "Admin", slug: `admin-access-${suffix}` } });
  const users = await Promise.all(["first", "second"].map((label) =>
    prisma.user.create({ data: { email: `${label}-${suffix}@example.test` } }),
  ));
  try {
    const [first, second] = await Promise.all(users.map((user) =>
      prisma.membership.create({ data: { organizationId: organization.id, userId: user.id, role: "ADMIN" } }),
    ));
    const results = await Promise.allSettled([
      changeMemberAccess({ organizationId: organization.id, actorUserId: users[0].id, membershipId: second.id, expectedActive: true, active: false }),
      changeMemberAccess({ organizationId: organization.id, actorUserId: users[1].id, membershipId: first.id, expectedActive: true, active: false }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected" && result.reason instanceof MembershipAccessError && result.reason.status === 403).length, 1);
    assert.equal(await prisma.membership.count({ where: { organizationId: organization.id, role: "ADMIN", active: true } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { organizationId: organization.id, action: "MEMBERSHIP_ACCESS_SUSPENDED" } }), 1);
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  }
});
