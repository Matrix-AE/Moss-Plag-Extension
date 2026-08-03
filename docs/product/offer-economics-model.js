/**
 * Prompt 006 unit-economics model for the $15 one-time offer.
 * Pure functions only — no network, secrets, or provider calls.
 */
"use strict";

const OFFER = Object.freeze({
  priceUsd: 15,
  currency: "USD",
  devices: 2,
  hostedChecksIncluded: 40,
  hostedOperabilityMonths: 36,
  featureEntitlement: "non-expiring-core-features",
  majorVersionPolicy: "purchase-includes-current-major; next-major-may-require-paid-upgrade",
  refundDaysUnused: 14,
  refundCondition: "unused-hosted-checks-only",
  hostedEolRemedy: "disable-new-hosted-checks; keep-local-history-metadata; offer-documented-export-or-pivot-notice",
});

const COST_ASSUMPTIONS = Object.freeze({
  // Labeled planning assumptions until finance replaces them with executed quotes.
  providerCostPerCheck: Object.freeze({
    conservative: 0.2,
    expected: 0.08,
    highUseStress: 0.2,
  }),
  paymentAndTaxPerSale: Object.freeze({
    conservative: 1.2,
    expected: 0.9,
    highUseStress: 1.2,
  }),
  hostingSupportFraudPerSaleThreeYear: Object.freeze({
    conservative: 3.5,
    expected: 2.0,
    highUseStress: 4.5,
  }),
  refundRate: Object.freeze({
    conservative: 0.08,
    expected: 0.04,
    highUseStress: 0.1,
  }),
  checksUsedOverThreeYears: Object.freeze({
    conservative: 40,
    expected: 18,
    highUseStress: 40,
  }),
});

function contributionMargin(scenario) {
  const checks = COST_ASSUMPTIONS.checksUsedOverThreeYears[scenario];
  const provider = COST_ASSUMPTIONS.providerCostPerCheck[scenario] * checks;
  const payment = COST_ASSUMPTIONS.paymentAndTaxPerSale[scenario];
  const ops = COST_ASSUMPTIONS.hostingSupportFraudPerSaleThreeYear[scenario];
  const refundReserve = OFFER.priceUsd * COST_ASSUMPTIONS.refundRate[scenario];
  const variable = provider + payment + ops + refundReserve;
  const margin = OFFER.priceUsd - variable;
  return Object.freeze({
    scenario,
    priceUsd: OFFER.priceUsd,
    checksModeled: checks,
    providerCostUsd: Number(provider.toFixed(4)),
    paymentTaxUsd: payment,
    hostingSupportFraudUsd: ops,
    refundReserveUsd: Number(refundReserve.toFixed(4)),
    totalCostUsd: Number(variable.toFixed(4)),
    contributionMarginUsd: Number(margin.toFixed(4)),
    passesGate: margin > 0,
  });
}

function evaluateGate() {
  const conservative = contributionMargin("conservative");
  const expected = contributionMargin("expected");
  const highUseStress = contributionMargin("highUseStress");
  const decision =
    conservative.passesGate && expected.passesGate
      ? "go"
      : conservative.passesGate
        ? "go-with-monitoring"
        : "pivot-or-reprice";
  return Object.freeze({
    offer: OFFER,
    scenarios: Object.freeze({ conservative, expected, highUseStress }),
    decision,
    downstream: Object.freeze({
      numericHostedAllowance: OFFER.hostedChecksIncluded,
      deviceLimit: OFFER.devices,
      hostedOperabilityMonths: OFFER.hostedOperabilityMonths,
      requiresEncryptedTransport: true,
      forbidsUnlimitedLifetimeHosting: true,
      forbidsAccountLimitEvasion: true,
    }),
  });
}

module.exports = {
  COST_ASSUMPTIONS,
  OFFER,
  contributionMargin,
  evaluateGate,
};
