import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RemediationSafetyClass = "BLOCKED" | "MANUAL_ONLY" | "APPROVAL_REQUIRED" | "AUTOMATION_ELIGIBLE";
export type RemediationAction = "START_VM" | "INVESTIGATE_VM" | "INVESTIGATE_NODE" | "INVESTIGATE_NETWORK" | "VERIFY_CONNECTIVITY" | "COLLECT_EVIDENCE" | "NO_ACTION";

function jsonObject(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, Prisma.JsonValue>;
  return value as Record<string, Prisma.JsonValue>;
}
function norm(v: string | null | undefined) { return (v ?? "").trim().toUpperCase(); }

function classify(i: {incidentStatus:string; severity:string; riskScore:number; blastRadius:number; assetType:string; assetStatus:string|null; active:boolean|null; recoveryEvidence:number; openSlaBreaches:number; deliveryFailed:number;}) {
  const status=norm(i.incidentStatus), severity=norm(i.severity), type=norm(i.assetType), assetStatus=norm(i.assetStatus);
  const blockers:string[]=[];
  if (status === "RESOLVED") return {action:"NO_ACTION" as const,safetyClass:"BLOCKED" as const,title:"Nenhuma remediação necessária",rationale:"O incidente já está resolvido.",risk:"LOW" as const,requiresApproval:false,executableNow:false as const,verification:["Confirmar que o incidente permanece RESOLVED."],rollback:[],blockers:["INCIDENT_RESOLVED"]};
  if (i.active === false) blockers.push("ASSET_INACTIVE");
  if (i.deliveryFailed > 0) blockers.push("NOTIFICATION_DELIVERY_FAILURE_PRESENT");
  if (i.openSlaBreaches > 0) blockers.push("OPEN_SLA_BREACH");

  if (type === "VM" && assetStatus === "STOPPED") {
    const highImpact=severity === "CRITICAL" || i.riskScore >= 80 || i.blastRadius >= 5;
    return {action:"START_VM" as const,safetyClass:(highImpact?"MANUAL_ONLY":"APPROVAL_REQUIRED") as RemediationSafetyClass,title:"Iniciar máquina virtual",rationale:"A VM está STOPPED enquanto existe incidente ativo. Ação apenas recomendada; nenhuma chamada real ao Proxmox será feita.",risk:(highImpact?"HIGH":"MEDIUM") as "HIGH"|"MEDIUM",requiresApproval:true,executableNow:false as const,verification:["Executar novo Discovery após eventual ação futura.","Confirmar RUNNING em duas observações independentes.","Validar serviços dependentes e conectividade."],rollback:["Retornar para operação manual se houver degradação."],blockers};
  }
  if (type === "VM" && ["RUNNING","ONLINE"].includes(assetStatus)) return {action:(i.recoveryEvidence>0?"COLLECT_EVIDENCE":"INVESTIGATE_VM") as RemediationAction,safetyClass:"MANUAL_ONLY" as const,title:i.recoveryEvidence>0?"Coletar evidência adicional de recuperação":"Investigar VM sem alterar estado",rationale:i.recoveryEvidence>0?"A VM aparenta recuperação. Confirme antes de qualquer ação.":"A VM está operacional no Discovery atual; mudança de estado seria injustificada.",risk:"LOW" as const,requiresApproval:false,executableNow:false as const,verification:["Comparar lastSeenAt com a próxima coleta.","Confirmar ausência da condição que abriu o incidente."],rollback:[],blockers};
  if (type === "NODE") return {action:(assetStatus==="ONLINE"?"COLLECT_EVIDENCE":"INVESTIGATE_NODE") as RemediationAction,safetyClass:"MANUAL_ONLY" as const,title:assetStatus==="ONLINE"?"Confirmar recuperação do node":"Investigar node manualmente",rationale:assetStatus==="ONLINE"?"O node está ONLINE; reboot/shutdown seriam excessivos.":"Falha de node possui alto blast radius potencial e não é elegível para execução automática.",risk:(assetStatus==="ONLINE"?"MEDIUM":"CRITICAL") as "MEDIUM"|"CRITICAL",requiresApproval:false,executableNow:false as const,verification:["Validar quorum/cluster.","Validar storage e rede.","Executar Discovery adicional."],rollback:[],blockers:[...blockers,...(assetStatus==="ONLINE"?[]:["NODE_STATE_CHANGE_BLOCKED"])]};
  if (["NETWORK","NIC","INTERFACE"].includes(type)) return {action:"INVESTIGATE_NETWORK" as const,safetyClass:"MANUAL_ONLY" as const,title:"Investigar conectividade e interface",rationale:"Mudanças automáticas em rede podem ampliar o impacto. Nesta fase somente diagnóstico é permitido.",risk:"HIGH" as const,requiresApproval:false,executableNow:false as const,verification:["Validar link, bridge/bond e configuração.","Executar teste de conectividade.","Executar novo Discovery."],rollback:[],blockers:[...blockers,"NETWORK_CHANGE_BLOCKED"]};
  return {action:"VERIFY_CONNECTIVITY" as const,safetyClass:"MANUAL_ONLY" as const,title:"Validar estado e conectividade",rationale:"Não há executor seguro mapeado para este tipo de ativo.",risk:"MEDIUM" as const,requiresApproval:false,executableNow:false as const,verification:["Confirmar estado atual do ativo.","Executar novo Discovery."],rollback:[],blockers:[...blockers,"NO_SAFE_EXECUTOR_MAPPED"]};
}

export async function buildRemediationIntelligence(organizationId:string, incidentId:string) {
  const incident=await prisma.infrastructureIncident.findFirst({where:{id:incidentId,organizationId},include:{slaEscalations:{where:{status:"OPEN"},orderBy:{detectedAt:"desc"}},alertDeliveries:{orderBy:{createdAt:"desc"},take:50}}});
  if (!incident) return null;
  const asset=await prisma.infrastructureAsset.findFirst({where:{organizationId,externalId:incident.assetExternalId},orderBy:{lastSeenAt:"desc"}});
  const metadata=jsonObject(incident.metadata);
  const recoveryEvidence=typeof metadata.recoveryEvidenceCount === "number" ? Number(metadata.recoveryEvidenceCount) : 0;
  const deliveryFailed=incident.alertDeliveries.filter(d=>d.status==="FAILED" || Boolean(d.errorMessage)).length;
  const recommendation=classify({incidentStatus:incident.status,severity:incident.severity,riskScore:incident.riskScore,blastRadius:incident.blastRadius,assetType:incident.assetType,assetStatus:asset?.status??null,active:asset?.active??null,recoveryEvidence,openSlaBreaches:incident.slaEscalations.length,deliveryFailed});
  return {version:"015.6.11.5.1",generatedAt:new Date(),incident:{id:incident.id,title:incident.title,status:incident.status,severity:incident.severity,riskScore:incident.riskScore,blastRadius:incident.blastRadius,assignedToName:incident.assignedToName,acknowledgedAt:incident.acknowledgedAt},asset:asset?{id:asset.id,externalId:asset.externalId,provider:asset.provider,assetType:asset.assetType,name:asset.name,nodeName:asset.nodeName,status:asset.status,active:asset.active,lastSeenAt:asset.lastSeenAt}:null,evidence:{recoveryEvidence,openSlaBreaches:incident.slaEscalations.length,deliveryFailed},recommendation,safetyPolicy:{realExecutionEnabled:false,dryRunOnly:true,destructiveActionsAllowed:false,humanApprovalFrameworkAvailable:false}};
}
