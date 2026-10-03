import { prisma } from "@/lib/prisma";
import { isManualAssetMetadata, manualAssetTypes } from "./manual-asset-schema";
import { ManualAssetError } from "./manual-assets";

const fields = [
  ["name", "Nome"], ["type", "Tipo"], ["manufacturer", "Fabricante"], ["model", "Modelo"],
  ["serialNumber", "Número de série"], ["ipAddress", "IP"], ["location", "Localização"],
] as const;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function displayValue(field: string, value: string | null) {
  if (value === null || value === "") return "Não informado";
  if (field === "type") return manualAssetTypes.find((type) => type.value === value)?.label ?? "Tipo não reconhecido";
  return value.slice(0, 200);
}

export function formatManualAssetChanges(metadata: unknown) {
  const data = record(metadata);
  if (data?.source !== "MANUAL") return [];
  const changes = record(data.changes);
  if (!changes) return [];
  return fields.flatMap(([key, label]) => {
    const change = record(changes[key]);
    if (!change || !(typeof change.previous === "string" || change.previous === null) ||
      !(typeof change.next === "string" || change.next === null)) return [];
    return [{ field: label, previous: displayValue(key, change.previous), next: displayValue(key, change.next) }];
  });
}

export async function getManualAssetHistory(organizationId: string, actorUserId: string, assetId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: actorUserId, organizationId } },
    include: { user: { select: { active: true } }, organization: { select: { active: true } } },
  });
  if (!membership?.active || !membership.user.active || !membership.organization.active || !["ADMIN", "TECHNICIAN"].includes(membership.role)) {
    throw new ManualAssetError("Somente ADMIN ou TECHNICIAN ativo pode consultar o histórico.", 403);
  }
  const asset = await prisma.asset.findFirst({ where: { id: assetId, organizationId }, select: { metadata: true } });
  if (!asset || !isManualAssetMetadata(asset.metadata)) throw new ManualAssetError("Equipamento manual não encontrado nesta empresa.", 404);
  const events = await prisma.auditLog.findMany({
    where: { organizationId, entity: "Asset", entityId: assetId, action: { in: ["ASSET_CREATED", "ASSET_UPDATED"] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 21,
    select: { id: true, createdAt: true, action: true, metadata: true, user: { select: { name: true } } },
  });
  return {
    hasMore: events.length > 20,
    events: events.slice(0, 20).map((event) => ({
      id: event.id, createdAt: event.createdAt.toISOString(),
      action: event.action === "ASSET_CREATED" ? "Equipamento cadastrado" : "Equipamento alterado",
      actor: event.user ? event.user.name?.trim() || "Usuário sem nome" : "Usuário removido",
      changes: event.action === "ASSET_UPDATED" ? formatManualAssetChanges(event.metadata) : [],
    })),
  };
}
