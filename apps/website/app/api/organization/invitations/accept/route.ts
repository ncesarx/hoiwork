import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptInvitation, InvitationError } from "@/lib/organization/invitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(1).max(128),
  email: z.email().max(254),
  password: z.string().min(12).max(128),
}).strict();

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Informe e-mail, convite e senha com ao menos 12 caracteres." }, { status: 400 });
  }
  try {
    await acceptInvitation(parsed.data);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InvitationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível ativar o acesso." }, { status: 500 });
  }
}
