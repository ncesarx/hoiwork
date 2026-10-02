import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyGovernanceFailure, publicGovernanceFailure } from "./autonomous-governance-failure";

test("failure classification never exposes exception messages, credentials or arbitrary codes", () => {
  const credential = "postgresql://private-user:private-password@localhost:5432/hoiwork";
  assert.equal(classifyGovernanceFailure({ code: "P1001", message: credential }), "DATABASE_UNAVAILABLE");
  assert.equal(classifyGovernanceFailure({ code: "P2024", message: credential }), "DATABASE_TIMEOUT");
  assert.equal(classifyGovernanceFailure({ code: "23505", message: credential }), "DATABASE_ERROR");
  assert.equal(classifyGovernanceFailure({ code: "ECONNREFUSED", message: credential }), "DEPENDENCY_UNAVAILABLE");
  assert.equal(classifyGovernanceFailure(new Error(credential)), "EVALUATION_FAILED");
  assert.equal(classifyGovernanceFailure({ code: credential }), "EVALUATION_FAILED");
  assert.equal(publicGovernanceFailure("P1001"), "Falha anterior da automação; consulte os logs do HOIWORK.");
  assert.equal(publicGovernanceFailure(credential), "Falha anterior da automação; consulte os logs do HOIWORK.");
  assert.equal(publicGovernanceFailure("DATABASE_UNAVAILABLE"), "Banco de dados indisponível.");
  assert.equal(publicGovernanceFailure("INTERRUPTED"), "Execução interrompida; o scheduler retomará a avaliação.");
  assert.equal(publicGovernanceFailure(null), null);
});
