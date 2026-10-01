import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAccessAuditCsv, parseAuditPeriod } from "./access-audit-export";

test("audit export validates UTC day ranges and defaults to the prior 90 days", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");
  assert.deepEqual(parseAuditPeriod(null, null, now), {
    from: new Date("2026-07-03T12:00:00.000Z"), toExclusive: now,
  });
  assert.deepEqual(parseAuditPeriod("2026-09-30", "2026-10-01", now), {
    from: new Date("2026-09-30T00:00:00.000Z"), toExclusive: new Date("2026-10-02T00:00:00.000Z"),
  });
  assert.equal(parseAuditPeriod("2026-02-30", "2026-03-01", now), null);
  assert.equal(parseAuditPeriod("2026-10-02", "2026-10-01", now), null);
  assert.equal(parseAuditPeriod("2025-01-01", "2026-10-01", now), null);
  assert.equal(parseAuditPeriod("2026-10-01", null, now), null);
});

test("CSV exports no formulas, line breaks, raw metadata or spreadsheet cells outside quotes", () => {
  const rows = [{
    id: "test", createdAt: new Date("2026-10-01T12:00:00.000Z"),
    action: "Papel alterado", actor: '=HYPERLINK("https://example.test")',
    target: "someone@example.test\r\nnew-row", details: "CLIENT;TECHNICIAN",
  }];
  const csv = buildAccessAuditCsv(rows);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.test"")"'));
  assert.ok(csv.includes('"someone@example.test  new-row"'));
  assert.ok(csv.includes('"CLIENT;TECHNICIAN"'));
  assert.equal(csv.trimEnd().split("\r\n").length, 2);
});
