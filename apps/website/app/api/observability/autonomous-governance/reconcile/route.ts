import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { reconcileAutonomousGovernanceState } from "@/lib/governance/autonomous-recovery-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json(
      { ok: false, error: "Acesso negado." },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const commit =
    url.searchParams.get("commit") === "1" &&
    session.user.role === "ADMIN";

  const result = await reconcileAutonomousGovernanceState({
    organizationId: organization.id,
    source: "MANUAL",
    commit,
  });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
