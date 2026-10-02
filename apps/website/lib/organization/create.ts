import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { organizationProfileSchema } from "./profile";

export class OrganizationCreationError extends Error {
  constructor(message: string, readonly status: 400 | 403) {
    super(message);
  }
}

export async function createClientOrganization(input: {
  sourceOrganizationId: string; actorUserId: string; name: string;
}) {
  const parsed = organizationProfileSchema.safeParse({ name: input.name });
  if (!parsed.success) throw new OrganizationCreationError("Informe o nome da empresa com até 120 caracteres.", 400);

  return prisma.$transaction(async (tx) => {
    const [source] = await tx.$queryRaw<Array<{ active: boolean }>>`
      SELECT "active" FROM "Organization" WHERE "id" = ${input.sourceOrganizationId} FOR UPDATE
    `;
    const actor = await tx.membership.findUnique({
      where: { userId_organizationId: { userId: input.actorUserId, organizationId: input.sourceOrganizationId } },
      include: { user: { select: { active: true } } },
    });
    if (!source?.active || actor?.role !== "ADMIN" || !actor.active || !actor.user.active) {
      throw new OrganizationCreationError("Somente ADMIN ativo pode cadastrar uma empresa.", 403);
    }
    const organization = await tx.organization.create({ data: {
      name: parsed.data.name, slug: `empresa-${randomUUID()}`,
      memberships: { create: { userId: input.actorUserId, role: "ADMIN" } },
    }, select: { id: true, name: true } });
    await tx.auditLog.create({ data: {
      organizationId: organization.id, userId: input.actorUserId,
      action: "ORGANIZATION_CREATED", entity: "Organization", entityId: organization.id,
      metadata: { name: organization.name },
    } });
    return organization;
  });
}
