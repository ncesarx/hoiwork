import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { InfrastructureIncidentConsole } from "@/components/incidents/infrastructure-incident-console";
import Link from "next/link";

export const metadata = {
  title: "Infrastructure Incidents | Portal Enterprise",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function severityClass(value: string) {
  return `incident-severity incident-severity--${value.toLowerCase()}`;
}

export default async function InfrastructureIncidentsPage() {
  const { organization } = await requireOrganization();

  const incidents = await prisma.infrastructureIncident.findMany({
    where: { organizationId: organization.id },
    orderBy: [
      { status: "asc" },
      { riskScore: "desc" },
      { lastSeenAt: "desc" },
    ],
  });

  const open = incidents.filter((item) => item.status === "OPEN");
  const resolved = incidents.filter((item) => item.status === "RESOLVED");

  return (
    <>
      <section className="portal-heading">
        <span>Operational Risk</span>
        <h1>Incident Correlation</h1>
        <p>
          Condições anormais da infraestrutura são correlacionadas com o Digital
          Twin para calcular severidade, risco e blast radius.
        </p>
      </section>

      <InfrastructureIncidentConsole />

      <section className="incident-kpis">
        <article><span>Open</span><strong>{open.length}</strong></article>
        <article><span>Critical</span><strong>{open.filter((i) => i.severity === "CRITICAL").length}</strong></article>
        <article><span>High</span><strong>{open.filter((i) => i.severity === "HIGH").length}</strong></article>
        <article><span>Resolved</span><strong>{resolved.length}</strong></article>
      </section>

      <section className="incident-list">
        <div className="incident-list__heading">
          <div>
            <span>Infrastructure Events</span>
            <h2>Incidentes correlacionados</h2>
          </div>
          <strong>{incidents.length}</strong>
        </div>

        {incidents.map((incident) => (
          <article key={incident.id} className={incident.status === "RESOLVED" ? "is-resolved" : ""}>
            <div className="incident-main">
              <span className={severityClass(incident.severity)}>{incident.severity}</span>
              <div>
                <h3><Link href={`/portal/incidentes/${incident.id}`}>{incident.title}</Link></h3>
                <small>{incident.site || "SITE"} · {incident.instanceName || "Proxmox"} · {incident.assetType}</small>
              </div>
            </div>

            <div className="incident-metrics">
              <span>Risk <strong>{incident.riskScore}</strong></span>
              <span>Blast radius <strong>{incident.blastRadius}</strong></span>
              <span>Status <strong>{incident.status}</strong></span>
            </div>

            <p>{incident.description}</p>

            <footer>
              <small>Primeira detecção: {incident.firstSeenAt.toLocaleString("pt-BR")}</small>
              <small>Última detecção: {incident.lastSeenAt.toLocaleString("pt-BR")}</small>
            </footer>
          </article>
        ))}

        {!incidents.length ? (
          <div className="incident-empty">
            Nenhum incidente correlacionado. Execute a correlação para criar o baseline.
          </div>
        ) : null}
      </section>
    </>
  );
}
