import assert from "node:assert/strict";
import { test } from "node:test";
import { autonomousGovernanceRunDue, nextAutonomousGovernanceRunAt } from "./autonomous-governance-timing";

const startedAt = new Date("2026-10-01T21:00:00.000Z");
const base = {
  intervalMinutes: 5,
  lastRunAt: startedAt,
  lastFailureAt: null,
  lastSuccessAt: startedAt,
  consecutiveFailures: 0,
};

test("healthy scheduler runs at its configured interval", () => {
  assert.equal(nextAutonomousGovernanceRunAt(base)?.toISOString(), "2026-10-01T21:05:00.000Z");
  assert.equal(autonomousGovernanceRunDue(base, new Date("2026-10-01T21:04:59.999Z")), false);
  assert.equal(autonomousGovernanceRunDue(base, new Date("2026-10-01T21:05:00.000Z")), true);
  assert.equal(autonomousGovernanceRunDue({ ...base, lastRunAt: null }, startedAt), true);
});

test("failures retry gradually and never exceed the healthy interval", () => {
  for (const [failures, expectedMinutes] of [[1, 1], [2, 2], [3, 4], [4, 5], [20, 5]]) {
    const config = { ...base, consecutiveFailures: failures, lastFailureAt: startedAt };
    assert.equal(nextAutonomousGovernanceRunAt(config)?.getTime(), startedAt.getTime() + expectedMinutes * 60_000);
  }
  const longInterval = { ...base, intervalMinutes: 1440, consecutiveFailures: 20, lastFailureAt: startedAt };
  assert.equal(nextAutonomousGovernanceRunAt(longInterval)?.getTime(), startedAt.getTime() + 30 * 60_000);
});

test("stale failure evidence does not accelerate a successful scheduler", () => {
  const config = { ...base, lastFailureAt: new Date(startedAt.getTime() - 60_000), consecutiveFailures: 3 };
  assert.equal(nextAutonomousGovernanceRunAt(config)?.getTime(), startedAt.getTime() + 5 * 60_000);
});
