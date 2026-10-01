"use client";

import { useState } from "react";
import styles from "./organization-switcher.module.css";

export function OrganizationSwitcher({ currentId, options }: {
  currentId: string;
  options: { organizationId: string; organization: { name: string } }[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (options.length < 2) return null;
  return <div className={styles.switcher}>
    <label htmlFor="organization-switch">Organização</label>
    <select id="organization-switch" value={currentId} disabled={busy} onChange={async (event) => {
      const organizationId = event.target.value;
      setBusy(true);
      setError("");
      try {
        const response = await fetch("/api/account/organization", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId }),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error ?? `HTTP ${response.status}`);
        window.location.assign("/portal");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Falha ao trocar organização.");
        setBusy(false);
      }
    }}>
      {options.map(({ organizationId, organization }) => <option key={organizationId} value={organizationId}>{organization.name}</option>)}
    </select>
    {error ? <small role="alert">{error}</small> : null}
  </div>;
}
