import { isIP } from "node:net";
import { prisma } from "@/lib/prisma";
import { isManualAssetMetadata, manualAssetSchema, manualAssetUpdateSchema } from "./manual-asset-schema";

export class ManualAssetError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 409) { super(message); }
}

export async function updateManualAsset(organizationId: string, actorUserId: string, assetId: string, input: unknown) {
  const parsed = manualAssetUpdateSchema.safeParse(input);
  if (!parsed.success) throw new ManualAssetError("Revise os campos e atualize a página antes de salvar.", 400);
  const { expectedUpdatedAt, ...fields } = parsed.data;
  if (fields.ipAddress && !isIP(fields.ipAddress)) throw new ManualAssetError("Informe um endereço IPv4 ou IPv6 válido, ou deixe o IP vazio.", 400);

  return prisma.$transaction(async (tx) => {
    const [organization] = await tx.$queryRaw<Array<{ active: boolean }>>`
      SELECT "active" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE
    `;
    const membership = await tx.membership.findUnique({
      where: { userId_organizationId: { userId: actorUserId, organizationId } },
      include: { user: { select: { active: true } } },
    });
    if (!organization?.active || !membership?.active || !membership.user.active || !["ADMIN", "TECHNICIAN"].includes(membership.role)) {
      throw new ManualAssetError("Somente ADMIN ou TECHNICIAN ativo pode editar equipamentos.", 403);
    }
    const asset = await tx.asset.findFirst({ where: { id: assetId, organizationId } });
    if (!asset || !isManualAssetMetadata(asset.metadata)) {
      throw new ManualAssetError("Equipamento manual não encontrado nesta empresa.", 404);
    }
    const changes = Object.fromEntries(Object.entries(fields)
      .filter(([key, value]) => asset[key as keyof typeof fields] !== value)
      .map(([key, value]) => [key, { previous: asset[key as keyof typeof fields], next: value }]));
    // An identical retry after a lost response is already applied; do not audit it twice.
    if (Object.keys(changes).length === 0) return { id: asset.id, updatedAt: asset.updatedAt.toISOString() };
    if (asset.updatedAt.toISOString() !== expectedUpdatedAt) {
      throw new ManualAssetError("Este equipamento foi alterado por outra operação. Recarregue o inventário e revise os dados antes de salvar.", 409);
    }
    const updatedAt = new Date(Math.max(Date.now(), asset.updatedAt.getTime() + 1));
    const updated = await tx.asset.updateMany({
      where: { id: asset.id, organizationId, updatedAt: asset.updatedAt }, data: { ...fields, updatedAt },
    });
    if (updated.count !== 1) throw new ManualAssetError("Este equipamento foi alterado por outra operação. Recarregue o inventário.", 409);
    await tx.auditLog.create({ data: {
      organizationId, userId: actorUserId, action: "ASSET_UPDATED", entity: "Asset", entityId: asset.id,
      metadata: { source: "MANUAL", changes },
    } });
    return { id: asset.id, updatedAt: updatedAt.toISOString() };
  });
}

export async function createManualAsset(organizationId: string, actorUserId: string, input: unknown) {
  const parsed = manualAssetSchema.safeParse(input);
  if (!parsed.success) throw new ManualAssetError("Revise o nome, o tipo e os demais campos do equipamento.", 400);
  const { requestId, ...fields } = parsed.data;
  if (fields.ipAddress && !isIP(fields.ipAddress)) throw new ManualAssetError("Informe um endereço IPv4 ou IPv6 válido, ou deixe o IP vazio.", 400);

  return prisma.$transaction(async (tx) => {
    const [organization] = await tx.$queryRaw<Array<{ active: boolean }>>`
      SELECT "active" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE
    `;
    const membership = await tx.membership.findUnique({
      where: { userId_organizationId: { userId: actorUserId, organizationId } },
      include: { user: { select: { active: true } } },
    });
    if (!organization?.active || !membership?.active || !membership.user.active || !["ADMIN", "TECHNICIAN"].includes(membership.role)) {
      throw new ManualAssetError("Somente ADMIN ou TECHNICIAN ativo pode cadastrar equipamentos.", 403);
    }
    const id = `manual-${organizationId}-${requestId}`;
    const existing = await tx.asset.findUnique({ where: { id } });
    if (existing) {
      const metadata = existing.metadata;
      const ownsRequest = metadata && typeof metadata === "object" && !Array.isArray(metadata) &&
        "createdById" in metadata && metadata.createdById === actorUserId &&
        "requestId" in metadata && metadata.requestId === requestId;
      if (!ownsRequest || Object.entries(fields).some(([key, value]) => existing[key as keyof typeof fields] !== value)) {
        throw new ManualAssetError("Este pedido não pode ser reutilizado. Confira o inventário e atualize a página.", 409);
      }
      return { id: existing.id };
    }
    const asset = await tx.asset.create({ data: {
      id, organizationId, ...fields, status: "UNKNOWN",
      metadata: { source: "MANUAL", createdById: actorUserId, requestId },
    }, select: { id: true } });
    await tx.auditLog.create({ data: {
      organizationId, userId: actorUserId, action: "ASSET_CREATED", entity: "Asset", entityId: asset.id,
      metadata: { source: "MANUAL", name: fields.name, type: fields.type },
    } });
    return asset;
  });
}
