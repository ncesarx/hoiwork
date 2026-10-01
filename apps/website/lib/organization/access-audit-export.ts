import type { listAccessAudit } from "./access-audit";

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseAuditPeriod(fromValue: string | null, toValue: string | null, now = new Date()) {
  if (!fromValue && !toValue) {
    return { from: new Date(now.getTime() - 90 * DAY_MS), toExclusive: now };
  }
  if (!fromValue || !toValue) return null;
  const parseDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
  };
  const from = parseDate(fromValue);
  const to = parseDate(toValue);
  if (!from || !to) return null;
  const toExclusive = new Date(to.getTime() + DAY_MS);
  if (from > to || toExclusive.getTime() - from.getTime() > 366 * DAY_MS) return null;
  return { from, toExclusive };
}

function csvCell(value: string) {
  const singleLine = value.replace(/[\r\n\u0000-\u001f]/g, " ");
  // Quoting a cell does not disable spreadsheet formulas; prefix risky values.
  const safe = /^\s*[=+\-@]/.test(singleLine) ? `'${singleLine}` : singleLine;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function buildAccessAuditCsv(rows: Awaited<ReturnType<typeof listAccessAudit>>) {
  const header = ["Data (UTC)", "Ação", "Responsável", "Destinatário", "Detalhes"];
  const lines = rows.map((row) => [
    row.createdAt.toISOString(), row.action, row.actor, row.target, row.details ?? "",
  ].map(csvCell).join(";"));
  return `\uFEFF${header.map(csvCell).join(";")}\r\n${lines.join("\r\n")}${lines.length ? "\r\n" : ""}`;
}
