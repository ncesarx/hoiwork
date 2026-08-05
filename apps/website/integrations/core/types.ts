export type IntegrationHealth = { ok: boolean; message: string; checkedAt: Date };
export type DiscoveredResource = { externalId:string; kind:string; name:string; status:string; node?:string; cpuPercent?:number; memoryUsedBytes?:bigint; memoryTotalBytes?:bigint; diskUsedBytes?:bigint; diskTotalBytes?:bigint; uptimeSeconds?:bigint; metadata?:Record<string,unknown> };
export interface IntegrationProvider { health(): Promise<IntegrationHealth>; discover(): Promise<DiscoveredResource[]>; }
