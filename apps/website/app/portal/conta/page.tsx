import { requireOrganization } from "@/lib/authz";
import { listOwnSecurityActivity } from "@/lib/organization/access-audit";
import { PasswordForm } from "./password-form";
import { RevokeSessionsForm } from "./revoke-sessions-form";
import styles from "./page.module.css";

export const metadata = {
  title: "Minha conta | HOIWORK",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const { session } = await requireOrganization();
  const activity = await listOwnSecurityActivity(session.user.id);
  const formatDate = (date: Date) => new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(date);
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
    <section className={styles.panel} aria-labelledby="account-activity-title">
      <h2 id="account-activity-title">Atividade recente da conta</h2>
      <p>As 20 atividades mais recentes da sua conta, incluindo entradas, saídas e alterações de segurança.</p>
      {activity.length ? <div className={styles.tableWrap}><table>
        <thead><tr><th>Quando</th><th>Atividade</th><th>Organização</th></tr></thead>
        <tbody>{activity.map((event) => <tr key={event.id}>
          <td>{formatDate(event.createdAt)}</td><td>{event.action}</td><td>{event.organizationName}</td>
        </tr>)}</tbody>
      </table></div> : <p>Nenhuma atividade da conta registrada ainda.</p>}
    </section>
  </>;
}
