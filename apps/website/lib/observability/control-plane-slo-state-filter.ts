const TRANSIENT_AUTOMATION_WARNINGS = new Set([
  "DISCOVERY_STATUS_RUNNING",
  "SLA_AUTOMATION_STATUS_RUNNING",
]);

export function classifyControlPlaneSnapshotForSlo(input: {
  rawState: string;
  score: number | null;
  confidence: string;
  blockers: string[];
  warnings: string[];
  rootCauseCount: number;
  blockedCapabilityCount: number;
}) {
  const transientWarnings = input.warnings.filter((warning) =>
    TRANSIENT_AUTOMATION_WARNINGS.has(warning),
  );

  const nonTransientWarnings = input.warnings.filter(
    (warning) => !TRANSIENT_AUTOMATION_WARNINGS.has(warning),
  );

  const eligibleForTransientNormalization =
    input.rawState === "DEGRADED" &&
    input.confidence === "HIGH" &&
    (input.score ?? 0) >= 90 &&
    input.blockers.length === 0 &&
    input.rootCauseCount === 0 &&
    input.blockedCapabilityCount === 0 &&
    input.warnings.length > 0 &&
    nonTransientWarnings.length === 0;

  const sloState = eligibleForTransientNormalization
    ? "HEALTHY"
    : input.rawState;

  return {
    version: "015.6.11.7.4.4.1",
    rawState: input.rawState,
    sloState,
    normalized: sloState !== input.rawState,
    transientWarnings,
    nonTransientWarnings,
    reason:
      sloState !== input.rawState
        ? "TRANSIENT_AUTOMATION_RUNNING_ONLY"
        : "RAW_STATE_PRESERVED",
  };
}
