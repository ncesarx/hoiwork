import assert from "node:assert/strict";
import { test } from "node:test";
import { buildManualAssetCsv, type ManualAssetCsvRow } from "./manual-asset-csv";

test("manual CSV preserves Portuguese, quotes separators, blocks formulas and excludes raw properties", () => {
  const row = { name: '  =HYPERLINK("unsafe")', type: "WORKSTATION", manufacturer: "@formula",
    model: "+formula", serialNumber: "-formula", ipAddress: null, location: 'Recepção; "Sul"\nSala 2',
    status: "UNKNOWN", updatedAt: new Date("2026-10-03T15:00:00Z"), metadata: { token: "private-secret" } };
  const csv = buildManualAssetCsv("Empresa Ágil", [row]);
  assert.ok(csv.startsWith('\uFEFF"Empresa";'));
  assert.ok(csv.includes('"\'  =HYPERLINK(""unsafe"")"'));
  for (const formula of ["@formula", "+formula", "-formula"]) assert.ok(csv.includes(`"'${formula}"`));
  assert.ok(csv.includes('"Recepção; ""Sul"" Sala 2"'));
  assert.ok(csv.includes('"Computador"'));
  assert.ok(csv.includes('"Sem estado verificado"'));
  assert.ok(csv.includes('"2026-10-03T15:00:00.000Z"'));
  assert.doesNotMatch(csv, /private-secret|metadata/);
  assert.equal(csv.split("\r\n").length, 3);
});

test("an empty export still contains column headings and known status is not rewritten", () => {
  assert.equal(buildManualAssetCsv("Empresa", []).split("\r\n").length, 2);
  const row: ManualAssetCsvRow = { name: "Servidor", type: "SERVER", manufacturer: null, model: null,
    serialNumber: null, ipAddress: null, location: null, status: "OFFLINE", updatedAt: new Date(0) };
  assert.ok(buildManualAssetCsv("Empresa", [row]).includes('"OFFLINE"'));
});
