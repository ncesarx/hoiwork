import https from "node:https";
type E<T>={data:T};
type C={baseUrl:string;tokenId:string;tokenSecret:string;allowSelfSigned:boolean};
export type Storage={id:string;storage?:string;node?:string;type?:string;status?:string;disk?:number;maxdisk?:number;shared?:number;content?:string};
export type Net={iface:string;type?:string;active?:number;autostart?:number;address?:string;netmask?:string;gateway?:string;cidr?:string;bridge_ports?:string;bridge_vlan_aware?:number;bond_slaves?:string;bond_mode?:string;comments?:string};
function req(v:string|undefined,n:string){if(!v?.trim())throw new Error(`${n} não configurada.`);return v.trim()}
function cfg():C{return{baseUrl:req(process.env.PROXMOX_BASE_URL,"PROXMOX_BASE_URL").replace(/\/$/,""),tokenId:req(process.env.PROXMOX_TOKEN_ID,"PROXMOX_TOKEN_ID"),tokenSecret:req(process.env.PROXMOX_TOKEN_SECRET,"PROXMOX_TOKEN_SECRET"),allowSelfSigned:process.env.PROXMOX_ALLOW_SELF_SIGNED==="true"}}
export class ProxmoxFabricClient{
 private c=cfg();
 private get<T>(path:string):Promise<T>{const u=new URL(`${this.c.baseUrl}/api2/json${path}`);return new Promise((resolve,reject)=>{const r=https.request({protocol:u.protocol,hostname:u.hostname,port:u.port||"8006",path:`${u.pathname}${u.search}`,method:"GET",rejectUnauthorized:!this.c.allowSelfSigned,timeout:15000,headers:{Authorization:`PVEAPIToken=${this.c.tokenId}=${this.c.tokenSecret}`,Accept:"application/json","User-Agent":"HOIWORK-Fabric-Discovery/1.0"}},res=>{let b="";res.setEncoding("utf8");res.on("data",x=>b+=x);res.on("end",()=>{const s=res.statusCode??500;if(s<200||s>=300)return reject(new Error(`Proxmox API HTTP ${s}: ${b||res.statusMessage||"erro sem corpo"}`));try{resolve((JSON.parse(b) as E<T>).data)}catch{reject(new Error(`Resposta inválida da API Proxmox em ${path}.`))}})});r.on("timeout",()=>r.destroy(new Error(`Timeout em ${path}.`)));r.on("error",reject);r.end()})}
 getNodes(){return this.get<Array<{node:string}>>("/nodes")}
 getStorage(){return this.get<Storage[]>("/cluster/resources?type=storage")}
 getNetwork(node:string){return this.get<Net[]>(`/nodes/${encodeURIComponent(node)}/network`)}
}
