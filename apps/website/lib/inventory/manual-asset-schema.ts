import { z } from "zod";

export const manualAssetTypes = [
  { value: "SERVER", label: "Servidor" },
  { value: "WORKSTATION", label: "Computador" },
  { value: "PRINTER", label: "Impressora" },
  { value: "FIREWALL", label: "Firewall" },
  { value: "SWITCH", label: "Switch" },
  { value: "STORAGE", label: "Armazenamento" },
  { value: "NETWORK", label: "Equipamento de rede" },
  { value: "OTHER", label: "Outro" },
] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);

export const manualAssetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["SERVER", "WORKSTATION", "PRINTER", "FIREWALL", "SWITCH", "STORAGE", "NETWORK", "OTHER"]),
  manufacturer: optionalText(120), model: optionalText(120), serialNumber: optionalText(120),
  ipAddress: optionalText(45), location: optionalText(200),
  requestId: z.string().uuid().transform((value) => value.toLowerCase()),
}).strict();
