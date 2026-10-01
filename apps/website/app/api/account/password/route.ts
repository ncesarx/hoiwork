import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganization } from "@/lib/authz";
import { changeOwnPassword, PasswordChangeError } from "@/lib/organization/change-password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(12).max(128),
}).strict();

export async function POST(request: Request) {
  const { organization, session } = await requireOrganization();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Informe a senha atual e uma nova senha com pelo menos 12 caracteres." }, { status: 400 });
  }
  try {
    await changeOwnPassword({
      organizationId: organization.id,
      userId: session.user.id,
      sessionVersion: session.user.sessionVersion,
      ...parsed.data,
    });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PasswordChangeError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível alterar a senha." }, { status: 500 });
  }
}
