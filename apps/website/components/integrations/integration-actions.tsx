"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Result={ok?:boolean;message?:string;error?:string;resources?:number;endpoint?:string;tls?:string;stage?:string};

export function IntegrationActions(){
  const router=useRouter();
  const [busy,setBusy]=useState<"test"|"sync"|null>(null);
  const [message,setMessage]=useState("");
  const [ok,setOk]=useState<boolean|null>(null);

  async function run(kind:"test"|"sync"){
    setBusy(kind); setMessage(""); setOk(null);
    try{
      const response=await fetch(`/api/integrations/proxmox/${kind}`,{
        method:"POST",
        credentials:"include",
        headers:{Accept:"application/json"},
      });
      const text=await response.text();
      let data:Result={};
      try{ data=text?JSON.parse(text):{}; }catch{ data={error:text||`HTTP ${response.status}`}; }

      if(!response.ok){
        throw new Error(data.error||data.message||`Falha HTTP ${response.status}`);
      }

      setOk(true);
      setMessage(
        kind==="test"
          ? `${data.message??"Conexão validada."}${data.tls?` • TLS: ${data.tls}`:""}`
          : `${data.resources??0} recursos sincronizados com sucesso.`
      );
      router.refresh();
    }catch(error){
      setOk(false);
      setMessage(error instanceof Error?error.message:"Erro inesperado.");
    }finally{
      setBusy(null);
    }
  }

  return <div className="integration-actions">
    <div>
      <button type="button" className="secondary" onClick={()=>run("test")} disabled={busy!==null}>
        {busy==="test"?"Testando...":"Testar conexão"}
      </button>
      <button type="button" onClick={()=>run("sync")} disabled={busy!==null}>
        {busy==="sync"?"Sincronizando...":"Sincronizar Proxmox"}
      </button>
    </div>
    {message?<small className={ok===false?"is-error":"is-success"}>{message}</small>:null}
  </div>;
}
