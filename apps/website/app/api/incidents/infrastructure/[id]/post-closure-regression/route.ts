import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { buildPostClosureRegressionStatus } from "@/lib/incidents/post-closure-regression";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { organization } = await requireOrganization();
  const { id } = await context.params;

  const data = await buildPostClosureRegressionStatus(
    organization.id,
    id,
  );

  if (!data) {
    return NextResponse.json(
      { ok: false, error: "Incidente não encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { ok: true, ...data },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-HOIWORK-Post-Closure-Regression": "015.6.11.6.4.4",
      },
    },
  );
}
