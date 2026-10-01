import { requireOrganization } from "@/lib/authz";
import { PasswordForm } from "./password-form";
import { RevokeSessionsForm } from "./revoke-sessions-form";
import styles from "./page.module.css";

export const metadata = {
  title: "Minha conta | HOIWORK",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const { session } = await requireOrganization();
  return <>
    <header className="portal-heading">
      <span>Segurança da conta</span>
      <h1>Minha conta</h1>
      <p>Gerencie sua senha e suas sessões no portal.</p>
    </header>
    <section className={styles.panel}>
      <h2>Alterar senha</h2>
      <p>{session.user.email}</p>
      <p>Ao salvar, você precisará entrar novamente. As sessões anteriores deixarão de acessar a organização.</p>
      <PasswordForm />
    </section>
    <section className={styles.panel}>
      <h2>Encerrar todas as sessões</h2>
      <p>Confirme sua senha atual para encerrar o acesso em todos os dispositivos e organizações, inclusive neste navegador. A senha não será alterada.</p>
      <RevokeSessionsForm />
    </section>
  </>;
}
