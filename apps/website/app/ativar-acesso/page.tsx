import { ActivationForm } from "./activation-form";
import "../login/login.css";

export const metadata = {
  title: "Ativar acesso | HOIWORK",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ActivationPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span>HO</span><div><strong>HOME & OFFICE</strong><small>CLIENT PORTAL ENTERPRISE</small></div></div>
        <div className="auth-copy">
          <span>Convite da organização</span>
          <h1>Ative seu acesso.</h1>
          <p>Informe o e-mail convidado. Use sua senha atual se já tem conta ou crie uma senha com pelo menos 12 caracteres. O link só pode ser usado uma vez.</p>
        </div>
        <ActivationForm />
      </section>
    </main>
  );
}
