import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { buildSloReport } from "@/lib/observability/slo-reporting";

function f(v:number|null,s=""){return v===null?"N/D":`${v.toFixed(2)}${s}`}

export async function SloReportingPanel() {
  const { organization } = await requireOrganization();
  const [report, retention] = await Promise.all([
    buildSloReport(organization.id,30),
    prisma.notificationSloRetentionConfig.upsert({
      where:{organizationId:organization.id},update:{},
      create:{organizationId:organization.id,enabled:true,retentionDays:90},
    }),
  ]);

  const points = report.series.slice(-48);
  const maxX = Math.max(1,points.length-1);
  const poly = (key:"nocHealthScore"|"deliverySuccess24h"|"errorBudget24h") =>
    points.map((p,i)=>{
      const value=p[key] ?? 0;
      const x=(i/maxX)*100;
      const y=100-Math.max(0,Math.min(100,value));
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");

  return (
    <section className="slo-reporting-panel">
      <div className="slo-reporting-heading">
        <div><span>Sprint 015.6.10.5</span><h2>Trend Visualization, Retention & SLO Reporting</h2>
        <p>Visão histórica de 30 dias, retenção governada e relatório operacional do NOC.</p></div>
        <div><strong>{report.samples}</strong><small>samples / 30d</small></div>
      </div>

      <div className="slo-report-kpis">
        <article><span>NOC Health avg</span><strong>{f(report.metrics.nocHealth.avg)}</strong><small>min {f(report.metrics.nocHealth.min)}</small></article>
        <article><span>Delivery avg</span><strong>{f(report.metrics.deliverySuccess24h.avg,"%")}</strong><small>min {f(report.metrics.deliverySuccess24h.min,"%")}</small></article>
        <article><span>Error Budget avg</span><strong>{f(report.metrics.errorBudget24h.avg,"%")}</strong><small>min {f(report.metrics.errorBudget24h.min,"%")}</small></article>
        <article><span>Burn Rate avg</span><strong>{f(report.metrics.burnRate1h.avg,"x")}</strong><small>max {f(report.metrics.burnRate1h.max,"x")}</small></article>
      </div>

      <div className="slo-trend-chart">
        <header><div><span>Trend Visualization</span><h3>Últimas {points.length} amostras</h3></div>
        <div className="slo-chart-legend"><span>NOC Health</span><span>Delivery</span><span>Error Budget</span></div></header>
        {points.length>1 ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="SLO historical trend">
          <line x1="0" y1="10" x2="100" y2="10"/><line x1="0" y1="50" x2="100" y2="50"/><line x1="0" y1="90" x2="100" y2="90"/>
          <polyline className="trend-line trend-line--noc" points={poly("nocHealthScore")}/>
          <polyline className="trend-line trend-line--delivery" points={poly("deliverySuccess24h")}/>
          <polyline className="trend-line trend-line--budget" points={poly("errorBudget24h")}/>
        </svg> : <div className="slo-chart-empty">Aguardando pelo menos 2 snapshots.</div>}
      </div>

      <div className="slo-report-footer">
        <article><span>HEALTHY</span><strong>{report.stateDistribution.healthy}</strong></article>
        <article><span>DEGRADED</span><strong>{report.stateDistribution.degraded}</strong></article>
        <article><span>CRITICAL</span><strong>{report.stateDistribution.critical}</strong></article>
        <article><span>Retention</span><strong>{retention.retentionDays} dias</strong><small>{retention.enabled?"ENABLED":"DISABLED"}</small></article>
      </div>
    </section>
  );
}
