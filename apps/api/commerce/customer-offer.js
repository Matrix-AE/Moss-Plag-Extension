"use strict";

/**
 * Revalidated $15 customer promise (Prompt 073).
 * One approved versioned offer drives capability config, quotas, terms, checkout, support, reserve.
 * Prompt 006 modeled 40 checks; product UX and this offer lock 15 runs / max 2 files.
 */

const OFFER_VERSION = "2.0.0";

const APPROVED_OFFER = Object.freeze({
  version: OFFER_VERSION,
  priceUsd: 15,
  currency: "USD",
  runsIncluded: 15,
  maxFilesPerRun: 2,
  deviceLimit: 2,
  hostedOperabilityMonths: 36,
  featureEntitlement: "non-expiring-core-features",
  majorVersionPolicy: "purchase-includes-current-major; next-major-may-require-paid-upgrade",
  refundDaysUnused: 14,
  refundCondition: "unused-hosted-runs-only",
  shutdownRemedy:
    "disable-new-hosted-checks; keep-metadata-history; documented-export-or-pivot-notice",
  interpretation: "similarity-report-link-not-plagiarism-verdict",
  requiresEncryptedTransport: true,
  forbidsVagueFairUse: true,
  forbidsHiddenThrottle: true,
  forbidsUnlimitedLifetimeHosting: true,
  forbidsAccountEvasion: true,
  historicalNote:
    "Prompt 006 modeled 40 checks; Prompt 073 revalidates to 15 runs / max 2 files per run.",
});

const COST_ASSUMPTIONS = Object.freeze({
  providerCostPerRun: Object.freeze({
    conservative: 0.2,
    expected: 0.08,
    worstCase: 0.25,
  }),
  paymentAndTaxPerSale: Object.freeze({
    conservative: 1.2,
    expected: 0.9,
    worstCase: 1.35,
  }),
  hostingSupportFraudPerSaleThreeYear: Object.freeze({
    conservative: 3.5,
    expected: 2.0,
    worstCase: 4.0,
  }),
  refundRate: Object.freeze({
    conservative: 0.08,
    expected: 0.04,
    worstCase: 0.1,
  }),
  runsUsedOverThreeYears: Object.freeze({
    conservative: 15,
    expected: 8,
    worstCase: 15,
  }),
});

function contributionMargin(scenario) {
  const runs = COST_ASSUMPTIONS.runsUsedOverThreeYears[scenario];
  const provider = COST_ASSUMPTIONS.providerCostPerRun[scenario] * runs;
  const payment = COST_ASSUMPTIONS.paymentAndTaxPerSale[scenario];
  const ops = COST_ASSUMPTIONS.hostingSupportFraudPerSaleThreeYear[scenario];
  const refundReserve = APPROVED_OFFER.priceUsd * COST_ASSUMPTIONS.refundRate[scenario];
  const total = provider + payment + ops + refundReserve;
  const margin = APPROVED_OFFER.priceUsd - total;
  return Object.freeze({
    scenario,
    priceUsd: APPROVED_OFFER.priceUsd,
    runsModeled: runs,
    providerCostUsd: Number(provider.toFixed(4)),
    paymentTaxUsd: payment,
    hostingSupportFraudUsd: ops,
    refundReserveUsd: Number(refundReserve.toFixed(4)),
    totalCostUsd: Number(total.toFixed(4)),
    contributionMarginUsd: Number(margin.toFixed(4)),
    passesGate: margin > 0,
  });
}

function evaluateOfferEconomics() {
  const conservative = contributionMargin("conservative");
  const expected = contributionMargin("expected");
  const worstCase = contributionMargin("worstCase");
  const decision =
    conservative.passesGate && expected.passesGate && worstCase.passesGate
      ? "go"
      : conservative.passesGate && expected.passesGate
        ? "go-with-monitoring"
        : "pivot-or-reprice";
  // Max provider $/run before conservative margin hits 0 with other conservative costs fixed.
  const fixed =
    COST_ASSUMPTIONS.paymentAndTaxPerSale.conservative +
    COST_ASSUMPTIONS.hostingSupportFraudPerSaleThreeYear.conservative +
    APPROVED_OFFER.priceUsd * COST_ASSUMPTIONS.refundRate.conservative;
  const maxProviderCostPerRun = Number(
    ((APPROVED_OFFER.priceUsd - fixed) / APPROVED_OFFER.runsIncluded).toFixed(4),
  );
  return Object.freeze({
    offer: APPROVED_OFFER,
    scenarios: Object.freeze({ conservative, expected, worstCase }),
    decision,
    requiresPrompt095Revalidation: true,
    dependsOnUnavailableBetaData: false,
    sensitivity: Object.freeze({ maxProviderCostPerRun }),
    financialReserveUsd: Number(
      (APPROVED_OFFER.priceUsd * COST_ASSUMPTIONS.refundRate.conservative).toFixed(4),
    ),
  });
}

function getApprovedOffer() {
  return APPROVED_OFFER;
}

function downstreamParameters() {
  return Object.freeze({
    offerVersion: OFFER_VERSION,
    numericHostedAllowance: APPROVED_OFFER.runsIncluded,
    maxFilesPerRun: APPROVED_OFFER.maxFilesPerRun,
    deviceLimit: APPROVED_OFFER.deviceLimit,
    hostedOperabilityMonths: APPROVED_OFFER.hostedOperabilityMonths,
    refundDaysUnused: APPROVED_OFFER.refundDaysUnused,
    requiresEncryptedTransport: true,
    drivesCapabilityConfig: true,
    drivesQuotaRules: true,
    drivesTerms: true,
    drivesCheckoutCopy: true,
    drivesSupport: true,
    drivesFinancialReserve: true,
  });
}

module.exports = {
  OFFER_VERSION,
  APPROVED_OFFER,
  COST_ASSUMPTIONS,
  getApprovedOffer,
  contributionMargin,
  evaluateOfferEconomics,
  downstreamParameters,
};
