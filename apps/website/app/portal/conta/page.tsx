import { requireOrganization } from "@/lib/authz";
import { PasswordForm } from "./password-form";
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
      <p>Gerencie a senha usada para entrar no portal.</p>
    </header>
    <section className={styles.panel}>
      <h2>Alterar senha</h2>
      <p>{session.user.email}</p>
      <p>Ao salvar, você precisará entrar novamente. As sessões anteriores deixarão de acessar a organização.</p>
      <PasswordForm />
    </section>
  </>;
}
