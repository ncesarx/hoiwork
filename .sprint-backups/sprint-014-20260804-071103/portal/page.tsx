import { PortalDashboard } from "@/components/portal/portal-dashboard";

export const metadata = {
  title: "Portal do Cliente",
  robots: { index: false, follow: false },
};

export default function PortalPage() {
  return <PortalDashboard />;
}
