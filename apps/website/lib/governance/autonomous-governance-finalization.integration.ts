import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { requireDisposableDatabase } from "@/lib/test-support/disposable-db";
import { runAutonomousGovernanceAutomation } from "./autonomous-governance-automation";

test("completion rolls back together and failure is saved before releasing the advisory lock", async () => {
  requireDisposableDatabase();
  const suffix = randomUUID().replaceAll("-", "");
  const trigger = `governance_finalization_${suffix}`;
  const organization = await prisma.organization.create({ data: {
    name: "Finalization", slug: `finalization-${suffix}`,
  } });
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const run = () => runAutonomousGovernanceAutomation({
    organizationId: organization.id, source: "MANUAL", dryRunOnly: true,
  });
  try {
    await client.connect();
    await prisma.autonomousGovernanceAutomationConfig.create({ data: {
      organizationId: organization.id, enabled: true, commitEnabled: false,
    } });
    // This trigger only affects the disposable fixture's organization.
    await client.query(`CREATE FUNCTION ${trigger}() RETURNS trigger AS $$
      BEGIN
        IF NEW."organizationId" = '${organization.id}' THEN
          IF NEW."lastSuccessAt" IS NOT NULL THEN
            RAISE EXCEPTION 'test_completion_write_rejected';
          END IF;
          IF NEW."lastError" IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND granted
              AND classid = (hashtext('hoiwork:autonomous-governance-automation')::bigint & 4294967295)::oid
              AND objid = (hashtext(NEW."organizationId")::bigint & 4294967295)::oid
              AND objsubid = 2
          ) THEN
            RAISE EXCEPTION 'test_failure_saved_without_lock';
          END IF;
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`);
    await client.query(`CREATE TRIGGER ${trigger} BEFORE UPDATE ON "AutonomousGovernanceAutomationConfig"
      FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
    await assert.rejects(run(), (error: unknown) =>
      error instanceof Error && error.message.includes("test_completion_write_rejected"));
    const failedRuns = await prisma.autonomousGovernanceAutomationRun.findMany({ where: { organizationId: organization.id } });
    const failedConfig = await prisma.autonomousGovernanceAutomationConfig.findUniqueOrThrow({ where: { organizationId: organization.id } });
    assert.equal(failedRuns.length, 1);
    assert.equal(failedRuns[0].status, "FAILED");
    assert.equal(failedRuns[0].capabilities, 0);
    assert.equal(failedRuns[0].errorMessage, failedConfig.lastError);
    assert.ok(failedConfig.lastError);
    assert.equal(failedConfig.lastSuccessAt, null);
    assert.equal(failedConfig.lastRunAt?.getTime(), failedRuns[0].finishedAt?.getTime());
    assert.equal(failedConfig.consecutiveFailures, 1);

    await client.query(`DROP TRIGGER ${trigger} ON "AutonomousGovernanceAutomationConfig"`);
    const success = await run();
    assert.equal(success.skipped, false);
    if (success.skipped) throw new Error("Expected completed evaluation");
    assert.equal(success.status, "COMPLETED");
    assert.equal(success.mode, "DRY_RUN");
    assert.equal(success.capabilities, 6);
    const successfulRun = await prisma.autonomousGovernanceAutomationRun.findUniqueOrThrow({ where: { id: success.runId } });
    const healthyConfig = await prisma.autonomousGovernanceAutomationConfig.findUniqueOrThrow({ where: { organizationId: organization.id } });
    assert.equal(successfulRun.status, "COMPLETED");
    assert.equal(healthyConfig.lastSuccessAt?.getTime(), successfulRun.finishedAt?.getTime());
    assert.equal(healthyConfig.lastError, null);
    assert.equal(healthyConfig.consecutiveFailures, 0);
    assert.equal(healthyConfig.commitEnabled, false);
    assert.equal(await prisma.autonomousCapabilityGovernanceState.count({ where: { organizationId: organization.id } }), 0);
  } finally {
    await client.query(`DROP TRIGGER IF EXISTS ${trigger} ON "AutonomousGovernanceAutomationConfig"`);
    await client.query(`DROP FUNCTION IF EXISTS ${trigger}()`);
    await client.end();
    await prisma.autonomousGovernanceAutomationRun.deleteMany({ where: { organizationId: organization.id } });
    await prisma.autonomousGovernanceAutomationConfig.deleteMany({ where: { organizationId: organization.id } });
    await prisma.controlPlaneSloPolicy.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
  }
});
