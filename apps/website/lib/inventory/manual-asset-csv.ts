import { manualAssetTypes } from "./manual-asset-schema";

export type ManualAssetCsvRow = {
  name: string; type: string; manufacturer: string | null; model: string | null;
  serialNumber: string | null; ipAddress: string | null; location: string | null;
  status: string; updatedAt: Date;
};

function cell(value: string | null) {
  const singleLine = (value ?? "").replace(/[\r\n\u0000-\u001f]/g, " ");
  const safe = /^\s*[=+\-@]/.test(singleLine) ? `'${singleLine}` : singleLine;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function buildManualAssetCsv(companyName: string, rows: ManualAssetCsvRow[]) {
  const header = ["Empresa", "Nome", "Tipo", "Fabricante", "Modelo", "Número de série", "IP", "Localização", "Estado registrado", "Atualização (UTC)"];
  const lines = rows.map((row) => [
    companyName, row.name, manualAssetTypes.find((type) => type.value === row.type)?.label ?? row.type,
    row.manufacturer, row.model, row.serialNumber, row.ipAddress, row.location,
    row.status === "UNKNOWN" ? "Sem estado verificado" : row.status, row.updatedAt.toISOString(),
  ].map(cell).join(";"));
  return `\uFEFF${header.map(cell).join(";")}\r\n${lines.join("\r\n")}${lines.length ? "\r\n" : ""}`;
}
