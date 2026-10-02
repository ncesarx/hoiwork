import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { getAutonomousGovernanceStatus } from "./autonomous-recovery-audit";
import { recoverInterruptedAutonomousGovernanceRuns } from "./autonomous-governance-automation";
import { autonomousGovernanceRunDue } from "./autonomous-governance-timing";

test("governance status hides legacy exception text from config and run history", async () => {
  requireDisposableDatabase();
  const organization = await prisma.organization.create({ data: {
    name: "Safe governance status", slug: `safe-governance-${randomUUID()}`,
  } });
  const secret = "postgresql://private-user:private-password@localhost:5432/hoiwork";
  try {
    await prisma.autonomousGovernanceAutomationConfig.create({ data: {
      organizationId: organization.id, enabled: true,
      lastError: secret, consecutiveFailures: 1, lastFailureAt: new Date(),
    } });
    await prisma.autonomousGovernanceAutomationRun.create({ data: {
      organizationId: organization.id, source: "SCHEDULER", mode: "DRY_RUN",
      status: "FAILED", errorMessage: secret,
    } });
    const legacy = await getAutonomousGovernanceStatus(organization.id);
    assert.equal(JSON.stringify(legacy).includes(secret), false);
    assert.equal(legacy.automation.config?.lastError, "Falha anterior da automação; consulte os logs do HOIWORK.");
    assert.equal(legacy.automation.lastRun?.errorMessage, legacy.automation.config?.lastError);

    await prisma.autonomousGovernanceAutomationConfig.update({
      where: { organizationId: organization.id }, data: { lastError: "DATABASE_TIMEOUT" },
    });
    const coded = await getAutonomousGovernanceStatus(organization.id);
    assert.equal(coded.automation.config?.lastError, "Tempo limite ao consultar o banco de dados.");
  } finally {
    await prisma.autonomousGovernanceAutomationRun.deleteMany({ where: { organizationId: organization.id } });
    await prisma.autonomousGovernanceAutomationConfig.delete({ where: { organizationId: organization.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
  }
});

test("interrupted governance runs are recovered once within their organization", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID();
  const [first, second] = await Promise.all([
    prisma.organization.create({ data: { name: "Interrupted", slug: `interrupted-${suffix}` } }),
    prisma.organization.create({ data: { name: "Other", slug: `interrupted-other-${suffix}` } }),
  ]);
  try {
    await Promise.all([first, second].map((organization) =>
      prisma.autonomousGovernanceAutomationConfig.create({ data: {
        organizationId: organization.id, enabled: true, intervalMinutes: 5, commitEnabled: false,
      } })));
    await prisma.autonomousGovernanceAutomationRun.createMany({ data: [
      { organizationId: first.id, source: "SCHEDULER", mode: "DRY_RUN", status: "RUNNING" },
      { organizationId: first.id, source: "MANUAL", mode: "DRY_RUN", status: "RUNNING" },
      { organizationId: first.id, source: "SCHEDULER", mode: "DRY_RUN", status: "COMPLETED" },
      { organizationId: second.id, source: "SCHEDULER", mode: "DRY_RUN", status: "RUNNING" },
    ] });

    assert.equal(await recoverInterruptedAutonomousGovernanceRuns(first.id), 2);
    assert.equal(await recoverInterruptedAutonomousGovernanceRuns(first.id), 0);
    const firstRuns = await prisma.autonomousGovernanceAutomationRun.findMany({ where: { organizationId: first.id } });
    assert.equal(firstRuns.filter((run) => run.status === "FAILED" && run.errorMessage === "INTERRUPTED" && run.finishedAt).length, 2);
    assert.equal(firstRuns.filter((run) => run.status === "COMPLETED").length, 1);
    assert.equal(await prisma.autonomousGovernanceAutomationRun.count({ where: { organizationId: second.id, status: "RUNNING" } }), 1);
    const config = await prisma.autonomousGovernanceAutomationConfig.findUniqueOrThrow({ where: { organizationId: first.id } });
    assert.equal(config.consecutiveFailures, 1);
    assert.equal(config.lastError, "INTERRUPTED");
    assert.equal(autonomousGovernanceRunDue(config, config.lastRunAt!), false);
    assert.equal(autonomousGovernanceRunDue(config, new Date(config.lastRunAt!.getTime() + 60_000)), true);
    const status = await getAutonomousGovernanceStatus(first.id);
    assert.equal(status.automation.health, "DEGRADED");
    assert.equal(status.automation.config?.lastError, "Execução interrompida; o scheduler retomará a avaliação.");
  } finally {
    await prisma.autonomousGovernanceAutomationRun.deleteMany({ where: { organizationId: { in: [first.id, second.id] } } });
    await prisma.autonomousGovernanceAutomationConfig.deleteMany({ where: { organizationId: { in: [first.id, second.id] } } });
    await Promise.all([first, second].map((organization) => prisma.organization.delete({ where: { id: organization.id } })));
  }
});
