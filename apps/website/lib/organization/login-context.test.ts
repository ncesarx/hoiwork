import assert from "node:assert/strict";
import { test } from "node:test";
import { preferredOrganizationFromCookieHeader } from "./login-context";

test("login context reads only a bounded organization preference cookie", () => {
  assert.equal(preferredOrganizationFromCookieHeader("other=1; hoiwork_organization=org_123; session=secret"), "org_123");
  assert.equal(preferredOrganizationFromCookieHeader("other=1; hoiwork_organization=org%2Fother"), null);
  assert.equal(preferredOrganizationFromCookieHeader(`hoiwork_organization=${"x".repeat(129)}`), null);
  assert.equal(preferredOrganizationFromCookieHeader("hoiwork_organization_extra=org_123"), null);
  assert.equal(preferredOrganizationFromCookieHeader(null), null);
});
