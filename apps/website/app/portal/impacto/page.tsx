import { ImpactIntelligencePanel } from "@/components/discovery/impact-intelligence-panel";

export const metadata = {
  title: "Impact Intelligence | Portal Enterprise",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ImpactPage() {
  return (
    <>
      <section className="portal-heading">
        <span>Operational Intelligence</span>
        <h1>Impact & Dependency Intelligence</h1>
        <p>
          Análise de dependências, criticidade e blast radius sobre a topologia
          Multi-Proxmox consolidada.
        </p>
      </section>

      <ImpactIntelligencePanel />
    </>
  );
}
