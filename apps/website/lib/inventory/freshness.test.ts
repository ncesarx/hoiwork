import assert from "node:assert/strict";
import { test } from "node:test";
import { collectionFreshness } from "./freshness";

test("distinguishes recent, stale, missing and future collection evidence", () => {
  const now = new Date("2026-09-30T00:00:00Z");
  assert.equal(collectionFreshness(null, now), "NO_DATA");
  assert.equal(collectionFreshness(new Date(now.getTime() - 30 * 60_000), now), "RECENT");
  assert.equal(collectionFreshness(new Date(now.getTime() - 31 * 60_000), now), "STALE");
  assert.equal(collectionFreshness(new Date(now.getTime() + 6 * 60_000), now), "CLOCK_SKEW");
});
