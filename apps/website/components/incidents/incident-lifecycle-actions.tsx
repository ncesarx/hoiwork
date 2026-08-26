"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function IncidentLifecycleActions({id,status,assignedToName}:{id:string;status:string;assignedToName?:string|null}) {
 const router=useRouter(),[busy,setBusy]=useState(""),[note,setNote]=useState(""),[message,setMessage]=useState("");
 const [owner,setOwner]=useState(assignedToName??"");
 async function post(path:string,body?:unknown){
  const r=await fetch(`/api/incidents/infrastructure/${id}/${path}`,{method:"POST",credentials:"include",
   headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
  const d=await r.json(); if(!r.ok) throw new Error(d.error??`HTTP ${r.status}`); router.refresh();
 }
 async function action(name:"acknowledge"|"resolve"){setBusy(name);setMessage("");try{await post(name)}catch(e){setMessage(e instanceof Error?e.message:"Erro inesperado.")}finally{setBusy("")}}
 async function assign(){const name=owner.trim();if(name.length<2)return;setBusy("assign");setMessage("");try{await post("assign",{assignedToName:name})}catch(e){setMessage(e instanceof Error?e.message:"Erro inesperado.")}finally{setBusy("")}}
 async function addNote(){const text=note.trim();if(!text)return;setBusy("note");setMessage("");try{await post("notes",{body:text});setNote("")}catch(e){setMessage(e instanceof Error?e.message:"Erro inesperado.")}finally{setBusy("")}}
 return <section className="lifecycle-actions">
  <div className="lifecycle-owner">
   <label>Responsável operacional</label>
   <div><input value={owner} onChange={e=>setOwner(e.target.value)} maxLength={160} placeholder="Nome do responsável" disabled={status==="RESOLVED"}/>
   <button disabled={busy!==""||status==="RESOLVED"||owner.trim().length<2} onClick={assign}>{busy==="assign"?"Atribuindo...":assignedToName?"Alterar responsável":"Atribuir responsável"}</button></div>
  </div>
  <div className="lifecycle-buttons">
   <button disabled={busy!==""||status==="ACKNOWLEDGED"||status==="RESOLVED"} onClick={()=>action("acknowledge")}>{busy==="acknowledge"?"Reconhecendo...":"Acknowledge"}</button>
   <button disabled={busy!==""||status==="RESOLVED"} onClick={()=>action("resolve")}>{busy==="resolve"?"Encerrando...":"Resolver incidente"}</button>
  </div>
  <div className="lifecycle-note"><textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={4000} placeholder="Adicionar nota operacional, evidência ou ação executada..." />
   <button disabled={busy!==""||note.trim().length<2} onClick={addNote}>{busy==="note"?"Salvando...":"Adicionar nota"}</button></div>
  {message?<small>{message}</small>:null}
 </section>;
}
