import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { IncidentRecurrencePanel } from "@/components/incidents/incident-recurrence-panel";
import "./recurrence.css";

export const dynamic = "force-dynamic";

export default async function IncidentRecurrencePage() {
  const { organization } = await requireOrganization();

  const recent = await prisma.infrastructureIncident.findMany({
    where: {
      organizationId: organization.id,
      source: "HOIWORK_RECURRENCE",
    },
    orderBy: { firstSeenAt: "desc" },
    take: 20,
  });

  return (
    <main className="incident-recurrence-page">
      <IncidentRecurrencePanel />

      <section className="incident-recurrence-list">
        <div>
          <span>Recurrence Incidents</span>
          <h2>Ocorrências recentes</h2>
        </div>

        {recent.map((incident) => (
          <article key={incident.id}>
            <div>
              <strong>{incident.title}</strong>
              <small>{incident.assetName}</small>
            </div>
            <span>{incident.status}</span>
            <span>{incident.severity}</span>
            <span>{incident.site ?? "N/D"}</span>
            <span>{incident.firstSeenAt.toLocaleString("pt-BR")}</span>
          </article>
        ))}

        {!recent.length ? (
          <small>Nenhuma recorrência registrada.</small>
        ) : null}
      </section>
    </main>
  );
}
