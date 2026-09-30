import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { getActiveMembership, getOrganizationMembers } from "./access";

test("organization access uses current membership and never returns another tenant's users", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const [first, second] = await Promise.all([
    prisma.organization.create({ data: { name: "Primeira", slug: `primeira-${suffix}` } }),
    prisma.organization.create({ data: { name: "Segunda", slug: `segunda-${suffix}` } }),
  ]);
  let firstUserId: string | undefined;
  let secondUserId: string | undefined;

  try {
    const [firstUser, secondUser] = await Promise.all([
      prisma.user.create({ data: { email: `admin-${suffix}@example.test`, name: "Admin 1", passwordHash: "not-a-real-password" } }),
      prisma.user.create({ data: { email: `admin-2-${suffix}@example.test`, name: "Admin 2" } }),
    ]);
    firstUserId = firstUser.id;
    secondUserId = secondUser.id;
    await Promise.all([
      prisma.membership.create({ data: { userId: firstUser.id, organizationId: first.id, role: "ADMIN" } }),
      prisma.membership.create({ data: { userId: secondUser.id, organizationId: second.id, role: "ADMIN" } }),
    ]);

    const members = await getOrganizationMembers(first.id);
    assert.equal(members.length, 1);
    assert.equal(members[0].user.email, firstUser.email);
    assert.deepEqual(Object.keys(members[0].user).sort(), ["active", "email", "name"]);
    assert.equal(await getActiveMembership(secondUser.id, first.id), null);
    assert.equal((await getActiveMembership(firstUser.id, first.id))?.role, "ADMIN");

    await prisma.membership.update({
      where: { userId_organizationId: { userId: firstUser.id, organizationId: first.id } },
      data: { role: "CLIENT" },
    });
    assert.equal((await getActiveMembership(firstUser.id, first.id))?.role, "CLIENT");

    await prisma.user.update({ where: { id: firstUser.id }, data: { active: false } });
    assert.equal(await getActiveMembership(firstUser.id, first.id), null);
    await prisma.user.update({ where: { id: firstUser.id }, data: { active: true } });
    await prisma.organization.update({ where: { id: first.id }, data: { active: false } });
    assert.equal(await getActiveMembership(firstUser.id, first.id), null);
  } finally {
    await Promise.all([
      prisma.organization.delete({ where: { id: first.id } }),
      prisma.organization.delete({ where: { id: second.id } }),
    ]);
    if (firstUserId) await prisma.user.delete({ where: { id: firstUserId } });
    if (secondUserId) await prisma.user.delete({ where: { id: secondUserId } });
  }
});
