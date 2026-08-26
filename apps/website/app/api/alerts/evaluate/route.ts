import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import {
  evaluateAlertPolicies,
} from "@/lib/alerts/policy-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const { session, organization } = await requireOrganization();

  if (!["ADMIN", "TECHNICIAN"].includes(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Acesso negado." }, { status: 403 });
  }

  try {
    const evaluation = await evaluateAlertPolicies(
    organization.id,
   );

  return NextResponse.json({
   ok: true,
   message:
      `${evaluation.created} alerta(s) criado(s), ` +
      `${evaluation.escalations} escalonamento(s).`,
    evaluation,
  });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao avaliar políticas." },
      { status: 500 },
    );
  }
}
