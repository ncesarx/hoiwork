import { notFound } from "next/navigation";
import { requireOrganization } from "@/lib/authz";
import { getOrganizationMembers } from "@/lib/organization/access";
import { MemberRoleEditor } from "./member-role-editor";
import styles from "./page.module.css";

export const metadata = {
  title: "Organização e acessos | HOIWORK",
  robots: { index: false, follow: false },
};

export default async function OrganizationAccessPage() {
  const { organization, membership, session } = await requireOrganization();
  if (membership.role !== "ADMIN") notFound();

  const members = await getOrganizationMembers(organization.id);

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
