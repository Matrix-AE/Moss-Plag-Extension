"use strict";

/**
 * Payment and merchant architecture selection (Prompt 075).
 * Hosted checkout for offer v2; payment SDKs stay out of the extension.
 */

const PAYMENT_ARCH_VERSION = 1;

const SELECTED = Object.freeze({
  version: PAYMENT_ARCH_VERSION,
  provider: "stripe-checkout",
  merchantOfRecord: "stripe",
  checkoutMode: "hosted",
  pciScope: "saq-a-minimized",
  extensionContainsPaymentSdk: false,
  offerVersion: "2.0.0",
  priceUsd: 15,
  currency: "USD",
  verifyRulesFromPrimarySources: true,
  complianceOwner: "legal-privacy-reviewer",
  dataFlow: Object.freeze({
    extensionToHostedCheckout: true,
    webhookToEntitlementService: true,
    noCardDataInExtensionOrApiLogs: true,
  }),
  failures: Object.freeze([
    "checkout-abandon",
    "payment-decline",
    "webhook-delay",
    "duplicate-event",
    "refund-after-consumption",
  ]),
  exitStrategy: "export-customer-entitlement-ledger; migrate MoR via new checkout SKU; revoke Stripe webhook secret",
});

function getPaymentArchitecture() {
  return SELECTED;
}

function compareMerchants() {
  const candidates = Object.freeze([
    Object.freeze({
      id: "stripe-checkout",
      regions: "global-with-country-availability",
      currencies: "USD-primary; multi-currency presentment",
      taxHandling: "Stripe Tax optional; configure for VAT/sales tax",
      feeModel: "percentage-plus-fixed per successful charge",
      fraudTools: "Radar + 3DS where required",
      payouts: "standard-stripe-payout-schedule",
      refunds: "full-partial via Dashboard/API within offer window",
      privacyPosture: "processor DPA; minimize personal data in metadata",
      apis: "Checkout Sessions + Webhooks",
      webhooks: "signed; replay-protected",
      support: "Stripe support + product support runbook",
      migrationExit: "SKU remap + entitlement ledger export",
    }),
    Object.freeze({
      id: "paddle",
      regions: "global-mor",
      currencies: "multi",
      taxHandling: "MoR handles VAT/sales tax",
      feeModel: "higher-all-in MoR fee",
      fraudTools: "built-in",
      payouts: "paddle-schedule",
      refunds: "MoR policy + API",
      privacyPosture: "MoR subprocessors",
      apis: "Paddle Billing",
      webhooks: "signed",
      support: "Paddle merchant support",
      migrationExit: "re-onboard catalog; remap entitlements",
    }),
    Object.freeze({
      id: "lemon-squeezy",
      regions: "global-mor",
      currencies: "multi",
      taxHandling: "MoR tax",
      feeModel: "MoR fee schedule",
      fraudTools: "platform defaults",
      payouts: "platform-schedule",
      refunds: "platform refunds",
      privacyPosture: "MoR DPA",
      apis: "REST + webhooks",
      webhooks: "signed",
      support: "platform support",
      migrationExit: "catalog export; entitlement remap",
    }),
  ]);
  return Object.freeze({
    selected: "stripe-checkout",
    rationale:
      "Hosted Checkout minimizes PCI (SAQ-A), keeps SDKs out of MV3, strong webhook/API surface for one-time $15 offer, clear sandbox plan.",
    candidates,
  });
}

function recordApprovals({
  legalPrivacy = false,
  finance = false,
  security = false,
  engineering = false,
  now = () => new Date().toISOString(),
} = {}) {
  const roles = { legalPrivacy, finance, security, engineering };
  const missing = Object.entries(roles).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) return { ok: false, missing };
  return {
    ok: true,
    missing: [],
    signedAt: now(),
    roles: Object.keys(roles),
  };
}

function sandboxEventChecklist() {
  return Object.freeze({
    events: Object.freeze([
      "checkout.session.completed",
      "checkout.session.expired",
      "charge.refunded",
      "charge.dispute.created",
      "payment_intent.payment_failed",
    ]),
    apis: Object.freeze([
      "checkout.sessions.create",
      "checkout.sessions.retrieve",
      "refunds.create",
    ]),
  });
}

module.exports = {
  PAYMENT_ARCH_VERSION,
  getPaymentArchitecture,
  compareMerchants,
  recordApprovals,
  sandboxEventChecklist,
};
