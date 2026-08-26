import { ExecutiveCockpit } from "@/components/cockpit/executive-cockpit";
import { SiteHealthPanel } from "@/components/cockpit/site-health-panel";
import { ControlPlaneHealthPanel } from "@/components/observability/control-plane-health-panel";
import { ControlPlaneReliabilityPanel } from "@/components/observability/control-plane-reliability-panel";

export const metadata = {
  title: "Executive Operations Cockpit | Portal Enterprise",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CockpitPage() {
  return (
    <>
      <section className="portal-heading">
        <span>Executive Operations</span>
        <h1>Infrastructure SLO Convergence</h1>
        <p>
          Uma visão única da saúde do ambiente, risco operacional, incidentes e
          confiabilidade do Notification Engine.
        </p>
      </section>

      <ExecutiveCockpit />

      <ControlPlaneHealthPanel />

      <ControlPlaneReliabilityPanel />

      <SiteHealthPanel />
    </>
  );
}
