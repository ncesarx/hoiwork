import type { ArchitectureNodeKind } from "./types";

export function TechnicalIcon({ kind }: { kind: ArchitectureNodeKind }) {
  if (kind === "internet" || kind === "dr") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M9 24h14a5 5 0 0 0 .8-9.94A8 8 0 0 0 8.6 11.7 6.2 6.2 0 0 0 9 24Z" />
      </svg>
    );
  }

  if (kind === "firewall") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M5 8h22v16H5zM5 13h22M12 8v5m8 0v5M8 18h12m-6 0v6m9-6v6" />
      </svg>
    );
  }

  if (kind === "switch") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="4" y="9" width="24" height="14" rx="3" />
        <path d="M8 16h3m3 0h3m3 0h4" />
      </svg>
    );
  }

  if (kind === "storage" || kind === "backup") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <ellipse cx="16" cy="8" rx="10" ry="4" />
        <path d="M6 8v8c0 2.2 4.5 4 10 4s10-1.8 10-4V8m-20 8v8c0 2.2 4.5 4 10 4s10-1.8 10-4v-8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x="6" y="4" width="20" height="24" rx="3" />
      <path d="M10 10h12M10 16h12M10 22h7" />
      <circle cx="22" cy="22" r="1" />
    </svg>
  );
}
