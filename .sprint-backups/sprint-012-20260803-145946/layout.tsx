import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal/portal-shell";
import "./portal.css";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
