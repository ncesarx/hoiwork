import { notFound } from "next/navigation";
import { requireOrganization } from "@/lib/authz";
import { getOrganizationMembers } from "@/lib/organization/access";
import { listOrganizationInvitations } from "@/lib/organization/invitations";
import { MemberRoleEditor } from "./member-role-editor";
import { InvitationForm } from "./invitation-form";
import { RevokeInvitationButton } from "./revoke-invitation-button";
import styles from "./page.module.css";

export const metadata = {
  title: "Organização e acessos | HOIWORK",
  robots: { index: false, follow: false },
};

export default async function OrganizationAccessPage() {
  const { organization, membership, session } = await requireOrganization();
  if (membership.role !== "ADMIN") notFound();

  const [members, invitations] = await Promise.all([
    getOrganizationMembers(organization.id),
    listOrganizationInvitations(organization.id),
  ]);
  const formatDate = (date: Date) => new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(date);

  return (
    <>
      <header className="portal-heading">
        <span>Administração da organização</span>
        <h1>Organização e acessos</h1>
        <p>Confira os usuários vinculados e gerencie os papéis de acesso da organização.</p>
      </header>

      <div className={styles.summary}>
        <article><span>Organização</span><strong>{organization.name}</strong></article>
        <article><span>Identificador</span><strong>{organization.slug}</strong></article>
        <article><span>Usuários vinculados</span><strong>{members.length}</strong></article>
      </div>

      <section className={styles.panel} aria-labelledby="invite-title">
        <div className={styles.heading}><div>
          <h2 id="invite-title">Convidar novo usuário</h2>
          <p>O link vale por 24 horas e só pode ser usado uma vez. Envie-o ao destinatário por um canal seguro.</p>
        </div></div>
        <InvitationForm />
      </section>

      <section className={styles.panel} aria-labelledby="invitations-title">
        <div className={styles.heading}><div>
          <h2 id="invitations-title">Convites recentes</h2>
          <p>Últimos 50 convites da organização. Os links de ativação não são recuperáveis depois da criação.</p>
        </div></div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Destinatário</th><th>E-mail</th><th>Papel</th><th>Criado em</th><th>Validade</th><th>Estado</th><th>Ação</th></tr></thead>
            <tbody>
              {invitations.map((invite) => (
                <tr key={invite.id}>
                  <td>{invite.name}</td><td>{invite.email}</td><td>{invite.role}</td>
                  <td>{formatDate(invite.createdAt)}</td><td>{formatDate(invite.expiresAt)}</td>
                  <td>{invite.state}</td>
                  <td>{invite.state === "Pendente" ? <RevokeInvitationButton id={invite.id} /> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {invitations.length === 0 ? <p>Nenhum convite criado nesta organização.</p> : null}
      </section>

      <section className={styles.panel} aria-labelledby="members-title">
        <div className={styles.heading}>
          <div>
            <h2 id="members-title">Usuários e permissões</h2>
            <p>Usuários inativos não podem acessar o portal. Alterações de papel são registradas em auditoria.</p>
          </div>
          <span>ADMIN</span>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Usuário</th><th>E-mail</th><th>Papel</th><th>Estado</th><th>Vinculado em</th><th>Ajustar papel</th></tr></thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>{member.user.name?.trim() || "Sem nome"}</td>
                  <td>{member.user.email}</td>
                  <td>{member.role}</td>
                  <td>{member.user.active ? "Ativo" : "Inativo"}</td>
                  <td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(member.createdAt)}</td>
                  <td><MemberRoleEditor membershipId={member.id} currentRole={member.role} self={member.userId === session.user.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {members.length === 0 ? <p>Nenhum vínculo encontrado para esta organização.</p> : null}
      </section>
    </>
  );
}
