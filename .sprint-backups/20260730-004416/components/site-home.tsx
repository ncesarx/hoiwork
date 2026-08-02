export function SiteHome() {
  return (
    <main style={{minHeight:"100vh",background:"#071925",color:"#fff",padding:"120px 40px",fontFamily:"Arial,sans-serif"}}>
      <section style={{maxWidth:1100,margin:"0 auto"}}>
        <p style={{color:"#d4a017",letterSpacing:"0.18em",textTransform:"uppercase",fontWeight:800}}>
          Infraestrutura • Cloud • Segurança • Suporte
        </p>
        <h1 style={{fontSize:"clamp(48px,7vw,84px)",lineHeight:0.98,margin:"24px 0"}}>
          Parceria em <span style={{color:"#f2bd35"}}>soluções</span><br/>para sua empresa
        </h1>
        <p style={{maxWidth:650,fontSize:20,lineHeight:1.7,color:"#e5e7ebaa"}}>
          Tecnologia corporativa para elevar a disponibilidade, proteger dados e transformar sua operação de TI.
        </p>
      </section>
    </main>
  );
}
