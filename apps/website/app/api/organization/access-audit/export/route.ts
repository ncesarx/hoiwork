import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { listAccessAudit } from "@/lib/organization/access-audit";
import { buildAccessAuditCsv, parseAuditPeriod } from "@/lib/organization/access-audit-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { organization, membership } = await requireOrganization();
  if (membership.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Somente ADMIN pode exportar auditoria." }, { status: 403 });
  }
  const url = new URL(request.url);
  const period = parseAuditPeriod(url.searchParams.get("from"), url.searchParams.get("to"));
  if (!period) {
    return NextResponse.json({ ok: false, error: "Informe duas datas válidas, em UTC, num intervalo de até 366 dias." }, { status: 400 });
  }
  const audit = await listAccessAudit(organization.id, { ...period, limit: 1001 });
  if (audit.length > 1000) {
    return NextResponse.json({ ok: false, error: "O período contém mais de 1000 eventos. Reduza o intervalo." }, { status: 422 });
  }
  const filename = `hoiwork-acessos-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(buildAccessAuditCsv(audit), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
