import { buildNotificationObservability } from "@/lib/observability/notification-slo";

type HealthState = "HEALTHY" | "DEGRADED" | "CRITICAL" | "NO_DATA";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function stateFromScore(score: number | null): HealthState {
  if (score === null) return "NO_DATA";
  if (score >= 90) return "HEALTHY";
  if (score >= 70) return "DEGRADED";
  return "CRITICAL";
}

function errorBudgetRemaining(successRate: number | null, target: number) {
  if (successRate === null) return null;
  const allowedError = 100 - target;
  const observedError = 100 - successRate;
  if (allowedError <= 0) return observedError <= 0 ? 100 : 0;
  return clamp(Math.round(((allowedError - observedError) / allowedError) * 10000) / 100);
}

function burnRate(successRate: number | null, target: number) {
  if (successRate === null) return null;
  const allowedError = 100 - target;
  const observedError = 100 - successRate;
  if (allowedError <= 0) return observedError <= 0 ? 0 : 999;
  return Math.round((observedError / allowedError) * 100) / 100;
}

export async function buildNocHealthModel(organizationId: string) {
  const obs = await buildNotificationObservability(organizationId);

  const windows = {
    h1: {
      successRate: obs.delivery.h1.successRate,
      errorBudgetRemaining: errorBudgetRemaining(obs.delivery.h1.successRate, obs.slo.deliverySuccessTarget),
      burnRate: burnRate(obs.delivery.h1.successRate, obs.slo.deliverySuccessTarget),
    },
    h24: {
      successRate: obs.delivery.h24.successRate,
      errorBudgetRemaining: errorBudgetRemaining(obs.delivery.h24.successRate, obs.slo.deliverySuccessTarget),
      burnRate: burnRate(obs.delivery.h24.successRate, obs.slo.deliverySuccessTarget),
    },
    d7: {
      successRate: obs.delivery.d7.successRate,
      errorBudgetRemaining: errorBudgetRemaining(obs.delivery.d7.successRate, obs.slo.deliverySuccessTarget),
      burnRate: burnRate(obs.delivery.d7.successRate, obs.slo.deliverySuccessTarget),
    },
  };

  const deliveryScore =
    obs.delivery.h24.successRate === null
      ? null
      : clamp(Math.round(obs.delivery.h24.successRate));

  const retryScore =
    obs.delivery.h24.retryRate === null
      ? null
      : clamp(Math.round(100 - obs.delivery.h24.retryRate * 5));

  const automationScore =
    obs.automation.h24.successRate === null
      ? null
      : clamp(Math.round(obs.automation.h24.successRate));

  const connectorScore = obs.connectors.averageScore;

  const availableScores = [
    deliveryScore,
    retryScore,
    automationScore,
    connectorScore,
  ].filter((value): value is number => value !== null);

  const nocHealthScore = availableScores.length
    ? Math.round(availableScores.reduce((a, b) => a + b, 0) / availableScores.length)
    : null;

  const state = stateFromScore(nocHealthScore);

  const burnState: HealthState =
    windows.h1.burnRate === null
      ? "NO_DATA"
      : windows.h1.burnRate >= 10
        ? "CRITICAL"
        : windows.h1.burnRate >= 2
          ? "DEGRADED"
          : "HEALTHY";

  return {
    generatedAt: new Date(),
    state,
    nocHealthScore,
    burnState,
    components: {
      deliveryScore,
      retryScore,
      automationScore,
      connectorScore,
    },
    windows,
    source: obs,
  };
}
