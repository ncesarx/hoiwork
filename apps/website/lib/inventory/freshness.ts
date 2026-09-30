export const COLLECTION_RECENT_MINUTES = 30;

export type CollectionFreshness =
  | "RECENT"
  | "STALE"
  | "NO_DATA"
  | "CLOCK_SKEW";

export function collectionFreshness(
  observedAt: Date | null,
  evaluatedAt: Date,
): CollectionFreshness {
  if (!observedAt || !Number.isFinite(observedAt.getTime())) return "NO_DATA";
  const ageMs = evaluatedAt.getTime() - observedAt.getTime();
  if (ageMs < -5 * 60_000) return "CLOCK_SKEW";
  return ageMs > COLLECTION_RECENT_MINUTES * 60_000 ? "STALE" : "RECENT";
}

export function formatCollectionTime(date: Date | null) {
  if (!date) return "sem coleta registrada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
