import type { DiscoveredResource, IntegrationHealth, IntegrationProvider } from "@/integrations/core/types";
export class ProxmoxDemoConnector implements IntegrationProvider{
 async health():Promise<IntegrationHealth>{return{ok:true,message:"Modo demonstração ativo.",checkedAt:new Date()};}
 async discover():Promise<DiscoveredResource[]>{return[
 {externalId:"node/pve01",kind:"NODE",name:"pve01",status:"ONLINE",cpuPercent:22.4,memoryUsedBytes:BigInt(24*1024**3),memoryTotalBytes:BigInt(64*1024**3)},
 {externalId:"node/pve02",kind:"NODE",name:"pve02",status:"ONLINE",cpuPercent:18.7,memoryUsedBytes:BigInt(20*1024**3),memoryTotalBytes:BigInt(64*1024**3)},
 {externalId:"qemu/101",kind:"VM",name:"AD-Principal",node:"pve01",status:"RUNNING",cpuPercent:8.2,memoryUsedBytes:BigInt(5*1024**3),memoryTotalBytes:BigInt(8*1024**3),diskUsedBytes:BigInt(58*1024**3),diskTotalBytes:BigInt(100*1024**3)},
 {externalId:"qemu/102",kind:"VM",name:"Sistema-Cartorio",node:"pve02",status:"RUNNING",cpuPercent:31.5,memoryUsedBytes:BigInt(12*1024**3),memoryTotalBytes:BigInt(16*1024**3),diskUsedBytes:BigInt(180*1024**3),diskTotalBytes:BigInt(300*1024**3)},
 {externalId:"storage/shared",kind:"STORAGE",name:"shared-storage",status:"AVAILABLE",diskUsedBytes:BigInt(2*1024**4),diskTotalBytes:BigInt(4*1024**4)}]}
}
