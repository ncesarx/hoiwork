import Link from "next/link";
import { requireOrganization } from "@/lib/authz";
import { getOrganizationOnboardingAccess } from "@/lib/organization/onboarding";
import type { CollectionFreshness } from "@/lib/inventory/freshness";
import styles from "./organization-onboarding.module.css";

export async function OrganizationOnboarding({ assetCount, endpoints }: {
  assetCount: number;
  endpoints: { status: string; lastAttemptFailed: boolean; freshness: CollectionFreshness }[];
}) {
  const { organization, session, membership } = await requireOrganization();
  if (membership.role !== "ADMIN") return null;
  const { activeOtherUsers, pendingInvitations } = await getOrganizationOnboardingAccess(organization.id, session.user.id);
  const recentEndpoints = endpoints.filter((endpoint) =>
    endpoint.status === "HEALTHY" && !endpoint.lastAttemptFailed && endpoint.freshness === "RECENT").length;
  const steps = [
    {
      title: "Acessos da equipe",
      state: activeOtherUsers > 0 ? "Usuários ativos" : pendingInvitations > 0 ? "Aguardando ativação" : "Convidar usuários",
      detail: activeOtherUsers > 0
        ? `${activeOtherUsers} usuário(s) ativo(s) além de você. ${pendingInvitations} convite(s) aguardando ativação.`
        : pendingInvitations > 0
          ? `${pendingInvitations} convite(s) válido(s). O acesso da equipe será confirmado após a ativação.`
          : "Só você tem acesso ativo. Convide os responsáveis desta empresa quando necessário.",
      href: "/portal/organizacao", action: "Gerenciar acessos", done: activeOtherUsers > 0,
    },
    {
      title: "Coleta Proxmox (opcional)",
      state: endpoints.length === 0 ? "Sem integração" : recentEndpoints === endpoints.length ? "Coleta recente" : "Revisar coleta",
      detail: endpoints.length === 0
        ? "Se a empresa usa Proxmox, cadastre a instância, teste a conexão e execute a descoberta. O cadastro sozinho não confirma a coleta."
        : `${recentEndpoints} de ${endpoints.length} instância(s) habilitada(s) com coleta recente e sem falha na última tentativa.`,
      href: "/portal/integracoes/proxmox", action: "Conferir integrações",
      done: endpoints.length > 0 && recentEndpoints === endpoints.length,
    },
    {
      title: "Inventário da empresa",
      state: assetCount > 0 ? "Recursos disponíveis" : "Sem recursos",
      detail: assetCount > 0
        ? `${assetCount} recurso(s) disponível(is). Confira nomes, estrutura e datas de coleta antes de usar os indicadores.`
        : "Nenhum recurso disponível. Após a descoberta, confira o inventário desta empresa.",
      href: "/portal/inventario", action: "Abrir inventário", done: assetCount > 0,
    },
  ];

  return <section className={`portal-panel ${styles.panel}`} aria-labelledby="company-setup-title">
    <div className="portal-panel__header"><div>
      <span>Orientação para o administrador</span><h2 id="company-setup-title">Configuração da empresa</h2>
    </div><Link href="/portal/ajuda#onboarding">Consultar guia</Link></div>
    <p className={styles.intro}>Confira os próximos passos de {organization.name}. Os estados abaixo acompanham os dados atuais da empresa.</p>
    <ol className={styles.steps}>
      {steps.map((step) => <li key={step.title}>
        <div className={styles.heading}><h3>{step.title}</h3><span className={step.done ? styles.done : styles.pending}>{step.state}</span></div>
        <p>{step.detail}</p><Link href={step.href}>{step.action} →</Link>
      </li>)}
    </ol>
  </section>;
}
