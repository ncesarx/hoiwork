"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const items = [
  ["/portal", "Dashboard", "◫"],
  ["/portal/chamados", "Chamados", "◎"],
  ["/portal/documentos", "Documentos", "▤"],
  ["/portal/manutencoes", "Manutenções", "◇"],
];

export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="portal">
      <aside className="portal-sidebar">
        <Link className="portal-brand" href="/">
          <span>HO</span>
          <div><strong>HOME & OFFICE</strong><small>CLIENT PORTAL</small></div>
        </Link>

        <nav>
          {items.map(([href, label, icon]) => {
            const active = href === "/portal" ? pathname === href : pathname.startsWith(href);
            return (
              <Link href={href} key={href} className={active ? "is-active" : ""}>
                <span>{icon}</span>{label}
              </Link>
            );
          })}
        </nav>

        <div className="portal-demo">
          <strong>Ambiente demonstrativo</strong>
          <small>Sem dados reais de clientes</small>
          <Link href="/">Voltar ao site</Link>
        </div>
      </aside>

      <div className="portal-content">
        <header className="portal-topbar">
          <div><small>Portal do Cliente</small><strong>Ambiente Corporativo</strong></div>
          <div className="portal-user"><span>HO</span><div><strong>Cliente Demonstração</strong><small>Administrador</small></div></div>
        </header>
        <main className="portal-main">{children}</main>
      </div>
    </div>
  );
}
