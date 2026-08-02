import { Button, Card, Container, Logo } from "@hoi/ui";

const services = [
  ["Infraestrutura", "Servidores, redes, storage e virtualização com foco em desempenho e continuidade."],
  ["Cloud Computing", "Soluções em nuvem seguras, escaláveis e adequadas ao ritmo do seu negócio."],
  ["Segurança", "Proteção em camadas com firewall, EDR, VPN, MFA e políticas de acesso."],
  ["Backup e DR", "Cópias imutáveis, replicação e recuperação de desastres para operações críticas."],
  ["Monitoramento", "Visibilidade contínua da infraestrutura com alertas e acompanhamento especializado."],
  ["Consultoria", "Projetos, governança e evolução tecnológica alinhados aos objetivos da empresa."]
] as const;

export function DesignSystemPreview() {
  return (
    <main>
      <section className="relative overflow-hidden py-10 sm:py-16 lg:py-24">
        <Container>
          <header className="mb-16 flex items-center justify-between gap-6">
            <Logo className="h-auto w-56 text-[var(--hoi-text)] sm:w-72" />
            <Button className="hidden sm:inline-flex" size="sm">
              Solicitar diagnóstico
            </Button>
          </header>

          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="mb-4 text-sm font-bold uppercase tracking-[0.24em] text-[var(--hoi-color-orange)]">
                Home &amp; Office Tech Solutions
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl lg:text-7xl">
                Parceria em soluções para sua empresa
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--hoi-text-muted)]">
                Infraestrutura corporativa, cloud, segurança da informação e suporte especializado para manter sua operação conectada, protegida e produtiva.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg">Solicitar diagnóstico</Button>
                <Button size="lg" variant="secondary">
                  Conheça nossas soluções
                </Button>
              </div>
            </div>

            <Card className="relative min-h-80 overflow-hidden p-8 sm:p-12">
              <div className="absolute inset-0 bg-[linear-gradient(145deg,transparent_15%,rgb(255_138_0_/_0.12),transparent_70%)]" />
              <div className="relative flex min-h-64 items-center justify-center">
                <Logo className="h-auto w-full max-w-md text-[var(--hoi-text)]" />
              </div>
            </Card>
          </div>
        </Container>
      </section>

      <section className="pb-20 lg:pb-28">
        <Container>
          <div className="mb-10 max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--hoi-color-orange)]">Design System v0.1</p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Primeiros componentes reutilizáveis</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {services.map(([title, description]) => (
              <Card key={title}>
                <div className="mb-5 h-11 w-11 rounded-2xl border border-orange-400/30 bg-orange-400/10" />
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="mt-3 leading-7 text-[var(--hoi-text-muted)]">{description}</p>
                <button className="mt-6 text-sm font-semibold text-[var(--hoi-color-orange)]" type="button">
                  Saiba mais →
                </button>
              </Card>
            ))}
          </div>
        </Container>
      </section>
    </main>
  );
}
