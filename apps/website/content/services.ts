export type Service = { id:string; title:string; description:string; href:string; icon:"infrastructure"|"cloud"|"security"|"support"; };
export const services: Service[] = [
{id:"infraestrutura",title:"Infraestrutura",description:"Servidores, redes, virtualização e storage para ambientes críticos.",href:"#solucoes",icon:"infrastructure"},
{id:"cloud",title:"Cloud",description:"Soluções em nuvem seguras, escaláveis e integradas à operação.",href:"#tecnologias",icon:"cloud"},
{id:"seguranca",title:"Segurança",description:"Proteção de dados, acessos, endpoints e sistemas essenciais.",href:"#arquitetura",icon:"security"},
{id:"suporte",title:"Suporte Especializado",description:"Atendimento técnico próximo e orientado à continuidade.",href:"#contato",icon:"support"},
];
