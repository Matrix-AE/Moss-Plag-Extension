"use strict";

/**
 * Webhooks, entitlements, license tokens, and commercial state.
 *
 * Server-owned commercial state; secrets never ship in extension code.
 *
 * Paid plans:
 *   pair  -> $15 / 15 runs / max 2 files
 *   batch -> $50 / 50 runs / max 50 files
 *
 * Payment-provider integration can be swapped in later.
 * For now, successful purchase events can come from the existing
 * signed webhook flow or the development-only mock completion flow.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const offer = require("./customer-offer");

const {
  createSubscription,
  getUserSubscriptions,
} = require("../db/subscriptions");

const {
  getEntitlement:
    getSupabaseEntitlement,
  upsertEntitlement,
} = require("../db/entitlements");

const ENTITLEMENTS_VERSION = 3;

const DEFAULT_TOKEN_TTL_MS =
  15 * 60 * 1000;

const MAX_SKEW_SEC = 300;

function normalizePlanId(value) {
  const id = String(value || "")
    .trim()
    .toLowerCase();

  if (id === "batch") {
    return "batch";
  }

  if (id === "pair") {
    return "pair";
  }

  return "";
}

function getPaidOffer(planId) {
  const normalized =
    normalizePlanId(planId);

  if (!normalized) {
    return null;
  }

  try {
    return offer.getPaidOfferOrThrow(
      normalized,
    );
  } catch {
    return null;
  }
}

function createEntitlementService({
  webhookSecret,
  now = () => Date.now(),
  tokenTtlMs =
    DEFAULT_TOKEN_TTL_MS,
  offlineGraceMs = 0,
  storePath = null,
  onPurchase = null,
} = {}) {
  if (
    !webhookSecret ||
    String(webhookSecret).length < 16
  ) {
    throw new Error(
      "webhook-secret-required",
    );
  }

  const entitlements =
    new Map();

  const processedEvents =
    new Map();

  const sessionsPurchased =
    new Map();

  const tokens =
    new Map();

  const audits = [];

  loadPersistedState();

  function persistState() {
    if (!storePath) {
      return;
    }

    const directory =
      path.dirname(storePath);

    fs.mkdirSync(
      directory,
      {
        recursive: true,
      },
    );

    const payload = {
      version:
        ENTITLEMENTS_VERSION,

      entitlements: [
        ...entitlements.values(),
      ],

      processedEvents: [
        ...processedEvents.keys(),
      ],

      sessionsPurchased: [
        ...sessionsPurchased.entries(),
      ],

      audits,
    };

    const tempPath =
      `${storePath}.${process.pid}.tmp`;

    fs.writeFileSync(
      tempPath,
      JSON.stringify(
        payload,
        null,
        2,
      ),
      "utf8",
    );

    fs.renameSync(
      tempPath,
      storePath,
    );
  }

  function loadPersistedState() {
    if (
      !storePath ||
      !fs.existsSync(storePath)
    ) {
      return;
    }

    try {
      const raw =
        JSON.parse(
          fs.readFileSync(
            storePath,
            "utf8",
          ),
        );

      for (
        const record of
          Array.isArray(
            raw.entitlements,
          )
            ? raw.entitlements
            : []
      ) {
        if (
          record &&
          record.userId
        ) {
          entitlements.set(
            record.userId,
            record,
          );
        }
      }

      for (
        const eventId of
          Array.isArray(
            raw.processedEvents,
          )
            ? raw.processedEvents
            : []
      ) {
        processedEvents.set(
          eventId,
          true,
        );
      }

      for (
        const pair of
          Array.isArray(
            raw.sessionsPurchased,
          )
            ? raw.sessionsPurchased
            : []
      ) {
        if (
          Array.isArray(pair) &&
          pair.length === 2
        ) {
          sessionsPurchased.set(
            pair[0],
            pair[1],
          );
        }
      }

      if (
        Array.isArray(
          raw.audits,
        )
      ) {
        audits.push(
          ...raw.audits,
        );
      }
    } catch {
      // Keep the API bootable if the local ledger is bad.
    }
  }

  function audit(entry) {
    audits.push({
      ...entry,
      at: now(),
    });
  }

  function verifySignature({
    body,
    signature,
    timestamp,
  }) {
    const ts =
      Number(timestamp);

    if (!Number.isFinite(ts)) {
      return {
        ok: false,
        error:
          "bad-timestamp",
      };
    }

    const skew =
      Math.abs(
        Math.floor(
          now() / 1000,
        ) - ts,
      );

    if (
      skew > MAX_SKEW_SEC
    ) {
      return {
        ok: false,
        error:
          "timestamp-skew",
      };
    }

    const expected =
      crypto
        .createHmac(
          "sha256",
          webhookSecret,
        )
        .update(
          `${ts}.${body}`,
        )
        .digest("hex");

    const a =
      Buffer.from(expected);

    const b =
      Buffer.from(
        String(signature || ""),
      );

    if (
      a.length !== b.length ||
      !crypto.timingSafeEqual(
        a,
        b,
      )
    ) {
      return {
        ok: false,
        error:
          "bad-signature",
      };
    }

    return {
      ok: true,
    };
  }

  /**
   * Persist the purchase to Supabase.
   *
   * We use paymentReference as our idempotency key.
   * If the subscription already exists, it is not inserted again.
   */
  async function syncPurchaseToSupabase({
    userId,
    planId,
    status,
    priceUsd,
    purchasedAt,
    offerVersion,
    paymentProvider,
    paymentReference,
    totalRuns,
    remainingRuns,
    maxFilesPerRun,
  }) {
    const subscriptions =
      await getUserSubscriptions(
        userId,
      );

    const alreadyRecorded =
      subscriptions.some(
        (subscription) =>
          paymentReference &&
          subscription.payment_reference ===
            paymentReference,
      );

    let subscription =
      alreadyRecorded
        ? subscriptions.find(
            (item) =>
              paymentReference &&
              item.payment_reference ===
                paymentReference,
          )
        : null;

    if (!alreadyRecorded) {
      subscription =
        await createSubscription({
          userId,

          plan: planId,

          status,

          priceUsd,

          purchasedAt:

            purchasedAt ||
            new Date().toISOString(),

          offerVersion,

          paymentProvider,

          paymentReference,
        });
    }

    const entitlement =
      await upsertEntitlement({
        userId,

        status,

        totalRuns,

        remainingRuns,

        maxFilesPerRun,

        offerVersion,

        purchasedAt:
          purchasedAt ||
          new Date().toISOString(),
      });

    return {
      subscription,
      entitlement,
    };
  }

  /**
   * Apply a successful paid purchase.
   *
   * This is async because the confirmed purchase is now also persisted
   * to Supabase.
   */
  async function applyPurchase(
    event,
  ) {
    const planId =
      normalizePlanId(
        event.planId,
      );

    /*
     * Backward compatibility:
     * older checkout events without planId are treated as Pair.
     */
    const effectivePlanId =
      planId || "pair";

    const selectedOffer =
      getPaidOffer(
        effectivePlanId,
      );

    if (!selectedOffer) {
      return {
        ok: false,
        error:
          "unknown-plan",
      };
    }

    /*
     * Never trust client pricing.
     * The amount/version must match our server catalog.
     */
    if (
      event.amountUsd !==
        selectedOffer.priceUsd ||
      event.offerVersion !==
        selectedOffer.version
    ) {
      return {
        ok: false,
        error:
          "offer-mismatch",
      };
    }

    if (!event.userId) {
      return {
        ok: false,
        error:
          "missing-user",
      };
    }

    if (
      event.sessionId &&
      sessionsPurchased.has(
        event.sessionId,
      )
    ) {
      audit({
        action:
          "purchase-duplicate",
        eventId:
          event.id,
        sessionId:
          event.sessionId,
      });

      return {
        ok: true,
        duplicate: true,
        entitlement:
          getEntitlement(
            event.userId,
          ),
      };
    }

    const purchasedAt =
      event.purchasedAt ||
      new Date(
        now(),
      ).toISOString();

    const paymentReference =
      String(
        event.paymentReference ||
          event.paymentIntentId ||
          event.id ||
          event.sessionId ||
          "",
      ).trim();

    if (!paymentReference) {
      return {
        ok: false,
        error:
          "payment-reference-required",
      };
    }

    /*
     * Supabase is written before the event is marked processed.
     * If the DB write fails, the event remains retryable.
     */
    let supabaseResult;

    try {
      supabaseResult =
        await syncPurchaseToSupabase({
          userId:
            event.userId,

          planId:
            selectedOffer.id,

          status:
            "active",

          priceUsd:
            selectedOffer.priceUsd,

          purchasedAt,

          offerVersion:
            selectedOffer.version,

          paymentProvider:
            event.paymentProvider ||
            "mock",

          paymentReference,

          totalRuns:
            selectedOffer.runsIncluded,

          remainingRuns:
            selectedOffer.runsIncluded,

          maxFilesPerRun:
            selectedOffer.maxFilesPerRun,
        });
    } catch (error) {
      console.error(
        "[supabase] purchase sync failed",
        {
          userId:
            event.userId,

          planId:
            selectedOffer.id,

          paymentReference,

          message:
            error?.message ||
            String(error),
        },
      );

      return {
        ok: false,
        error:
          "supabase-sync-failed",
      };
    }

    const record = {
      userId:
        event.userId,

      planId:
        selectedOffer.id,

      planName:
        selectedOffer.name,

      status:
        "active",

      remaining:
        selectedOffer.runsIncluded,

      total:
        selectedOffer.runsIncluded,

      maxFilesPerRun:
        selectedOffer.maxFilesPerRun,

      offerVersion:
        selectedOffer.version,

      priceUsd:
        selectedOffer.priceUsd,

      currency:
        selectedOffer.currency,

      sessionId:
        event.sessionId ||
        null,

      purchasedAt:

        now(),

      paymentProvider:
        event.paymentProvider ||
        "mock",

      paymentReference,

      supabaseSubscriptionId:
        supabaseResult.subscription?.id ||
        null,

      supabaseEntitlementId:
        supabaseResult.entitlement?.id ||
        null,
    };

    entitlements.set(
      event.userId,
      record,
    );

    if (
      event.sessionId
    ) {
      sessionsPurchased.set(
        event.sessionId,
        event.userId,
      );
    }

    audit({
      action:
        "purchase",

      eventId:
        event.id,

      userId:
        event.userId,

      planId:
        selectedOffer.id,

      amountUsd:
        selectedOffer.priceUsd,

      sessionId:
        event.sessionId ||
        null,

      paymentReference,
    });

    /*
     * Best-effort: generate + email the customer's PDF invoice on success.
     * A PDF/email failure must NEVER change the purchase result (that would
     * cause provider retries or a failed-looking grant), so swallow errors.
     */
    if (onPurchase) {
      try {
        await onPurchase({
          event,
          record,
          selectedOffer,
          paymentReference,
          purchasedAt,
        });
      } catch (error) {
        console.error(
          "[entitlements] onPurchase (invoice) hook failed",
          error?.message ||
            String(error),
        );
      }
    }

    return {
      ok: true,

      entitlement:
        publicEntitlement(
          record,
        ),

      subscription:
        supabaseResult.subscription ||
        null,

      supabaseEntitlement:
        supabaseResult.entitlement ||
        null,
    };
  }

  async function handleWebhook({
    body,
    signature,
    timestamp,
  }) {
    const sigCheck =
      verifySignature({
        body,
        signature,
        timestamp,
      });

    if (!sigCheck.ok) {
      return sigCheck;
    }

    let event;

    try {
      event =
        JSON.parse(body);
    } catch {
      return {
        ok: false,
        error:
          "bad-json",
      };
    }

    if (
      !event?.id ||
      !event?.type
    ) {
      return {
        ok: false,
        error:
          "bad-event",
      };
    }

    if (
      processedEvents.has(
        event.id,
      )
    ) {
      return {
        ok: false,
        error: "replay",
      };
    }

    let result;

    switch (
      event.type
    ) {
      case "checkout.session.completed":
        result =
          await applyPurchase(
            event,
          );
        break;

      case "charge.refunded":
        result =
          await applyStatus(
            event,
            "refunded",
          );
        break;

      case "charge.dispute.created":
        result =
          await applyStatus(
            event,
            "disputed",
          );
        break;

      default:
        processedEvents.set(
          event.id,
          true,
        );

        audit({
          action:
            "webhook-ignored",

          eventId:
            event.id,

          type:
            event.type,
        });

        persistState();

        return {
          ok: true,
          ignored: true,
        };
    }

    if (result.ok) {
      processedEvents.set(
        event.id,
        true,
      );

      persistState();
    }

    return result;
  }

  async function applyStatus(
    event,
    status,
  ) {
    const record =
      entitlements.get(
        event.userId,
      );

    if (!record) {
      return {
        ok: false,
        error:
          "unknown-entitlement",
      };
    }

    record.status =
      status;

    if (
      status ===
        "refunded" ||
      status ===
        "disputed"
    ) {
      record.remaining =
        0;
    }

    /*
     * Mirror the status/quota to Supabase.
     *
     * There is no subscription ID requirement here because the DB adapter
     * can be updated separately later when the real payment provider is added.
     */
    try {
      await upsertEntitlement({
        userId:
          event.userId,

        status,

        totalRuns:
          record.total,

        remainingRuns:
          record.remaining,

        maxFilesPerRun:
          record.maxFilesPerRun,

        offerVersion:
          record.offerVersion,

        purchasedAt:
          record.purchasedAt
            ? new Date(
                record.purchasedAt,
              ).toISOString()
            : null,
      });
    } catch (error) {
      console.error(
        "[supabase] entitlement status sync failed",
        {
          userId:
            event.userId,

          status,

          message:
            error?.message ||
            String(error),
        },
      );

      return {
        ok: false,
        error:
          "supabase-sync-failed",
      };
    }

    audit({
      action:
        status,

      eventId:
        event.id,

      userId:
        event.userId,

      planId:
        record.planId ||
        null,
    });

    return {
      ok: true,

      entitlement:
        publicEntitlement(
          record,
        ),
    };
  }

  /**
   * Development-only mock purchase completion.
   *
   * This does NOT bypass server-side plan validation.
   * It simply creates the same event shape that the eventual
   * payment provider webhook will produce.
   *
   * The HTTP route that exposes this function should be disabled
   * in production unless explicitly enabled.
   */
  async function completeMockPurchase({
    userId,
    sessionId,
    planId,
    email,
  }) {
    if (!userId) {
      return {
        ok: false,
        error:
          "missing-user",
      };
    }

    const effectivePlanId =
      normalizePlanId(
        planId,
      );

    const selectedOffer =
      getPaidOffer(
        effectivePlanId,
      );

    if (!selectedOffer) {
      return {
        ok: false,
        error:
          "unknown-plan",
      };
    }

    if (!sessionId) {
      return {
        ok: false,
        error:
          "missing-session",
      };
    }

    const eventId =
      `mock_evt_${crypto.randomBytes(12).toString("hex")}`;

    const paymentReference =
      `mock_${sessionId}`;

    return applyPurchase({
      id:
        eventId,

      type:
        "checkout.session.completed",

      userId,

      email,

      planId:
        selectedOffer.id,

      amountUsd:
        selectedOffer.priceUsd,

      offerVersion:
        selectedOffer.version,

      sessionId,

      paymentProvider:
        "mock",

      paymentReference,

      purchasedAt:
        new Date(
          now(),
        ).toISOString(),
    });
  }

  function applySupportOverride({
    userId,
    status,
    remaining,
    actor,
    reason,
    planId = "pair",
  }) {
    if (
      !userId ||
      !actor ||
      !reason
    ) {
      return {
        ok: false,
        error:
          "missing-fields",
      };
    }

    const selectedOffer =
      getPaidOffer(
        planId,
      ) ||
      getPaidOffer(
        "pair",
      );

    const record =
      entitlements.get(
        userId,
      ) || {
        userId,

        planId:
          selectedOffer.id,

        planName:
          selectedOffer.name,

        total:
          selectedOffer.runsIncluded,

        maxFilesPerRun:
          selectedOffer.maxFilesPerRun,

        offerVersion:
          selectedOffer.version,

        priceUsd:
          selectedOffer.priceUsd,

        currency:
          selectedOffer.currency,

        purchasedAt:
          now(),
      };

    record.status =
      status;

    record.remaining =
      Math.max(
        0,
        Number(
          remaining,
        ) || 0,
      );

    entitlements.set(
      userId,
      record,
    );

    audit({
      action:
        "support-override",

      userId,
      actor,
      reason,
      status,

      remaining:
        record.remaining,

      planId:
        record.planId,
    });

    persistState();

    return {
      ok: true,

      entitlement:
        publicEntitlement(
          record,
        ),
    };
  }

  function getEntitlement(
    userId,
  ) {
    const record =
      entitlements.get(
        userId,
      );

    if (!record) {
      return {
        status: "none",
        remaining: 0,
        total: 0,
      };
    }

    return publicEntitlement(
      record,
    );
  }

  function listPublic() {
    return [
      ...entitlements.values(),
    ].map(
      (record) =>
        publicEntitlement(
          record,
        ),
    );
  }

  function issueLicenseToken({
    userId,
    deviceId = null,
  }) {
    const record =
      entitlements.get(
        userId,
      );

    if (
      !record ||
      record.status !==
        "active" ||
      record.remaining < 0
    ) {
      return {
        ok: false,
        error:
          "not-entitled",
      };
    }

    const token =
      crypto
        .randomBytes(
          24,
        )
        .toString(
          "base64url",
        );

    const expiresAt =
      now() +
      tokenTtlMs;

    tokens.set(
      token,
      {
        userId,
        deviceId,
        expiresAt,
        revoked: false,
      },
    );

    audit({
      action:
        "issue-token",

      userId,
      deviceId,
    });

    return {
      ok: true,

      token,

      expiresAt,

      scope:
        Object.freeze({
          userId,
          deviceId,

          offerVersion:
            record.offerVersion,

          planId:
            record.planId ||
            null,
        }),
    };
  }

  function verifyLicenseToken({
    token,
    userId,
    deviceId = null,
  }) {
    const entry =
      tokens.get(
        token,
      );

    if (
      !entry ||
      entry.revoked
    ) {
      return {
        ok: false,
        error:
          "invalid-token",
      };
    }

    if (
      entry.userId !==
      userId
    ) {
      return {
        ok: false,
        error:
          "wrong-user",
      };
    }

    if (
      deviceId &&
      entry.deviceId &&
      entry.deviceId !==
        deviceId
    ) {
      return {
        ok: false,
        error:
          "device-mismatch",
      };
    }

    const grace =
      offlineGraceMs > 0
        ? offlineGraceMs
        : 0;

    if (
      entry.expiresAt +
        grace <
      now()
    ) {
      return {
        ok: false,
        error:
          "expired",
      };
    }

    const record =
      entitlements.get(
        userId,
      );

    if (
      !record ||
      record.status !==
        "active"
    ) {
      return {
        ok: false,
        error:
          "not-entitled",
      };
    }

    return {
      ok: true,

      remaining:
        record.remaining,

      status:
        record.status,

      offerVersion:
        record.offerVersion,

      planId:
        record.planId ||
        null,
    };
  }

  async function consumeRun({
    userId,
    token = null,
    deviceId = null,
    claimedRemaining = null,
  }) {
    if (
      claimedRemaining !=
      null
    ) {
      return {
        ok: false,
        error:
          "client-claim-rejected",
      };
    }

    if (token) {
      const verified =
        verifyLicenseToken({
          token,
          userId,
          deviceId,
        });

      if (!verified.ok) {
        return verified;
      }
    }

    const record =
      entitlements.get(
        userId,
      );

    if (
      !record ||
      record.status !==
        "active"
    ) {
      return {
        ok: false,
        error:
          "not-entitled",
      };
    }

    if (
      record.remaining < 1
    ) {
      return {
        ok: false,
        error:
          "quota-exhausted",
      };
    }

    record.remaining -= 1;

    /*
     * Keep the database quota in sync with the server quota.
     */
    try {
      await upsertEntitlement({
        userId,

        status:
          record.status,

        totalRuns:
          record.total,

        remainingRuns:
          record.remaining,

        maxFilesPerRun:
          record.maxFilesPerRun,

        offerVersion:
          record.offerVersion,

        purchasedAt:
          record.purchasedAt
            ? new Date(
                record.purchasedAt,
              ).toISOString()
            : null,
      });
    } catch (error) {
      /*
       * Roll back the local decrement if the authoritative DB update
       * failed, so a temporary DB outage does not silently consume a run.
       */
      record.remaining += 1;

      console.error(
        "[supabase] consume sync failed",
        {
          userId,
          message:
            error?.message ||
            String(error),
        },
      );

      return {
        ok: false,
        error:
          "supabase-sync-failed",
      };
    }

    audit({
      action:
        "consume",

      userId,

      planId:
        record.planId ||
        null,

      remaining:
        record.remaining,
    });

    persistState();

    return {
      ok: true,

      remaining:
        record.remaining,
    };
  }

  function publicEntitlement(
    record,
  ) {
    return Object.freeze({
      userId:
        record.userId,

      planId:
        record.planId ||
        "pair",

      planName:
        record.planName ||
        null,

      status:
        record.status ||
        "none",

      remaining:
        record.remaining ??
        0,

      total:
        record.total ??
        0,

      maxFilesPerRun:
        record.maxFilesPerRun ??
        null,

      offerVersion:
        record.offerVersion ??
        null,

      priceUsd:
        record.priceUsd ??
        null,

      currency:
        record.currency ||
        null,

      sessionId:
        record.sessionId ||
        null,

      purchasedAt:
        record.purchasedAt ??
        null,

      paymentProvider:
        record.paymentProvider ||
        null,

      paymentReference:
        record.paymentReference ||
        null,

      supabaseSubscriptionId:
        record.supabaseSubscriptionId ||
        null,

      supabaseEntitlementId:
        record.supabaseEntitlementId ||
        null,
    });
  }

  return {
    version:
      ENTITLEMENTS_VERSION,

    handleWebhook,

    completeMockPurchase,

    getEntitlement,

    listPublic,

    issueLicenseToken,

    verifyLicenseToken,

    consumeRun,

    applySupportOverride,

    audits: () => [
      ...audits,
    ],

    /*
     * Exposed only for internal checkout/server tests.
     */
    _entitlements:
      entitlements,

    _sessionsPurchased:
      sessionsPurchased,
  };
}

module.exports = {
  ENTITLEMENTS_VERSION,
  MAX_SKEW_SEC,
  createEntitlementService,
};