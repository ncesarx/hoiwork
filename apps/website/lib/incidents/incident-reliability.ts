import { prisma } from "@/lib/prisma";
type Severity="CRITICAL"|"HIGH"|"MEDIUM"|"LOW";
const SLA_MINUTES:Record<Severity,{acknowledge:number;resolve:number}>={
 CRITICAL:{acknowledge:15,resolve:120},HIGH:{acknowledge:30,resolve:240},
 MEDIUM:{acknowledge:120,resolve:720},LOW:{acknowledge:240,resolve:1440},
};
const mins=(a:Date,b:Date)=>Math.max(0,Math.round((b.getTime()-a.getTime())/60000));
const avg=(v:number[])=>v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length*100)/100:null;
const sev=(v:string):Severity=>(["CRITICAL","HIGH","MEDIUM","LOW"].includes(v)?v:"LOW") as Severity;

export async function buildIncidentReliability(organizationId:string,days=30){
 const safeDays=Math.max(1,Math.min(365,Math.trunc(days)));
 const since=new Date(Date.now()-safeDays*86400000);
 const incidents=await prisma.infrastructureIncident.findMany({where:{organizationId,createdAt:{gte:since}},orderBy:{createdAt:"desc"}});
 const now=new Date();
 const rows=incidents.map(i=>{
  const severity=sev(i.severity),sla=SLA_MINUTES[severity],acknowledgedAt=i.acknowledgedAt,resolvedAt=i.resolvedAt;
  const mttaMinutes=acknowledgedAt?mins(i.createdAt,acknowledgedAt):null;
  const mttrMinutes=resolvedAt?mins(i.createdAt,resolvedAt):null;
  const ageMinutes=mins(i.createdAt,resolvedAt??now);
  return {
   id:i.id,title:i.title,severity,status:i.status,riskScore:i.riskScore,assetName:i.assetName,site:i.site,
   createdAt:i.createdAt,updatedAt:i.updatedAt,resolvedAt,acknowledgedAt,
   acknowledgedByName:i.acknowledgedByName,assignedToName:i.assignedToName,assignedAt:i.assignedAt,
   mttaMinutes,mttrMinutes,ageMinutes,sla,
   acknowledgeBreached:!resolvedAt&&!acknowledgedAt&&ageMinutes>sla.acknowledge,
   resolveBreached:!resolvedAt&&ageMinutes>sla.resolve,
  };
 });
 const resolved=rows.filter(r=>r.resolvedAt), acknowledged=rows.filter(r=>r.mttaMinutes!==null);
 const mtta=acknowledged.map(r=>r.mttaMinutes).filter((v):v is number=>v!==null);
 const mttr=resolved.map(r=>r.mttrMinutes).filter((v):v is number=>v!==null);
 const resolvedWithin=resolved.filter(r=>r.mttrMinutes!==null&&r.mttrMinutes<=r.sla.resolve).length;
 return {
  periodDays:safeDays,generatedAt:now,
  counters:{total:rows.length,open:rows.filter(r=>["OPEN","ACKNOWLEDGED"].includes(r.status)).length,
   resolved:resolved.length,acknowledged:acknowledged.length,
   acknowledgeBreaches:rows.filter(r=>r.acknowledgeBreached).length,
   resolutionBreaches:rows.filter(r=>r.resolveBreached).length},
  metrics:{mttaMinutes:avg(mtta),mttrMinutes:avg(mttr),
   resolutionSlaCompliance:resolved.length?Math.round(resolvedWithin/resolved.length*10000)/100:null},
  sla:SLA_MINUTES,
  activeBreaches:rows.filter(r=>r.acknowledgeBreached||r.resolveBreached).sort((a,b)=>b.riskScore-a.riskScore).slice(0,20),
  recentResolved:resolved.slice(0,20),
 };
}
