import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { getAutonomousGovernanceStatus } from "./autonomous-recovery-audit";

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
