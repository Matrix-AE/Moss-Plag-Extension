"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const onboarding = require(path.join(root, "apps/api/provider/onboarding"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/provider-onboarding.md"), "utf8");

test("P074-T01 connect replace delete with masked display and encryption hook", () => {
  const svc = onboarding.createProviderOnboarding();
  const bad = svc.connect({ tenantId: "t1", mossUserId: "abc", actor: "user" });
  assert.equal(bad.ok, false);

  const connected = svc.connect({ tenantId: "t1", mossUserId: "12345", actor: "user" });
  assert.equal(connected.ok, true);
  assert.match(connected.display, /\*+/);
  assert.doesNotMatch(connected.display, /^12345$/);
  assert.ok(connected.encryptedRef);

  const replaced = svc.replace({
    tenantId: "t1",
    credentialId: connected.id,
    mossUserId: "99999",
    actor: "user",
  });
  assert.equal(replaced.ok, true);
  assert.notEqual(replaced.id, connected.id);

  const deleted = svc.deleteCredential({ tenantId: "t1", credentialId: replaced.id, actor: "user" });
  assert.equal(deleted.ok, true);
});

test("P074-T02 IDOR blocked across tenants", () => {
  const svc = onboarding.createProviderOnboarding();
  const a = svc.connect({ tenantId: "a", mossUserId: "111", actor: "a" });
  const cross = svc.replace({ tenantId: "b", credentialId: a.id, mossUserId: "222", actor: "b" });
  assert.equal(cross.ok, false);
  assert.equal(cross.error, "not-found");
  const peek = svc.getMasked({ tenantId: "b", credentialId: a.id });
  assert.equal(peek.ok, false);
});

test("P074-T03 kill switch disable mode and adapter selection", () => {
  const svc = onboarding.createProviderOnboarding();
  svc.connect({ tenantId: "t1", mossUserId: "12345", actor: "user" });
  assert.equal(svc.capabilities().submissionEnabled, true);

  const killed = svc.tripKillSwitch({ reason: "ops-drill", actor: "ops" });
  assert.equal(killed.ok, true);
  assert.equal(svc.capabilities().submissionEnabled, false);
  assert.equal(svc.capabilities().mode, "disabled");
  assert.match(svc.maintenanceCopy(), /unavailable|maintenance|disabled/i);

  const start = svc.beginSubmission({ tenantId: "t1" });
  assert.equal(start.ok, false);
  assert.equal(start.error, "provider-disabled");

  svc.clearKillSwitch({ actor: "ops" });
  assert.equal(svc.capabilities().submissionEnabled, true);

  const adapter = svc.selectAdapter({ requested: "mock" });
  assert.equal(adapter.ok, true);
  assert.equal(adapter.adapter, "mock");
  const silent = svc.selectAdapter({ requested: "commercial-encrypted", silent: true });
  assert.equal(silent.ok, false);
  assert.equal(silent.error, "silent-switch-forbidden");
});

test("P074-T04 stale client consent and in-flight preservation", () => {
  const svc = onboarding.createProviderOnboarding({ consentVersion: "1.0.0" });
  const stale = svc.handleStaleClient({ clientConsentVersion: "0.9.0", hasDraft: true });
  assert.equal(stale.ok, false);
  assert.equal(stale.error, "consent-upgrade-required");
  assert.equal(stale.preserveDrafts, true);

  const material = svc.requireDisclosureForProviderChange({
    fromAdapter: "mock",
    toAdapter: "commercial-encrypted",
  });
  assert.equal(material.requiresNewConsent, true);
  assert.equal(material.silent, false);

  svc.tripKillSwitch({ reason: "outage", actor: "ops" });
  const inflight = svc.listInFlightProtection();
  assert.equal(inflight.preserveDrafts, true);
  assert.equal(inflight.preserveExistingLinks, true);
  assert.equal(inflight.blocksNewWork, true);
});

test("P074-T05 no automated registration and docs cover onboarding", () => {
  const svc = onboarding.createProviderOnboarding();
  assert.equal(svc.automation.registrationForbidden, true);
  assert.equal(svc.automation.passwordRequestForbidden, true);
  assert.equal(svc.automation.sharedRotationForbidden, true);
  assert.match(doc, /kill switch/i);
  assert.match(doc, /BYO|numeric userid/i);
  assert.match(doc, /masked/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./provider/onboarding"], "./provider/onboarding.js");
});
