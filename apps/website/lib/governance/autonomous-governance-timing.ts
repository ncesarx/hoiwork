type AutomationSchedule = {
  intervalMinutes: number;
  lastRunAt: Date | null;
  lastFailureAt: Date | null;
  lastSuccessAt: Date | null;
  consecutiveFailures: number;
};

export function nextAutonomousGovernanceRunAt(config: AutomationSchedule): Date | null {
  if (!config.lastRunAt) return null;

  const retrying = config.consecutiveFailures > 0 &&
    config.lastFailureAt !== null &&
    (!config.lastSuccessAt || config.lastFailureAt >= config.lastSuccessAt);
  // The systemd timer runs once per minute. Back off on repeated failures,
  // but never retry less often than the configured healthy interval.
  const retryMinutes = retrying
    ? Math.min(config.intervalMinutes, 30, 2 ** Math.min(config.consecutiveFailures - 1, 5))
    : config.intervalMinutes;

  return new Date(config.lastRunAt.getTime() + retryMinutes * 60_000);
}

export function autonomousGovernanceRunDue(config: AutomationSchedule, now: Date) {
  const next = nextAutonomousGovernanceRunAt(config);
  return next === null || now >= next;
}
