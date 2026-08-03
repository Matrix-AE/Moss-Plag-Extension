"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const offer = require(path.join(root, "apps/api/commerce/customer-offer"));
const historical = require(path.join(root, "docs/product/offer-economics-model.js"));
const doc = fs.readFileSync(path.join(root, "docs/product/customer-offer-v2.md"), "utf8");

test("P073-T01 approved offer locks price allowance devices files refund support", () => {
  const o = offer.getApprovedOffer();
  assert.equal(o.version, "2.0.0");
  assert.equal(o.priceUsd, 15);
  assert.equal(o.currency, "USD");
  assert.equal(o.runsIncluded, 15);
  assert.equal(o.maxFilesPerRun, 2);
  assert.equal(o.deviceLimit, 2);
  assert.equal(o.hostedOperabilityMonths, 36);
  assert.equal(o.refundDaysUnused, 14);
  assert.equal(o.featureEntitlement, "non-expiring-core-features");
  assert.match(o.majorVersionPolicy, /current-major/);
  assert.match(o.shutdownRemedy, /disable-new-hosted/);
  assert.equal(o.forbidsVagueFairUse, true);
  assert.equal(o.forbidsHiddenThrottle, true);
  assert.equal(o.forbidsUnlimitedLifetimeHosting, true);
  assert.equal(o.forbidsAccountEvasion, true);
});

test("P073-T02 unit economics remain viable under revalidated allowance", () => {
  const gate = offer.evaluateOfferEconomics();
  assert.equal(gate.decision, "go");
  assert.ok(gate.scenarios.conservative.contributionMarginUsd > 0);
  assert.ok(gate.scenarios.expected.contributionMarginUsd > 0);
  assert.ok(gate.scenarios.worstCase.contributionMarginUsd > 0);
  assert.equal(gate.requiresPrompt095Revalidation, true);
  assert.equal(gate.dependsOnUnavailableBetaData, false);
});

test("P073-T03 supersedes Prompt 006 numeric allowance while preserving price devices", () => {
  assert.equal(historical.OFFER.hostedChecksIncluded, 40);
  assert.equal(offer.getApprovedOffer().runsIncluded, 15);
  assert.equal(offer.getApprovedOffer().priceUsd, historical.OFFER.priceUsd);
  assert.equal(offer.getApprovedOffer().deviceLimit, historical.OFFER.devices);
  assert.match(doc, /supersedes/i);
  assert.match(doc, /\*\*15\*\* hosted similarity checks/);
  assert.match(doc, /max \*\*2\*\* files/);
});

test("P073-T04 single versioned offer drives downstream surfaces", () => {
  const downstream = offer.downstreamParameters();
  assert.equal(downstream.offerVersion, "2.0.0");
  assert.equal(downstream.numericHostedAllowance, 15);
  assert.equal(downstream.maxFilesPerRun, 2);
  assert.equal(downstream.deviceLimit, 2);
  assert.equal(downstream.drivesCapabilityConfig, true);
  assert.equal(downstream.drivesQuotaRules, true);
  assert.equal(downstream.drivesTerms, true);
  assert.equal(downstream.drivesCheckoutCopy, true);
  assert.equal(downstream.drivesSupport, true);
  assert.equal(downstream.drivesFinancialReserve, true);
});

test("P073-T05 sensitivity and financial reserve are explicit", () => {
  const gate = offer.evaluateOfferEconomics();
  assert.ok(gate.sensitivity.maxProviderCostPerRun > 0);
  assert.ok(gate.financialReserveUsd >= 0);
  assert.match(doc, /Prompt 095/);
  assert.match(doc, /worst-case/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./commerce/customer-offer"], "./commerce/customer-offer.js");
});
