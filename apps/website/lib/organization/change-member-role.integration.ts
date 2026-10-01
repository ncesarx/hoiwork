import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { changeMemberRole, MembershipRoleChangeError } from "./change-member-role";

test("role changes are tenant-scoped, audited, and reject stale or unauthorized edits", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const [organization, other] = await Promise.all([
    prisma.organization.create({ data: { name: "Acessos", slug: `acessos-${suffix}` } }),
    prisma.organization.create({ data: { name: "Outra", slug: `outra-${suffix}` } }),
  ]);
  const userIds: string[] = [];
  try {
    const users = await Promise.all(["admin", "member", "other"].map(async (name) => {
      const user = await prisma.user.create({ data: { email: `${name}-${suffix}@example.test` } });
      userIds.push(user.id);
      return user;
    }));
    const [admin, member, outsider] = users;
    const [adminLink, memberLink, otherLink] = await Promise.all([
      prisma.membership.create({ data: { organizationId: organization.id, userId: admin.id, role: "ADMIN" } }),
      prisma.membership.create({ data: { organizationId: organization.id, userId: member.id, role: "CLIENT" } }),
      prisma.membership.create({ data: { organizationId: other.id, userId: outsider.id, role: "ADMIN" } }),
    ]);
    const edit = (actorUserId: string, membershipId: string, expectedRole: "ADMIN" | "CLIENT" | "TECHNICIAN", role: "ADMIN" | "CLIENT" | "TECHNICIAN") =>
      changeMemberRole({ organizationId: organization.id, actorUserId, membershipId, expectedRole, role });

    await assert.rejects(edit(member.id, adminLink.id, "ADMIN", "CLIENT"), (error) => error instanceof MembershipRoleChangeError && error.status === 403);
    await assert.rejects(edit(admin.id, otherLink.id, "ADMIN", "CLIENT"), (error) => error instanceof MembershipRoleChangeError && error.status === 404);
    await assert.rejects(edit(admin.id, adminLink.id, "ADMIN", "CLIENT"), (error) => error instanceof MembershipRoleChangeError && error.status === 409);

    assert.deepEqual(await edit(admin.id, memberLink.id, "CLIENT", "TECHNICIAN"), { changed: true, role: "TECHNICIAN" });
    await assert.rejects(edit(admin.id, memberLink.id, "CLIENT", "ADMIN"), (error) => error instanceof MembershipRoleChangeError && error.status === 409);
    const audit = await prisma.auditLog.findMany({ where: { organizationId: organization.id, action: "MEMBERSHIP_ROLE_CHANGED" } });
    assert.equal(audit.length, 1);
    assert.equal(audit[0].entityId, memberLink.id);
    assert.deepEqual(audit[0].metadata, { targetUserId: member.id, previousRole: "CLIENT", newRole: "TECHNICIAN" });
    assert.equal((await prisma.membership.findUniqueOrThrow({ where: { id: otherLink.id } })).role, "ADMIN");
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
    await Promise.all([
      prisma.organization.delete({ where: { id: organization.id } }),
      prisma.organization.delete({ where: { id: other.id } }),
    ]);
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});

test("concurrent admins cannot demote each other and leave no ADMIN", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const organization = await prisma.organization.create({ data: { name: "Concorrência", slug: `concorrencia-${suffix}` } });
  const users = await Promise.all(["first", "second"].map((name) =>
    prisma.user.create({ data: { email: `${name}-${suffix}@example.test` } }),
  ));
  try {
    const [first, second] = await Promise.all(users.map((user) =>
      prisma.membership.create({ data: { organizationId: organization.id, userId: user.id, role: "ADMIN" } }),
    ));
    const results = await Promise.allSettled([
      changeMemberRole({ organizationId: organization.id, actorUserId: users[0].id, membershipId: second.id, expectedRole: "ADMIN", role: "CLIENT" }),
      changeMemberRole({ organizationId: organization.id, actorUserId: users[1].id, membershipId: first.id, expectedRole: "ADMIN", role: "CLIENT" }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected" && result.reason instanceof MembershipRoleChangeError && result.reason.status === 403).length, 1);
    assert.equal(await prisma.membership.count({ where: { organizationId: organization.id, role: "ADMIN" } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { organizationId: organization.id, action: "MEMBERSHIP_ROLE_CHANGED" } }), 1);
  } finally {
    await prisma.auditLog.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  }
});
