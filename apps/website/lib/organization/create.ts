import { prisma } from "@/lib/prisma";
import { organizationProfileSchema } from "./profile";
import { z } from "zod";

export const organizationCreationSchema = organizationProfileSchema.extend({
  requestId: z.string().uuid().transform((value) => value.toLowerCase()),
});

export class OrganizationCreationError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 409) {
    super(message);
  }
}

export async function createClientOrganization(input: {
  sourceOrganizationId: string; actorUserId: string; name: string; requestId: string;
}) {
  const parsed = organizationCreationSchema.safeParse({ name: input.name, requestId: input.requestId });
  if (!parsed.success) throw new OrganizationCreationError("Informe o nome da empresa com até 120 caracteres.", 400);

  return prisma.$transaction(async (tx) => {
    // Serialize retries even when the first response changed the selected organization.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('hoiwork:organization-create'), hashtext(${parsed.data.requestId}))::text`;
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
    const slug = `empresa-${parsed.data.requestId}`;
    const existing = await tx.organization.findUnique({ where: { slug }, select: { id: true, name: true, active: true } });
    if (existing) {
      const creation = await tx.auditLog.findFirst({ where: {
        organizationId: existing.id, entityId: existing.id, entity: "Organization",
        action: "ORGANIZATION_CREATED", userId: input.actorUserId,
      }, select: { metadata: true } });
      const metadata = creation?.metadata;
      const ownsRequest = metadata && typeof metadata === "object" && !Array.isArray(metadata) &&
        "requestId" in metadata && metadata.requestId === parsed.data.requestId &&
        "name" in metadata && metadata.name === parsed.data.name;
      const targetMembership = await tx.membership.findUnique({ where: {
        userId_organizationId: { userId: input.actorUserId, organizationId: existing.id },
      }, select: { active: true, role: true } });
      if (!ownsRequest || !existing.active || !targetMembership?.active || targetMembership.role !== "ADMIN") {
        throw new OrganizationCreationError("Este pedido não pode ser reutilizado. Confira as empresas cadastradas e atualize a página.", 409);
      }
      return { id: existing.id, name: existing.name };
    }
    const organization = await tx.organization.create({ data: {
      name: parsed.data.name, slug,
      memberships: { create: { userId: input.actorUserId, role: "ADMIN" } },
    }, select: { id: true, name: true } });
    await tx.auditLog.create({ data: {
      organizationId: organization.id, userId: input.actorUserId,
      action: "ORGANIZATION_CREATED", entity: "Organization", entityId: organization.id,
      metadata: { name: organization.name, requestId: parsed.data.requestId },
    } });
    return organization;
  });
}
