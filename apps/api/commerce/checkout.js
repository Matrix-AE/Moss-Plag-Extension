"use strict";

/**
 * Hosted checkout service.
 *
 * Server-owned plan selection:
 *   pair  -> $15 / 15 runs / 2 files
 *   batch -> $50 / 50 runs / 50 files
 *
 * The client sends only planId.
 * The server resolves the actual price/limits from customer-offer.js.
 *
 * IMPORTANT:
 * This module is still the checkout scaffold used by the current project.
 * A successful checkout/payment is only considered complete after the
 * entitlement webhook is accepted by the entitlement service.
 */

const crypto = require("node:crypto");

const offer = require("./customer-offer");
const terms = require("../legal/terms");
const {
  createEntitlementService,
} = require("./entitlements");

const CHECKOUT_VERSION = 2;

const PAID_PLAN_IDS = new Set([
  "pair",
  "batch",
]);

function normalizePlanId(value) {
  const id = String(value || "")
    .trim()
    .toLowerCase();

  if (PAID_PLAN_IDS.has(id)) {
    return id;
  }

  return "";
}

function createCheckoutService({
  webhookSecret,
  entitlementService = null,
  returnOrigins = [],
  now = () => Date.now(),
  checkoutBaseUrl =
    "https://checkout.stripe.com/c/pay/",
} = {}) {
  if (!webhookSecret) {
    throw new Error(
      "webhook-secret-required",
    );
  }

  const entitlements =
    entitlementService ||
    createEntitlementService({
      webhookSecret,
      now,
    });

  const allowedOrigins =
    new Set(
      Array.isArray(returnOrigins)
        ? returnOrigins
        : [],
    );

  const sessions =
    new Map();

  function createSession({
    userId,
    planId,
    returnOrigin,
    reviewDraftId,
  }) {
    if (!userId) {
      return {
        ok: false,
        error: "missing-user",
        status: 400,
      };
    }

    if (!reviewDraftId) {
      return {
        ok: false,
        error: "missing-fields",
        status: 400,
      };
    }

    if (!returnOrigin) {
      return {
        ok: false,
        error: "return-origin-required",
        status: 400,
      };
    }

    if (
      allowedOrigins.size > 0 &&
      !allowedOrigins.has(returnOrigin)
    ) {
      return {
        ok: false,
        error: "return-origin",
        status: 400,
      };
    }

    const normalizedPlan =
      normalizePlanId(planId);

    if (!normalizedPlan) {
      return {
        ok: false,
        error: "unknown-plan",
        status: 400,
      };
    }

    const selectedOffer =
      offer.getPaidOfferOrThrow(
        normalizedPlan,
      );

    const sessionId =
      `cs_${crypto.randomBytes(12).toString("hex")}`;

    const record = {
      sessionId,

      userId,

      planId:
        selectedOffer.id,

      returnOrigin,

      reviewDraftId,

      offerVersion:
        selectedOffer.version,

      priceUsd:
        selectedOffer.priceUsd,

      currency:
        selectedOffer.currency,

      runsIncluded:
        selectedOffer.runsIncluded,

      maxFilesPerRun:
        selectedOffer.maxFilesPerRun,

      deviceLimit:
        selectedOffer.deviceLimit,

      status: "open",

      returned: false,

      entitlementGranted: false,

      createdAt: now(),

      paidAt: null,

      webhookEventId: null,
    };

    sessions.set(
      sessionId,
      record,
    );

    const termsDoc =
      terms.getTerms();

    return {
      ok: true,

      sessionId,

      /*
       * This is the project's current hosted-checkout scaffold.
       * The real payment-provider integration can replace this URL
       * later without changing the plan validation here.
       */
      checkoutUrl:
        `${checkoutBaseUrl}${sessionId}`,

      planId:
        selectedOffer.id,

      planName:
        selectedOffer.name,

      priceUsd:
        selectedOffer.priceUsd,

      currency:
        selectedOffer.currency,

      offerVersion:
        selectedOffer.version,

      runsIncluded:
        selectedOffer.runsIncluded,

      maxFilesPerRun:
        selectedOffer.maxFilesPerRun,

      deviceLimit:
        selectedOffer.deviceLimit,

      jobCreated: false,

      uploadStarted: false,

      entitlementGranted:
        false,

      display: Object.freeze({
        taxNote:
          "Applicable tax may be calculated at hosted checkout.",

        refundNote:
          `${selectedOffer.refundDaysUnused}-day refund if hosted runs remain unused.`,

        allowanceNote:
          `${selectedOffer.runsIncluded} hosted runs, max ${selectedOffer.maxFilesPerRun} files per run, ${selectedOffer.deviceLimit} devices.`,

        termsVersion:
          termsDoc.version,

        privacyRequired:
          true,
      }),
    };
  }

  /**
   * Complete a purchase from the verified entitlement webhook.
   *
   * The entitlement service is the authoritative payment/entitlement
   * processor. This function only reconciles the checkout session with
   * the resulting webhook event.
   */
  async function completeFromWebhook({
    body,
    signature,
    timestamp,
  }) {
    const result =
      await entitlements.handleWebhook({
        body,
        signature,
        timestamp,
      });

    if (!result.ok) {
      return result;
    }

    let event;

    try {
      event =
        JSON.parse(body);
    } catch {
      return {
        ok: false,
        error: "bad-json",
        status: 400,
      };
    }

    const sessionId =
      String(
        event.sessionId || "",
      ).trim();

    const session =
      sessionId
        ? sessions.get(sessionId)
        : null;

    /*
     * Duplicate webhook:
     * the entitlement service has already accepted it, so we can
     * safely return the current session state.
     */
    if (result.duplicate) {
      return {
        ok: true,
        duplicate: true,

        entitlementGranted:
          Boolean(
            session?.entitlementGranted,
          ),

        jobCreated: false,

        uploadStarted: false,

        sessionId:
          sessionId || null,

        planId:
          session?.planId || null,
      };
    }

    if (session) {
      /*
       * Protect the session against an event claiming a different plan.
       * The webhook handler remains responsible for validating the
       * authoritative entitlement event itself.
       */
      if (
        event.planId &&
        normalizePlanId(
          event.planId,
        ) !== session.planId
      ) {
        return {
          ok: false,
          error:
            "plan-mismatch",
          status: 400,
        };
      }

      session.status =
        "paid";

      session.entitlementGranted =
        true;

      session.paidAt =
        now();

      session.webhookEventId =
        event.eventId ||
        event.id ||
        null;
    }

    return {
      ok: true,

      duplicate:
        Boolean(result.duplicate),

      entitlementGranted:
        true,

      jobCreated:
        false,

      uploadStarted:
        false,

      sessionId:
        sessionId || null,

      planId:
        session?.planId ||
        normalizePlanId(
          event.planId,
        ) ||
        null,
    };
  }

  function handleReturn({
    sessionId,
    status,
  }) {
    const session =
      sessions.get(sessionId);

    if (!session) {
      return {
        ok: false,
        error: "unknown-session",
        status: 404,
      };
    }

    if (session.returned) {
      return {
        ok: true,

        alreadyReturned:
          true,

        reviewIntact:
          true,

        reviewDraftId:
          session.reviewDraftId,

        entitlementGranted:
          session.entitlementGranted,

        planId:
          session.planId,

        autoStartedJob:
          false,
      };
    }

    session.returned =
      true;

    if (
      status === "cancel"
    ) {
      session.status =
        "canceled";
    }

    if (
      status === "success" &&
      session.entitlementGranted
    ) {
      session.status =
        "complete";
    }

    return {
      ok: true,

      alreadyReturned:
        false,

      entitlementGranted:
        session.entitlementGranted,

      planId:
        session.planId,

      reviewIntact:
        true,

      reviewDraftId:
        session.reviewDraftId,

      autoStartedJob:
        false,
    };
  }

  function recordProcessorOutcome({
    sessionId,
    outcome,
  }) {
    const session =
      sessions.get(sessionId);

    if (!session) {
      return {
        ok: false,
        error: "unknown-session",
        status: 404,
      };
    }

    if (
      outcome ===
      "decline"
    ) {
      session.status =
        "declined";

      return {
        ok: true,
        entitlementGranted:
          false,
      };
    }

    if (
      outcome ===
      "delay"
    ) {
      session.status =
        "pending";

      return {
        ok: true,
        pending: true,
        entitlementGranted:
          session.entitlementGranted,
      };
    }

    return {
      ok: false,
      error: "unknown-outcome",
      status: 400,
    };
  }

  function assertNoJobBeforeEntitlement({
    entitlementActive,
  }) {
    if (!entitlementActive) {
      return {
        ok: false,
        error:
          "entitlement-required",
        status: 403,
      };
    }

    return {
      ok: true,
    };
  }

  function startFirstJobAfterPurchase({
    userId,
    entitlementActive,
    reviewDraftId,
    explicitConfirm,
  }) {
    if (!entitlementActive) {
      return {
        ok: false,
        error:
          "entitlement-required",
        status: 403,
      };
    }

    if (!explicitConfirm) {
      return {
        ok: false,
        error:
          "explicit-confirm-required",
        status: 400,
      };
    }

    if (!reviewDraftId) {
      return {
        ok: false,
        error: "missing-draft",
        status: 400,
      };
    }

    const ent =
      entitlements.getEntitlement(
        userId,
      );

    if (!ent) {
      return {
        ok: false,
        error:
          "not-entitled",
        status: 403,
      };
    }

    if (
      ent.status !==
        "active" ||
      ent.remaining < 1
    ) {
      return {
        ok: false,
        error:
          "not-entitled",
        status: 403,
      };
    }

    return {
      ok: true,

      jobCreated:
        true,

      uploadStarted:
        true,

      reviewDraftId,

      remaining:
        ent.remaining,

      planId:
        ent.planId ||
        null,
    };
  }

  function getSession({
    sessionId,
  }) {
    const session =
      sessions.get(sessionId);

    if (!session) {
      return {
        ok: false,
        error:
          "unknown-session",
        status: 404,
      };
    }

    return {
      ok: true,
      session: {
        ...session,
      },
    };
  }

  function redactedLogSample(
    input = {},
  ) {
    return Object.freeze({
      sessionId:
        input.sessionId ||
        null,

      planId:
        input.planId ||
        null,

      event:
        "checkout",

      /*
       * Intentionally omit:
       * - checkout secrets
       * - card information
       * - payment credentials
       * - raw webhook payloads
       */
    });
  }

  return {
    version:
      CHECKOUT_VERSION,

    createSession,

    completeFromWebhook,

    handleReturn,

    recordProcessorOutcome,

    assertNoJobBeforeEntitlement,

    startFirstJobAfterPurchase,

    getSession,

    redactedLogSample,

    /*
     * Useful for local tests.
     * Not used by the production API directly.
     */
    _sessions:
      sessions,
  };
}

module.exports = {
  CHECKOUT_VERSION,
  PAID_PLAN_IDS,
  createCheckoutService,
};