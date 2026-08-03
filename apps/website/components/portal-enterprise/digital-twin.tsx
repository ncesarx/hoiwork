"use client";
import { useState } from "react";
import { assets } from "@/content/portal-enterprise";

const nodes = [
  {id:"internet",label:"Internet",x:50,y:8},{id:"firewall",label:"Firewall",x:50,y:25},
  {id:"switch",label:"Core Switch",x:50,y:43},{id:"srv1",label:"Proxmox 01",x:26,y:63},
  {id:"srv2",label:"Proxmox 02",x:50,y:63},{id:"storage",label:"Storage",x:75,y:63},
  {id:"backup",label:"Backup",x:38,y:85},{id:"dr",label:"Site DR",x:65,y:85}
];

export function DigitalTwin(){
  const [active,setActive]=useState("firewall");
  const asset = active==="srv1"?assets[0]:active==="srv2"?assets[1]:active==="firewall"?assets[2]:active==="storage"?assets[3]:active==="switch"?assets[4]:undefined;
  return <section className="enterprise-twin">
    <div className="enterprise-twin__header"><div><span>Digital Twin</span><h2>Infraestrutura do cliente</h2></div><b><i/> Ambiente demonstrativo</b></div>
    <div className="enterprise-twin__layout">
      <div className="enterprise-twin__canvas">
        <svg viewBox="0 0 1000 700" aria-hidden="true"><path d="M500 75V170M500 205V290M500 330C430 370 320 390 260 430M500 330V430M500 330C590 370 700 390 750 430M260 500C310 560 350 580 380 600M500 500C470 555 430 580 380 600M750 500C710 560 675 580 650 600M380 635H650"/></svg>
        {nodes.map(n=><button key={n.id} type="button" className={active===n.id?"is-active":""} style={{left:`${n.x}%`,top:`${n.y}%`}} onClick={()=>setActive(n.id)}><i/><strong>{n.label}</strong></button>)}
      </div>
      <aside className="enterprise-twin__detail"><span>Componente selecionado</span><h3>{nodes.find(n=>n.id===active)?.label}</h3>
        {asset?<dl>
          <div><dt>Fabricante</dt><dd>{asset.manufacturer}</dd></div><div><dt>Modelo</dt><dd>{asset.model}</dd></div>
          <div><dt>IP</dt><dd>{asset.ip}</dd></div><div><dt>Localização</dt><dd>{asset.location}</dd></div>
          <div><dt>Garantia</dt><dd>{asset.warranty}</dd></div><div><dt>Status</dt><dd>{asset.status}</dd></div>
        </dl>:<p>Componente lógico da arquitetura. A integração futura poderá carregar status e documentação em tempo real.</p>}
      </aside>
    </div>
  </section>;
}
