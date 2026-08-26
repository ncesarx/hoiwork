import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildPostRemediationStability } from "@/lib/incidents/post-remediation-stability";

type SessionLike = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
};

function envTrue(name: string, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

function actor(session: SessionLike) {
  return {
    id: session.user.id,
    name: session.user.name ?? session.user.email ?? "Administrador",
  };
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function evaluateGovernedAutonomousClosure(
  organizationId: string,
  incidentId: string,
) {
  const [incident, stability] = await Promise.all([
    prisma.infrastructureIncident.findFirst({
      where: { id: incidentId, organizationId },
    }),
    buildPostRemediationStability(organizationId, incidentId),
  ]);

  if (!incident || !stability) return null;

  const policyEnabled = envTrue(
    "HOIWORK_POST_REMEDIATION_AUTO_CLOSURE_ENABLED",
    false,
  );

  const requireHealthyDiscovery = envTrue(
    "HOIWORK_POST_REMEDIATION_REQUIRE_HEALTHY_DISCOVERY",
    true,
  );

  const minimumConfidence = Math.max(
    0,
    Math.min(
      100,
      Number(process.env.HOIWORK_POST_REMEDIATION_MIN_CONFIDENCE ?? "100"),
    ),
  );

  const maxDiscoveryConsecutiveFailures = Math.max(
    0,
    Number(
      process.env.HOIWORK_POST_REMEDIATION_MAX_DISCOVERY_FAILURES ?? "0",
    ),
  );

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!["OPEN", "ACKNOWLEDGED"].includes(incident.status)) {
    blockers.push("INCIDENT_NOT_OPEN");
  }

  if (stability.stabilityState !== "RECOVERY_STABLE") {
    blockers.push("RECOVERY_NOT_STABLE");
  }

  if (stability.recoveryVerified !== true) {
    blockers.push("RECOVERY_NOT_VERIFIED");
  }

  if (stability.closureReady !== true) {
    blockers.push("STABILITY_GATE_NOT_READY");
  }

  if (stability.confidenceScore < minimumConfidence) {
    blockers.push("CONFIDENCE_BELOW_POLICY");
  }

  if (requireHealthyDiscovery) {
    if (stability.observability.enabled !== true) {
      blockers.push("DISCOVERY_AUTOMATION_DISABLED");
    }

    if (
      stability.observability.consecutiveFailures >
      maxDiscoveryConsecutiveFailures
    ) {
      blockers.push("DISCOVERY_HEALTH_DEGRADED");
    }
  } else if (stability.observability.consecutiveFailures > 0) {
    warnings.push("DISCOVERY_HEALTH_DEGRADED_BUT_POLICY_ALLOWS");
  }

  if (!policyEnabled) {
    blockers.push("AUTO_CLOSURE_POLICY_DISABLED");
  }

  const decision =
    blockers.length === 0
      ? "AUTO_CLOSURE_ELIGIBLE"
      : "AUTO_CLOSURE_BLOCKED";

  return {
    version: "015.6.11.6.4.3",
    evaluatedAt: new Date(),
    decision,
    eligibleForClosure: blockers.length === 0,
    blockers,
    warnings,
    policy: {
      enabled: policyEnabled,
      minimumConfidence,
      requireHealthyDiscovery,
      maxDiscoveryConsecutiveFailures,
      failClosed: true,
    },
    incident: {
      id: incident.id,
      status: incident.status,
      resolvedAt: incident.resolvedAt,
      assetName: incident.assetName,
      assetExternalId: incident.assetExternalId,
    },
    stability,
  };
}

export async function executeGovernedAutonomousClosure(input: {
  organizationId: string;
  incidentId: string;
  session: SessionLike;
}) {
  if (input.session.user.role !== "ADMIN") {
    throw new Error("Somente ADMIN pode acionar o fechamento governado.");
  }

  const evaluation = await evaluateGovernedAutonomousClosure(
    input.organizationId,
    input.incidentId,
  );

  if (!evaluation) {
    throw new Error("Incidente ou evidência pós-remediação não encontrada.");
  }

  if (!evaluation.eligibleForClosure) {
    throw new Error(
      `Auto-closure bloqueado: ${evaluation.blockers.join(", ")}`,
    );
  }

  const who = actor(input.session);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const current = await tx.infrastructureIncident.findFirst({
      where: {
        id: input.incidentId,
        organizationId: input.organizationId,
      },
    });

    if (!current) {
      throw new Error("Incidente não encontrado.");
    }

    if (!["OPEN", "ACKNOWLEDGED"].includes(current.status)) {
      throw new Error("Incidente não está mais elegível para fechamento.");
    }

    const updated = await tx.infrastructureIncident.update({
      where: { id: current.id },
      data: {
        status: "RESOLVED",
        resolvedAt: now,
        lastSeenAt: now,
        metadata: json({
          ...(current.metadata &&
          typeof current.metadata === "object" &&
          !Array.isArray(current.metadata)
            ? current.metadata
            : {}),
          postRemediationClosureDecision: "AUTO_CLOSED",
          postRemediationClosureAt: now.toISOString(),
          postRemediationClosureBy: who.name,
          postRemediationClosureVersion: "015.6.11.6.4.3",
          postRemediationClosureConfidence:
            evaluation.stability.confidenceScore,
          postRemediationStabilityState:
            evaluation.stability.stabilityState,
          postRemediationClosurePolicy: evaluation.policy,
        }),
      },
    });

    await tx.infrastructureIncidentEvent.create({
      data: {
        organizationId: input.organizationId,
        incidentId: current.id,
        eventType: "POST_REMEDIATION_AUTO_CLOSED",
        message:
          `Incidente fechado após recuperação estável e verificada. ` +
          `Confidence=${evaluation.stability.confidenceScore}%.`,
        actorUserId: who.id,
        actorName: who.name,
        fromStatus: current.status,
        toStatus: "RESOLVED",
        metadata: json({
          version: "015.6.11.6.4.3",
          decision: evaluation.decision,
          confidenceScore: evaluation.stability.confidenceScore,
          stabilityState: evaluation.stability.stabilityState,
          evidenceCount: evaluation.stability.evidenceCount,
          stableForSeconds: evaluation.stability.stableForSeconds,
          observability: evaluation.stability.observability,
          policy: evaluation.policy,
        }),
      },
    });

    return {
      incident: updated,
      evaluation,
    };
  });
}
