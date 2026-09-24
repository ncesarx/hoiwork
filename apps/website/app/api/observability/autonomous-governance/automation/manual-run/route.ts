import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { runAutonomousGovernanceAutomation } from "@/lib/governance/autonomous-governance-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json(
      { ok: false, error: "Acesso negado." },
      { status: 403 },
    );
  }

  try {
    const result = await runAutonomousGovernanceAutomation({
      organizationId: organization.id,
      source: "MANUAL",
      respectEnabled: false,
      dryRunOnly: true,
    });

    return NextResponse.json(
      { ok: true, result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Falha na execução manual da governança." },
      { status: 500 },
    );
  }
}
