import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getSelectedMembership } from "@/lib/organization/access";
import { ORGANIZATION_CONTEXT_COOKIE } from "@/lib/organization/context-cookie";
import { LoginForm } from "@/components/auth/login-form";
import "./login.css";

export const metadata = {
  title: "Acesso ao Portal",
  robots: { index: false, follow: false },
};

export default async function PortalLoginPage() {
  const session = await auth();
  if (session?.user?.id) {
    const rawPreference = (await cookies()).get(ORGANIZATION_CONTEXT_COOKIE)?.value ?? null;
    const preference = rawPreference && rawPreference.length <= 128 ? rawPreference : null;
    const membership = await getSelectedMembership(session.user.id, preference, session.user.organizationId);
    if (membership && session.user.sessionVersion === membership.user.sessionVersion) redirect("/portal");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span>HO</span>
          <div>
            <strong>HOME & OFFICE</strong>
            <small>CLIENT PORTAL ENTERPRISE</small>
          </div>
        </div>
        <div className="auth-copy">
          <span>Acesso seguro</span>
          <h1>Entre no Centro de Operações.</h1>
          <p>
            Consulte infraestrutura, chamados, documentos, backup, contratos e
            continuidade em um ambiente protegido.
          </p>
        </div>
        <LoginForm />
        <small className="auth-notice">
          Altere as credenciais de demonstração e ative HTTPS antes de qualquer
          uso externo.
        </small>
      </section>
    </main>
  );
}
