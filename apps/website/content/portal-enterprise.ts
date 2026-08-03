export const assets = [
  {id:"SRV-001",name:"Host Proxmox 01",type:"Servidor",manufacturer:"Dell",model:"PowerEdge",ip:"10.10.10.11",location:"Rack principal • U08",warranty:"31/12/2027",status:"Online"},
  {id:"SRV-002",name:"Host Proxmox 02",type:"Servidor",manufacturer:"Dell",model:"PowerEdge",ip:"10.10.10.12",location:"Rack principal • U12",warranty:"31/12/2027",status:"Online"},
  {id:"FW-001",name:"Firewall Principal",type:"Firewall",manufacturer:"Fortinet",model:"FortiGate",ip:"10.10.10.1",location:"Rack principal • U02",warranty:"30/06/2027",status:"Online"},
  {id:"STG-001",name:"Storage Corporativo",type:"Storage",manufacturer:"Dell",model:"PowerVault",ip:"10.10.20.10",location:"Rack principal • U16",warranty:"31/12/2027",status:"Atenção"},
  {id:"SW-001",name:"Core Switch 10 Gb",type:"Switch",manufacturer:"Cisco",model:"Catalyst",ip:"10.10.10.2",location:"Rack principal • U04",warranty:"30/09/2028",status:"Online"},
] as const;

export const backupJobs = [
  {name:"Backup diário",status:"Concluído",lastRun:"Hoje, 02:15",retention:"30 dias",progress:100},
  {name:"Backup semanal",status:"Concluído",lastRun:"Domingo, 03:20",retention:"12 semanas",progress:100},
  {name:"Backup mensal",status:"Concluído",lastRun:"01/08/2026",retention:"12 meses",progress:100},
  {name:"Cópia imutável",status:"Protegida",lastRun:"Hoje, 04:10",retention:"14 dias",progress:100},
  {name:"Teste de restauração",status:"Validado",lastRun:"30/07/2026",retention:"Relatório disponível",progress:100},
] as const;

export const drMetrics = {
  replication:"Sincronizada",lastSync:"Há 2 minutos",rpo:"15 minutos",rto:"2 horas",
  primarySite:"Site Principal",recoverySite:"Site DR • Outra localidade"
} as const;

export const contracts = [
  {id:"CTR-2026-001",name:"Suporte e Monitoramento Corporativo",status:"Ativo",start:"01/01/2026",end:"31/12/2026",sla:"4 horas",consumedHours:14,availableHours:40}
] as const;
