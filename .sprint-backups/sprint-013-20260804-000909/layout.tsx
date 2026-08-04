import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal/portal-shell";
import { requireOrganization } from "@/lib/authz";
import "./portal.css";
import "./enterprise.css";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  await requireOrganization();
  return <PortalShell>{children}</PortalShell>;
}
