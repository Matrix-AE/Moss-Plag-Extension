"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const model = require(path.join(repositoryRoot, "docs", "product", "offer-economics-model.js"));
const docPath = path.join(repositoryRoot, "docs", "product", "offer-and-unit-economics.md");
const doc = fs.readFileSync(docPath, "utf8");

test("P006-T01 offer locks price, devices, allowance, and hosted EOL", () => {
  assert.equal(model.OFFER.priceUsd, 15);
  assert.equal(model.OFFER.devices, 2);
  assert.equal(model.OFFER.hostedChecksIncluded, 40);
  assert.equal(model.OFFER.hostedOperabilityMonths, 36);
  assert.equal(model.OFFER.refundDaysUnused, 14);
  assert.equal(model.OFFER.featureEntitlement, "non-expiring-core-features");
  assert.match(model.OFFER.majorVersionPolicy, /current-major/);
  assert.match(model.OFFER.hostedEolRemedy, /disable-new-hosted-checks/);
});

test("P006-T02 conservative and expected margins are greater than zero", () => {
  const gate = model.evaluateGate();
  assert.equal(gate.scenarios.conservative.contributionMarginUsd, 1.1);
  assert.equal(gate.scenarios.expected.contributionMarginUsd, 10.06);
  assert.equal(gate.scenarios.conservative.passesGate, true);
  assert.equal(gate.scenarios.expected.passesGate, true);
});

test("P006-T03 high-use stress can fail without overturning go when base scenarios pass", () => {
  const gate = model.evaluateGate();
  assert.equal(gate.scenarios.highUseStress.passesGate, false);
  assert.equal(gate.decision, "go");
});

test("P006-T04 contribution math matches explicit cost assumptions", () => {
  const row = model.contributionMargin("conservative");
  assert.equal(row.providerCostUsd, 8);
  assert.equal(row.paymentTaxUsd, 1.2);
  assert.equal(row.hostingSupportFraudUsd, 3.5);
  assert.equal(row.refundReserveUsd, 1.2);
  assert.equal(row.totalCostUsd, 13.9);
  assert.equal(row.contributionMarginUsd, 1.1);
});

test("P006-T05 downstream parameters forbid unlimited hosting and limit evasion", () => {
  const gate = model.evaluateGate();
  assert.equal(gate.downstream.numericHostedAllowance, 40);
  assert.equal(gate.downstream.deviceLimit, 2);
  assert.equal(gate.downstream.hostedOperabilityMonths, 36);
  assert.equal(gate.downstream.requiresEncryptedTransport, true);
  assert.equal(gate.downstream.forbidsUnlimitedLifetimeHosting, true);
  assert.equal(gate.downstream.forbidsAccountLimitEvasion, true);
});

test("P006-T06 economics document records exact promise and go decision", () => {
  assert.match(doc, /Accepted: \*\*go\*\*/);
  assert.match(doc, /\*\*40\*\* included provider-backed checks/);
  assert.match(doc, /\*\*2\*\* activated devices/);
  assert.match(doc, /\*\*36 months\*\*/);
  assert.match(doc, /Forbidden promises: unlimited checks/);
  assert.match(doc, /0005a-commercial-permission-go\.md/);
});

test("P006-T07 sensitivity threshold is explicit", () => {
  assert.match(doc, /exceeds \*\*\$0\.225\*\*/);
  assert.match(doc, /Replace assumption tables within 14 days/);
});

test("P006-T08 artifacts contain no provider secrets", () => {
  const sources = [doc, fs.readFileSync(path.join(repositoryRoot, "docs", "product", "offer-economics-model.js"), "utf8")].join(
    "\n",
  );
  assert.doesNotMatch(sources, /https?:\/\/moss\.stanford\.edu\/results\/[0-9]+/i);
  assert.doesNotMatch(sources, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
  assert.doesNotMatch(sources, /sk_(?:live|test)_[A-Za-z0-9]{16,}/);
});
