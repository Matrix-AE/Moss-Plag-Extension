"use strict";

/**
 * Secure hosted checkout for offer v2 (Prompt 080).
 * No job/upload before entitlement; allowlisted return origins; no payment secrets in logs.
 */

const crypto = require("node:crypto");
const offer = require("./customer-offer");
const terms = require("../legal/terms");
const { createEntitlementService } = require("./entitlements");

const CHECKOUT_VERSION = 1;

function createCheckoutService({
  webhookSecret,
  entitlementService = null,
  returnOrigins = [],
  now = () => Date.now(),
  checkoutBaseUrl = "https://checkout.stripe.com/c/pay/",
} = {}) {
  if (!webhookSecret) throw new Error("webhook-secret-required");
  const entitlements =
    entitlementService || createEntitlementService({ webhookSecret, now });
  const allowedOrigins = new Set(returnOrigins);
  const sessions = new Map();
  const approved = offer.getApprovedOffer();

  function createSession({ userId, returnOrigin, reviewDraftId, clientPriceUsd = null }) {
    if (!userId || !reviewDraftId) return { ok: false, error: "missing-fields" };
    if (!allowedOrigins.has(returnOrigin)) return { ok: false, error: "return-origin" };
    if (clientPriceUsd != null && clientPriceUsd !== approved.priceUsd) {
      return { ok: false, error: "client-price-rejected" };
    }

    const sessionId = `cs_${crypto.randomBytes(8).toString("hex")}`;
    const record = {
      sessionId,
      userId,
      returnOrigin,
      reviewDraftId,
      offerVersion: approved.version,
      priceUsd: approved.priceUsd,
      status: "open",
      returned: false,
      entitlementGranted: false,
      createdAt: now(),
    };
    sessions.set(sessionId, record);

    const termsDoc = terms.getTerms();
    return {
      ok: true,
      sessionId,
      checkoutUrl: `${checkoutBaseUrl}${sessionId}`,
      priceUsd: approved.priceUsd,
      offerVersion: approved.version,
      runsIncluded: approved.runsIncluded,
      maxFilesPerRun: approved.maxFilesPerRun,
      jobCreated: false,
      uploadStarted: false,
      display: Object.freeze({
        taxNote: "Applicable tax may be calculated at hosted checkout.",
        refundNote: `${approved.refundDaysUnused}-day refund if hosted runs remain unused.`,
        allowanceNote: `${approved.runsIncluded} hosted runs, max ${approved.maxFilesPerRun} files per run, ${approved.deviceLimit} devices.`,
        termsVersion: termsDoc.version,
        privacyRequired: true,
      }),
    };
  }

  function completeFromWebhook({ body, signature, timestamp }) {
    const result = entitlements.handleWebhook({ body, signature, timestamp });
    if (!result.ok) return result;

    let event;
    try {
      event = JSON.parse(body);
    } catch {
      return { ok: false, error: "bad-json" };
    }

    const session = sessions.get(event.sessionId);
    if (session) {
      session.status = "paid";
      session.entitlementGranted = true;
    }

    return {
      ok: true,
      duplicate: Boolean(result.duplicate),
      entitlementGranted: true,
      jobCreated: false,
      uploadStarted: false,
      sessionId: event.sessionId || null,
    };
  }

  function handleReturn({ sessionId, status }) {
    const session = sessions.get(sessionId);
    if (!session) return { ok: false, error: "unknown-session" };
    if (session.returned) {
      return {
        ok: true,
        alreadyReturned: true,
        reviewIntact: true,
        reviewDraftId: session.reviewDraftId,
        entitlementGranted: session.entitlementGranted,
        autoStartedJob: false,
      };
    }
    session.returned = true;
    if (status === "cancel") session.status = "canceled";
    if (status === "success" && session.entitlementGranted) session.status = "complete";
    return {
      ok: true,
      alreadyReturned: false,
      entitlementGranted: session.entitlementGranted,
      reviewIntact: true,
      reviewDraftId: session.reviewDraftId,
      autoStartedJob: false,
    };
  }

  function recordProcessorOutcome({ sessionId, outcome }) {
    const session = sessions.get(sessionId);
    if (!session) return { ok: false, error: "unknown-session" };
    if (outcome === "decline") {
      session.status = "declined";
      return { ok: true, entitlementGranted: false };
    }
    if (outcome === "delay") {
      session.status = "pending";
      return { ok: true, pending: true, entitlementGranted: session.entitlementGranted };
    }
    return { ok: false, error: "unknown-outcome" };
  }

  function assertNoJobBeforeEntitlement({ entitlementActive }) {
    if (!entitlementActive) return { ok: false, error: "entitlement-required" };
    return { ok: true };
  }

  function startFirstJobAfterPurchase({
    userId,
    entitlementActive,
    reviewDraftId,
    explicitConfirm,
  }) {
    if (!entitlementActive) return { ok: false, error: "entitlement-required" };
    if (!explicitConfirm) return { ok: false, error: "explicit-confirm-required" };
    if (!reviewDraftId) return { ok: false, error: "missing-draft" };
    const ent = entitlements.getEntitlement(userId);
    if (ent.status !== "active" || ent.remaining < 1) {
      return { ok: false, error: "not-entitled" };
    }
    return {
      ok: true,
      jobCreated: true,
      uploadStarted: true,
      reviewDraftId,
      remaining: ent.remaining,
    };
  }

  function redactedLogSample(input) {
    return Object.freeze({
      sessionId: input.sessionId || null,
      event: "checkout",
      // intentionally omit checkoutSecret, card fields, payment details
    });
  }

  return {
    version: CHECKOUT_VERSION,
    createSession,
    completeFromWebhook,
    handleReturn,
    recordProcessorOutcome,
    assertNoJobBeforeEntitlement,
    startFirstJobAfterPurchase,
    redactedLogSample,
  };
}

module.exports = {
  CHECKOUT_VERSION,
  createCheckoutService,
};
