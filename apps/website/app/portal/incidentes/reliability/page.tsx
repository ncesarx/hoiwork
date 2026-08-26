import { IncidentReliabilityPanel } from "@/components/incidents/incident-reliability-panel";

export const metadata = {
  title: "Incident Reliability | Portal Enterprise",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function IncidentReliabilityPage() {
  return (
    <>
      <section className="portal-heading">
        <span>Incident Operations</span>
        <h1>SLA, MTTA & MTTR</h1>
        <p>
          Métricas de resposta e resolução sobre o lifecycle operacional dos
          incidentes.
        </p>
      </section>

      <IncidentReliabilityPanel />
    </>
  );
}
