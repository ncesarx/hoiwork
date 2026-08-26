import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { ProxmoxInstanceManager } from "@/components/integrations/proxmox-instance-manager";
import { RegistryConsolidationActions } from "@/components/integrations/registry-consolidation-actions";

export const metadata = {
  title: "Multi-Proxmox | Portal Enterprise",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MultiProxmoxPage() {
  const { organization } = await requireOrganization();

  const instances = await prisma.proxmoxInstance.findMany({
    where: { organizationId: organization.id },
    orderBy: [{ enabled: "desc" }, { name: "asc" }],
  });

  const safeInstances = instances.map((instance) => ({
    id: instance.id,
    name: instance.name,
    site: instance.site,
    baseUrl: instance.baseUrl,
    tokenId: instance.tokenId,
    allowSelfSigned: instance.allowSelfSigned,
    enabled: instance.enabled,
    status: instance.status,
    lastHealthAt: instance.lastHealthAt?.toISOString() ?? null,
    lastSyncAt: instance.lastSyncAt?.toISOString() ?? null,
    lastError: instance.lastError,
  }));

  return (
    <>
      <section className="portal-heading">
        <span>Multi-Site Infrastructure</span>
        <h1>Multi-Proxmox Discovery Foundation</h1>
        <p>
          Cadastro, isolamento de credenciais e descoberta simultânea de
          múltiplos ambientes Proxmox sem colisão de Node, VMID, Storage ou
          Network.
        </p>
      </section>

      <section className="multi-proxmox-architecture">
        <article><span>Legacy / Atual</span><strong>.env</strong><small>permanece operacional</small></article>
        <article><span>Registry</span><strong>{safeInstances.length}</strong><small>instância(s) adicional(is)</small></article>
        <article><span>Identity</span><strong>Namespaced</strong><small>proxmox/&lt;instanceId&gt;/...</small></article>
        <article><span>Credentials</span><strong>AES-256-GCM</strong><small>Token Secret criptografado</small></article>
      </section>

      <RegistryConsolidationActions
        legacyAvailable={Boolean(process.env.PROXMOX_BASE_URL && process.env.PROXMOX_TOKEN_ID && process.env.PROXMOX_TOKEN_SECRET)}
      />

      <ProxmoxInstanceManager instances={safeInstances} />
    </>
  );
}
