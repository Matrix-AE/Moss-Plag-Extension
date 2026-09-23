"use strict";

/**
 * Central server-side product / pricing catalog.
 *
 * Plans:
 *   free_demo -> $0, 1 run, max 2 files
 *   pair      -> $15, 15 runs, max 2 files
 *   batch     -> $50, 50 runs, max 50 files
 *
 * IMPORTANT:
 * - This file is server-owned.
 * - Client-supplied prices are never trusted.
 * - Existing getApprovedOffer() behavior is preserved for
 *   backward compatibility; it returns the Pair offer.
 */

const OFFER_CATALOG_VERSION = 1;

const PLAN_IDS = Object.freeze({
  FREE_DEMO: "free_demo",
  PAIR: "pair",
  BATCH: "batch",
});

/**
 * Free demo
 *
 * This is not a paid subscription. It is a one-time,
 * device-bound trial and should continue to be enforced
 * by the existing device-trial logic.
 */
const FREE_DEMO_OFFER = Object.freeze({
  id: PLAN_IDS.FREE_DEMO,
  name: "Free demo",

  version: "free-demo-1.0.0",

  priceUsd: 0,
  currency: "USD",

  runsIncluded: 1,
  maxFilesPerRun: 2,

  deviceLimit: 1,

  hostedOperabilityMonths: 0,

  featureEntitlement:
    "one-device-demo",

  refundDaysUnused: 0,

  refundCondition:
    "not-applicable",

  paid: false,
  isTrial: true,

  description:
    "One free two-file Pair Check on this PC.",

  interpretation:
    "similarity-report-link-not-plagiarism-verdict",

  requiresEncryptedTransport: true,
  forbidsVagueFairUse: true,
  forbidsHiddenThrottle: true,
  forbidsUnlimitedLifetimeHosting: true,
  forbidsAccountEvasion: true,
});

/**
 * Pair
 *
 * Existing approved $15 offer preserved here.
 */
const PAIR_OFFER = Object.freeze({
  id: PLAN_IDS.PAIR,
  name: "Pair",

  version: "2.0.0",

  priceUsd: 15,
  currency: "USD",

  runsIncluded: 15,
  maxFilesPerRun: 2,

  deviceLimit: 2,

  hostedOperabilityMonths: 36,

  featureEntitlement:
    "non-expiring-core-features",

  majorVersionPolicy:
    "purchase-includes-current-major; next-major-may-require-paid-upgrade",

  refundDaysUnused: 14,

  refundCondition:
    "unused-hosted-runs-only",

  shutdownRemedy:
    "disable-new-hosted-checks; keep-metadata-history; documented-export-or-pivot-notice",

  interpretation:
    "similarity-report-link-not-plagiarism-verdict",

  requiresEncryptedTransport: true,
  forbidsVagueFairUse: true,
  forbidsHiddenThrottle: true,
  forbidsUnlimitedLifetimeHosting: true,
  forbidsAccountEvasion: true,

  paid: true,
  isTrial: false,

  description:
    "15 hosted runs with up to 2 files per run.",
});

/**
 * Batch
 *
 * Internal version is separate from Pair so future plan
 * changes can be tracked independently.
 */
const BATCH_OFFER = Object.freeze({
  id: PLAN_IDS.BATCH,
  name: "Batch",

  version: "batch-1.0.0",

  priceUsd: 50,
  currency: "USD",

  runsIncluded: 50,
  maxFilesPerRun: 50,

  deviceLimit: 2,

  hostedOperabilityMonths: 36,

  featureEntitlement:
    "non-expiring-core-features",

  majorVersionPolicy:
    "purchase-includes-current-major; next-major-may-require-paid-upgrade",

  refundDaysUnused: 14,

  refundCondition:
    "unused-hosted-runs-only",

  shutdownRemedy:
    "disable-new-hosted-checks; keep-metadata-history; documented-export-or-pivot-notice",

  interpretation:
    "similarity-report-link-not-plagiarism-verdict",

  requiresEncryptedTransport: true,
  forbidsVagueFairUse: true,
  forbidsHiddenThrottle: true,
  forbidsUnlimitedLifetimeHosting: true,
  forbidsAccountEvasion: true,

  paid: true,
  isTrial: false,

  description:
    "50 hosted runs with up to 50 files per run.",
});

/**
 * The complete server-side plan catalog.
 */
const PLAN_CATALOG = Object.freeze({
  [PLAN_IDS.FREE_DEMO]:
    FREE_DEMO_OFFER,

  [PLAN_IDS.PAIR]:
    PAIR_OFFER,

  [PLAN_IDS.BATCH]:
    BATCH_OFFER,
});

/**
 * Compatibility export.
 *
 * Existing code currently expects a single approved offer.
 * Until checkout / entitlement code is updated to accept a
 * plan ID, keep Pair as the default approved paid offer.
 */
const APPROVED_OFFER = PAIR_OFFER;
const OFFER_VERSION =
  APPROVED_OFFER.version;

/**
 * Cost assumptions for the Pair offer.
 *
 * These preserve the existing economics calculations.
 */
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

  hostingSupportFraudPerSaleThreeYear:
    Object.freeze({
      conservative: 3.5,
      expected: 2.0,
      worstCase: 4.0,
    }),

  refundRate: Object.freeze({
    conservative: 0.08,
    expected: 0.04,
    worstCase: 0.1,
  }),

  runsUsedOverThreeYears:
    Object.freeze({
      conservative: 15,
      expected: 8,
      worstCase: 15,
    }),
});


/**
 * Return a plan by ID.
 *
 * Returns null for an unknown plan.
 */
function getOffer(planId) {
  const key =
    String(
      planId || "",
    )
      .trim()
      .toLowerCase();

  return (
    PLAN_CATALOG[key] ||
    null
  );
}


/**
 * Return all plans as an array.
 */
function listOffers() {
  return Object.freeze(
    Object.values(
      PLAN_CATALOG,
    ),
  );
}


/**
 * Return all paid plans.
 *
 * Free demo is intentionally excluded from checkout.
 */
function listPaidOffers() {
  return Object.freeze(
    Object.values(
      PLAN_CATALOG,
    ).filter(
      (offer) =>
        offer.paid === true,
    ),
  );
}


/**
 * Existing compatibility helper.
 *
 * Existing checkout code calls this without a plan ID.
 * It continues to return Pair until checkout is updated.
 */
function getApprovedOffer() {
  return APPROVED_OFFER;
}


/**
 * Return the selected offer, or throw if a paid checkout
 * receives an unknown / non-paid plan.
 */
function getPaidOfferOrThrow(
  planId,
) {
  const offer =
    getOffer(planId);

  if (!offer) {
    throw new Error(
      "unknown-plan",
    );
  }

  if (!offer.paid) {
    throw new Error(
      "plan-not-for-checkout",
    );
  }

  return offer;
}


/**
 * Convert a plan into the parameters used by downstream
 * capability / quota / checkout / support code.
 */
function downstreamParameters(
  planId = PLAN_IDS.PAIR,
) {
  const offer =
    getOffer(planId);

  if (!offer) {
    throw new Error(
      "unknown-plan",
    );
  }

  return Object.freeze({
    planId:
      offer.id,

    planName:
      offer.name,

    offerVersion:
      offer.version,

    numericHostedAllowance:
      offer.runsIncluded,

    maxFilesPerRun:
      offer.maxFilesPerRun,

    deviceLimit:
      offer.deviceLimit,

    hostedOperabilityMonths:
      offer.hostedOperabilityMonths,

    refundDaysUnused:
      offer.refundDaysUnused,

    requiresEncryptedTransport:
      offer.requiresEncryptedTransport,

    drivesCapabilityConfig:
      true,

    drivesQuotaRules:
      true,

    drivesTerms:
      true,

    drivesCheckoutCopy:
      true,

    drivesSupport:
      true,

    drivesFinancialReserve:
      true,
  });
}


/**
 * Calculate contribution margin for a plan.
 *
 * The existing economics model is retained for Pair.
 * For Batch, this function uses the same cost assumptions
 * but scales provider cost according to its number of runs.
 */
function contributionMargin(
  scenario,
  planId = PLAN_IDS.PAIR,
) {
  const offer =
    getOffer(planId);

  if (!offer) {
    throw new Error(
      "unknown-plan",
    );
  }

  if (!offer.paid) {
    return Object.freeze({
      scenario,
      planId:
        offer.id,
      priceUsd:
        offer.priceUsd,
      runsModeled:
        0,
      providerCostUsd:
        0,
      paymentTaxUsd:
        0,
      hostingSupportFraudUsd:
        0,
      refundReserveUsd:
        0,
      totalCostUsd:
        0,
      contributionMarginUsd:
        0,
      passesGate:
        true,
    });
  }

  const runs =
    Math.min(
      offer.runsIncluded,
      COST_ASSUMPTIONS
        .runsUsedOverThreeYears[
        scenario
      ],
    );

  const provider =
    COST_ASSUMPTIONS
      .providerCostPerRun[
      scenario
    ] * runs;

  const payment =
    COST_ASSUMPTIONS
      .paymentAndTaxPerSale[
      scenario
    ];

  const ops =
    COST_ASSUMPTIONS
      .hostingSupportFraudPerSaleThreeYear[
      scenario
    ];

  const refundReserve =
    offer.priceUsd *
    COST_ASSUMPTIONS
      .refundRate[
      scenario
    ];

  const total =
    provider +
    payment +
    ops +
    refundReserve;

  const margin =
    offer.priceUsd -
    total;

  return Object.freeze({
    scenario,

    planId:
      offer.id,

    priceUsd:
      offer.priceUsd,

    runsModeled:
      runs,

    providerCostUsd:
      Number(
        provider.toFixed(
          4,
        ),
      ),

    paymentTaxUsd:
      payment,

    hostingSupportFraudUsd:
      ops,

    refundReserveUsd:
      Number(
        refundReserve.toFixed(
          4,
        ),
      ),

    totalCostUsd:
      Number(
        total.toFixed(
          4,
        ),
      ),

    contributionMarginUsd:
      Number(
        margin.toFixed(
          4,
        ),
      ),

    passesGate:
      margin > 0,
  });
}


/**
 * Existing economics helper.
 *
 * Preserves Pair as the default.
 */
function evaluateOfferEconomics(
  planId = PLAN_IDS.PAIR,
) {
  const conservative =
    contributionMargin(
      "conservative",
      planId,
    );

  const expected =
    contributionMargin(
      "expected",
      planId,
    );

  const worstCase =
    contributionMargin(
      "worstCase",
      planId,
    );

  const decision =
    conservative.passesGate &&
    expected.passesGate &&
    worstCase.passesGate
      ? "go"
      : conservative.passesGate &&
          expected.passesGate
        ? "go-with-monitoring"
        : "pivot-or-reprice";

  const offer =
    getOffer(planId);

  const fixed =
    COST_ASSUMPTIONS
      .paymentAndTaxPerSale
      .conservative +
    COST_ASSUMPTIONS
      .hostingSupportFraudPerSaleThreeYear
      .conservative +
    offer.priceUsd *
      COST_ASSUMPTIONS
        .refundRate
        .conservative;

  const maxProviderCostPerRun =
    offer.runsIncluded > 0
      ? Number(
          (
            (offer.priceUsd -
              fixed) /
            offer.runsIncluded
          ).toFixed(4),
        )
      : 0;

  return Object.freeze({
    offer,

    scenarios:
      Object.freeze({
        conservative,
        expected,
        worstCase,
      }),

    decision,

    requiresPrompt095Revalidation:
      true,

    dependsOnUnavailableBetaData:
      false,

    sensitivity:
      Object.freeze({
        maxProviderCostPerRun,
      }),

    financialReserveUsd:
      Number(
        (
          offer.priceUsd *
          COST_ASSUMPTIONS
            .refundRate
            .conservative
        ).toFixed(4),
      ),
  });
}


module.exports = {
  OFFER_CATALOG_VERSION,

  PLAN_IDS,

  PLAN_CATALOG,

  FREE_DEMO_OFFER,
  PAIR_OFFER,
  BATCH_OFFER,

  // Existing compatibility exports
  OFFER_VERSION,
  APPROVED_OFFER,
  COST_ASSUMPTIONS,

  // New catalog helpers
  getOffer,
  getApprovedOffer,
  getPaidOfferOrThrow,
  listOffers,
  listPaidOffers,

  // Economics / downstream helpers
  downstreamParameters,
  contributionMargin,
  evaluateOfferEconomics,
};