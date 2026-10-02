import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const organizationProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
}).strict();

export class OrganizationProfileError extends Error {
  constructor(message: string, readonly status: 400 | 403) {
    super(message);
  }
}

export async function updateOrganizationProfile(input: {
  organizationId: string; actorUserId: string; name: string;
}) {
  const parsed = organizationProfileSchema.safeParse({ name: input.name });
  if (!parsed.success) throw new OrganizationProfileError("Informe o nome da empresa com até 120 caracteres.", 400);

  return prisma.$transaction(async (tx) => {
    const [organization] = await tx.$queryRaw<Array<{ name: string; active: boolean }>>`
      SELECT "name", "active" FROM "Organization" WHERE "id" = ${input.organizationId} FOR UPDATE
    `;
    const actor = await tx.membership.findUnique({
      where: { userId_organizationId: { userId: input.actorUserId, organizationId: input.organizationId } },
      include: { user: { select: { active: true } } },
    });
    if (!organization?.active || actor?.role !== "ADMIN" || !actor.active || !actor.user.active) {
      throw new OrganizationProfileError("Somente ADMIN ativo pode alterar o nome da empresa.", 403);
    }
    if (organization.name === parsed.data.name) return { name: organization.name };
    const updated = await tx.organization.update({
      where: { id: input.organizationId }, data: { name: parsed.data.name }, select: { name: true },
    });
    await tx.auditLog.create({ data: {
      organizationId: input.organizationId, userId: input.actorUserId,
      action: "ORGANIZATION_PROFILE_UPDATED", entity: "Organization", entityId: input.organizationId,
      metadata: { previousName: organization.name, newName: updated.name },
    } });
    return updated;
  });
}
