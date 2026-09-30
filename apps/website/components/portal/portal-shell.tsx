"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const items = [
  ["/portal", "Dashboard", "◫"],
  ["/portal/contratos", "Contratos", "▧"],
  ["/portal/disaster-recovery", "Disaster Recovery", "◇"],
  ["/portal/backup", "Backup Center", "▤"],
  ["/portal/inventario", "Inventário", "▦"],
  ["/portal/integracoes", "Integrações", "◉"],
  ["/portal/discovery", "Discovery", "⌁"],
  ["/portal/chamados", "Chamados", "◎"],
  ["/portal/documentos", "Documentos", "▤"],
  ["/portal/manutencoes", "Manutenções", "◇"],
  ["/portal/ajuda", "Ajuda", "?"],
];

export function PortalShell({
  children,
  organizationName,
  userName,
  isAdmin,
}: {
  children: ReactNode;
  organizationName: string;
  userName: string;
  isAdmin: boolean;
}) {
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
          {isAdmin ? (
            <Link href="/portal/organizacao" className={pathname.startsWith("/portal/organizacao") ? "is-active" : ""}>
              <span>♙</span>Organização e acessos
            </Link>
          ) : null}
        </nav>

        <div className="portal-demo">
          <strong>{organizationName}</strong>
          <small>Dados da sua organização</small>
          <Link href="/portal/inventario">Abrir inventário</Link>
        </div>
      </aside>

      <div className="portal-content">
        <header className="portal-topbar">
          <div><small>Portal do Cliente</small><strong>Ambiente Corporativo</strong></div>
          <div className="portal-user"><span>HO</span><div><strong>{userName}</strong><small>{organizationName}</small></div></div>
        </header>
        <main className="portal-main">{children}</main>
      </div>
    </div>
  );
}
