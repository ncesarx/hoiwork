import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DEMO_ASSET_IDS } from "./demo-assets";
import { ManualAssetError } from "./manual-assets";
import { buildManualAssetCsv } from "./manual-asset-csv";

const filtersSchema = z.object({
  q: z.string().trim().max(200).default(""),
  type: z.enum(["ALL", "NODE", "VM", "LXC", "SERVER", "WORKSTATION", "PRINTER", "FIREWALL", "SWITCH", "STORAGE", "NETWORK", "OTHER"]).default("ALL"),
}).strict();

export async function exportManualAssets(organizationId: string, actorUserId: string, input: unknown) {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: actorUserId, organizationId } },
    include: { user: { select: { active: true } }, organization: { select: { active: true, name: true } } },
  });
  if (!membership?.active || !membership.user.active || !membership.organization.active || !["ADMIN", "TECHNICIAN"].includes(membership.role)) {
    throw new ManualAssetError("Somente ADMIN ou TECHNICIAN ativo pode exportar equipamentos.", 403);
  }
  const parsed = filtersSchema.safeParse(input);
  if (!parsed.success) throw new ManualAssetError("Revise a pesquisa e o tipo antes de exportar.", 400);
  const { q, type } = parsed.data;
  const rows = await prisma.asset.findMany({
    where: {
      organizationId, id: { notIn: DEMO_ASSET_IDS }, metadata: { path: ["source"], equals: "MANUAL" },
      ...(type !== "ALL" ? { type } : {}),
      ...(q ? { OR: ["name", "manufacturer", "model", "serialNumber", "ipAddress", "location"].map((field) => ({
        [field]: { contains: q, mode: "insensitive" as const },
      })) } : {}),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }], take: 1001,
    select: { name: true, type: true, manufacturer: true, model: true, serialNumber: true,
      ipAddress: true, location: true, status: true, updatedAt: true },
  });
  if (rows.length > 1000) throw new ManualAssetError("Mais de 1000 equipamentos encontrados. Refine os filtros para baixar um arquivo completo.", 400);
  return buildManualAssetCsv(membership.organization.name, rows);
}
