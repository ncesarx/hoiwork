import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { NotificationConsole } from "@/components/notifications/notification-console";
import { DeliveryGovernanceConsole } from "@/components/notifications/delivery-governance-console";
import { NotificationAutomationPanel } from "@/components/notifications/notification-automation-panel";
import { ConnectorDeleteButton } from "@/components/notifications/connector-delete-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const { organization } = await requireOrganization();

  const [connectors, deliveries] = await Promise.all([
    prisma.notificationConnector.findMany({
      where: { organizationId: organization.id },
      orderBy: { name: "asc" },
    }),
    prisma.alertDelivery.findMany({
      where: { organizationId: organization.id },
      include: { incident: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);

  const safeConnectors = connectors.map((connector) => ({
    id: connector.id,
    name: connector.name,
    type: connector.type,
    mode: connector.mode,
    lastTestStatus: connector.lastTestStatus,
  }));

  return (
    <>
      <section className="portal-heading">
        <span>Notification Engine</span>
        <h1>SMTP Live & Connector Health</h1>
        <p>
          Teste obrigatório antes do modo LIVE, secrets por referência de
          ambiente e retry controlado.
        </p>
      </section>

      <NotificationConsole connectors={safeConnectors} />

      <NotificationAutomationPanel />

      <DeliveryGovernanceConsole />

      <section className="notification-grid">
        <article><span>Connectors</span><strong>{connectors.length}</strong></article>
        <article><span>Healthy</span><strong>{connectors.filter(c => c.lastTestStatus === "HEALTHY").length}</strong></article>
        <article><span>LIVE</span><strong>{connectors.filter(c => c.mode === "LIVE").length}</strong></article>
        <article><span>SENT</span><strong>{deliveries.filter(d => d.status === "SENT").length}</strong></article>
      </section>

      <section className="notification-list">
        <h2>Connectors</h2>
        {connectors.map((c) => (
          <article key={c.id}>
            <div><b>{c.type}</b><strong>{c.name}</strong></div>
            <span>{c.mode}</span>
            <span>{c.lastTestStatus ?? "NÃO TESTADO"}</span>
            <div className="connector-state-actions">
              <em>{c.enabled ? "ENABLED" : "DISABLED"}</em>
              <ConnectorDeleteButton id={c.id} name={c.name} mode={c.mode} />
            </div>
          </article>
        ))}
      </section>

      <section className="notification-list">
        <h2>Delivery status</h2>
        {deliveries.map((d) => (
          <article key={d.id}>
            <div><b>{d.channel}</b><strong>{d.incident.assetName}</strong></div>
            <span>{d.recipient}</span>
            <span>attempt {d.attempt}</span>
            <em>{d.status}</em>
          </article>
        ))}
      </section>
    </>
  );
}
