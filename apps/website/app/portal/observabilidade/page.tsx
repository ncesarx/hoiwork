import { NotificationObservabilityPanel } from "@/components/observability/notification-observability-panel";
import { NocHealthPanel } from "@/components/observability/noc-health-panel";
import { SloTrendPanel } from "@/components/observability/slo-trend-panel";
import { SloSnapshotCaptureButton } from "@/components/observability/slo-snapshot-capture-button";
import { SloAutomationPanel } from "@/components/observability/slo-automation-panel";
import { SloReportingPanel } from "@/components/observability/slo-reporting-panel";
import { RetentionGovernancePanel } from "@/components/observability/retention-governance-panel";

export const metadata = {
  title: "Notification Observability | Portal Enterprise",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ObservabilityPage() {
  return (
    <>
      <section className="portal-heading">
        <span>NOC Observability</span>
        <h1>Notification Observability & SLO</h1>
        <p>
          SLO de entregas LIVE, saúde dos conectores, latência de notificação e
          confiabilidade da automação.
        </p>
      </section>

      <NotificationObservabilityPanel />

      <NocHealthPanel />

      <SloSnapshotCaptureButton />

      <SloTrendPanel />

      <SloAutomationPanel />

      <SloReportingPanel />

      <RetentionGovernancePanel />
    </>
  );
}
