"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const terms = require(path.join(root, "apps/api/legal/terms"));
const doc = fs.readFileSync(path.join(root, "docs/legal/terms-of-service.md"), "utf8");

test("P076-T01 versioned terms cover license devices allowance use ownership", () => {
  const t = terms.getTerms();
  assert.equal(t.version, "1.0.0");
  assert.equal(t.offerVersion, "2.0.0");
  assert.equal(t.priceUsd, 15);
  assert.equal(t.runsIncluded, 15);
  assert.equal(t.deviceLimit, 2);
  assert.ok(t.sections.license);
  assert.ok(t.sections.acceptableUse);
  assert.ok(t.sections.ownership);
  assert.ok(t.sections.thirdParties);
  assert.ok(t.sections.disclaimers);
  assert.ok(t.sections.refunds);
  assert.ok(t.sections.support);
  assert.ok(t.sections.suspension);
  assert.ok(t.sections.shutdown);
});

test("P076-T02 disclaimers forbid accuracy uptime confidentiality permanent reports", () => {
  const t = terms.getTerms();
  assert.equal(t.guarantees.providerAccuracy, false);
  assert.equal(t.guarantees.uptime, false);
  assert.equal(t.guarantees.providerConfidentiality, false);
  assert.equal(t.guarantees.providerDeletion, false);
  assert.equal(t.guarantees.permanentReports, false);
  assert.equal(t.guarantees.browserCopyRevocation, false);
  assert.match(doc, /similarity is not a verdict/i);
  assert.match(doc, /bearer/i);
});

test("P076-T03 acceptance records timestamp and version", () => {
  const incomplete = terms.recordAcceptance({ userId: "u1", termsVersion: null });
  assert.equal(incomplete.ok, false);
  const accepted = terms.recordAcceptance({
    userId: "u1",
    termsVersion: "1.0.0",
    at: "2026-08-03T12:00:00.000Z",
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.evidence.termsVersion, "1.0.0");
  assert.equal(accepted.evidence.userId, "u1");
  assert.ok(accepted.evidence.acceptedAt);
});

test("P076-T04 terms accessible before purchase and reconcile with offer", () => {
  assert.equal(terms.mustPresentBeforePurchase(), true);
  assert.equal(terms.mustPresentBeforeSubmission(), true);
  const t = terms.getTerms();
  assert.match(t.sections.refunds, /14 days/i);
  assert.match(doc, /Terms of Service/i);
  assert.match(doc, /EULA|end.user/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./legal/terms"], "./legal/terms.js");
});
