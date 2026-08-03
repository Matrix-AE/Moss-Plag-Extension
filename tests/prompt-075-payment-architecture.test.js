"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const payment = require(path.join(root, "apps/api/commerce/payment-architecture"));
const adr = fs.readFileSync(path.join(root, "docs/adr/0075-payment-merchant-architecture.md"), "utf8");

test("P075-T01 selects hosted merchant with minimized PCI and no extension SDK", () => {
  const decision = payment.getPaymentArchitecture();
  assert.equal(decision.provider, "stripe-checkout");
  assert.equal(decision.merchantOfRecord, "stripe");
  assert.equal(decision.checkoutMode, "hosted");
  assert.equal(decision.pciScope, "saq-a-minimized");
  assert.equal(decision.extensionContainsPaymentSdk, false);
  assert.equal(decision.offerVersion, "2.0.0");
  assert.equal(decision.priceUsd, 15);
});

test("P075-T02 ADR records alternatives cost data flow failures compliance sandbox exit", () => {
  assert.match(adr, /ADR-0075|0075-payment-merchant/);
  assert.match(adr, /Stripe/i);
  assert.match(adr, /Paddle/i);
  assert.match(adr, /LemonSqueezy|Lemon Squeezy/i);
  assert.match(adr, /exit strategy/i);
  assert.match(adr, /sandbox/i);
  assert.match(adr, /webhook/i);
  assert.match(adr, /VAT|sales tax/i);
  assert.match(adr, /compliance owner/i);
  assert.match(adr, /PCI/i);
});

test("P075-T03 compares regions currencies tax fees fraud refunds privacy", () => {
  const cmp = payment.compareMerchants();
  assert.ok(cmp.candidates.length >= 3);
  for (const c of cmp.candidates) {
    assert.ok(c.regions);
    assert.ok(c.currencies);
    assert.ok("taxHandling" in c);
    assert.ok("feeModel" in c);
    assert.ok("fraudTools" in c);
    assert.ok("refunds" in c);
    assert.ok("privacyPosture" in c);
    assert.ok("webhooks" in c);
    assert.ok("migrationExit" in c);
  }
  assert.equal(cmp.selected, "stripe-checkout");
});

test("P075-T04 approvals and sandbox event checklist", () => {
  const unsigned = payment.recordApprovals({
    legalPrivacy: false,
    finance: true,
    security: true,
    engineering: true,
  });
  assert.equal(unsigned.ok, false);

  const signed = payment.recordApprovals({
    legalPrivacy: true,
    finance: true,
    security: true,
    engineering: true,
  });
  assert.equal(signed.ok, true);

  const sandbox = payment.sandboxEventChecklist();
  assert.ok(sandbox.events.includes("checkout.session.completed"));
  assert.ok(sandbox.events.includes("charge.refunded"));
  assert.ok(sandbox.events.includes("charge.dispute.created"));
  assert.ok(sandbox.apis.includes("checkout.sessions.create"));
});

test("P075-T05 module export and primary-source verification note", () => {
  const decision = payment.getPaymentArchitecture();
  assert.equal(decision.verifyRulesFromPrimarySources, true);
  assert.ok(decision.dataFlow.extensionToHostedCheckout);
  assert.ok(decision.failures.includes("webhook-delay"));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./commerce/payment-architecture"], "./commerce/payment-architecture.js");
});
