"use strict";

/**
 * Safepay hosted-checkout orchestration.
 *
 * start()          -> create a priced Safepay session + hosted checkout URL,
 *                     caching AND durably persisting the tracker<->session map.
 * handleWebhook()  -> verify the signed payment.succeeded webhook and grant.
 * confirmReturn()  -> after the redirect, poll Safepay and grant (fallback).
 *
 * The in-memory Maps are only a cache in front of the Supabase checkout_sessions
 * table, so a payment can still be granted after an API restart/redeploy or on a
 * different replica. Grants are serialized per session and go through
 * entitlements.completeProviderPurchase, which validates plan/price against the
 * server catalog and is idempotent (DB unique constraint on payment_reference),
 * so the webhook and the redirect can never double-grant or double-invoice.
 */

const crypto = require("node:crypto");
const offer = require("./customer-offer");
const checkoutStore = require("../db/checkout-sessions");

function defaultGetOffer(planId) {
  const id = String(planId || "").trim().toLowerCase();
  if (id !== "pair" && id !== "batch") return null;
  try {
    return offer.getPaidOfferOrThrow(id);
  } catch {
    return null;
  }
}

function createSafepayCheckoutService({
  gateway,
  entitlements,
  getOffer = defaultGetOffer,
  store = checkoutStore,
  publicBaseUrl = process.env.PUBLIC_API_BASE_URL || "http://127.0.0.1:8787",
  now = () => Date.now(),
} = {}) {
  if (!gateway) throw new Error("safepay-gateway-required");
  if (!entitlements) throw new Error("entitlement-service-required");

  const sessions = new Map(); // sessionId -> record (cache)
  const trackers = new Map(); // tracker   -> sessionId (cache)
  const inflight = new Map(); // sessionId -> in-flight grant promise
  const base = String(publicBaseUrl).replace(/\/+$/, "");

  function isConfigured() {
    return gateway.isConfigured();
  }

  function cache(record) {
    sessions.set(record.sessionId, record);
    if (record.tracker) trackers.set(record.tracker, record.sessionId);
    return record;
  }

  function recordFromRow(row) {
    const o = getOffer(row.plan) || {};
    return {
      sessionId: row.session_id,
      userId: row.user_id,
      email: row.email || null,
      planId: row.plan,
      planName: o.name || null,
      priceUsd: row.price_usd != null ? row.price_usd : o.priceUsd,
      currency: o.currency || "USD",
      offerVersion: row.offer_version,
      tracker: row.tracker,
      provider: "safepay",
      status: row.status,
      entitlementGranted: !!row.entitlement_granted,
      createdAt: now(),
    };
  }

  // Resolve a session by id or tracker, falling back to the durable store
  // (covers restart / a different replica), then cache it.
  async function loadRecord({ sessionId, tracker } = {}) {
    const sid = sessionId || (tracker && trackers.get(tracker));
    if (sid && sessions.has(sid)) return sessions.get(sid);
    try {
      const row = await store.findCheckoutSession({ sessionId, tracker });
      if (row) return cache(recordFromRow(row));
    } catch (e) {
      console.error("[safepay] checkout-session lookup failed:", e && e.message);
    }
    return null;
  }

  async function doGrant(record, { email, paymentReference } = {}) {
    const res = await entitlements.completeProviderPurchase({
      userId: record.userId,
      sessionId: record.sessionId,
      planId: record.planId,
      email: email || record.email,
      paymentReference: paymentReference || record.tracker,
      paymentProvider: "safepay",
    });
    if (res.ok) {
      record.entitlementGranted = true;
      record.status = "paid";
      record.paidAt = now();
      record.entitlement = res.entitlement || null;
      try {
        await store.markCheckoutSessionGranted(record.sessionId);
      } catch (e) {
        console.error("[safepay] mark-granted failed:", e && e.message);
      }
    }
    return res;
  }

  // Serialize grants per session so a webhook and the redirect-return (or
  // overlapping webhook retries) can't both grant / double-invoice.
  function grant(record, opts) {
    if (record.entitlementGranted) {
      return Promise.resolve({ ok: true, alreadyGranted: true, entitlement: record.entitlement || null });
    }
    if (inflight.has(record.sessionId)) return inflight.get(record.sessionId);
    const p = doGrant(record, opts);
    inflight.set(record.sessionId, p);
    return p.finally(() => inflight.delete(record.sessionId));
  }

  async function start({ userId, email, planId, redirectUrl, cancelUrl } = {}) {
    if (!userId) return { ok: false, error: "missing-user", status: 401 };
    if (!isConfigured()) return { ok: false, error: "safepay-not-configured", status: 503 };

    const offerObj = getOffer(planId);
    if (!offerObj || offerObj.paid === false) {
      return { ok: false, error: "unknown-plan", status: 400 };
    }

    const sessionId = `cs_${crypto.randomBytes(12).toString("hex")}`;
    const rUrl = redirectUrl || `${base}/v1/checkout/safepay/return?session=${sessionId}`;
    const cUrl = cancelUrl || `${base}/v1/checkout/safepay/cancel?session=${sessionId}`;

    const co = await gateway.createCheckout({
      amount: Math.round(Number(offerObj.priceUsd) * 100),
      currency: offerObj.currency || "USD",
      metadata: { order_id: sessionId, source: "pairproof" },
      redirectUrl: rUrl,
      cancelUrl: cUrl,
    });
    if (!co.ok) {
      return { ok: false, error: "safepay-checkout-failed", detail: co.detail || co.error, status: 502 };
    }

    const record = {
      sessionId,
      userId,
      email: email || null,
      planId: offerObj.id,
      planName: offerObj.name,
      priceUsd: offerObj.priceUsd,
      currency: offerObj.currency || "USD",
      offerVersion: offerObj.version,
      tracker: co.tracker,
      provider: "safepay",
      status: "open",
      entitlementGranted: false,
      paidAt: null,
      createdAt: now(),
    };
    cache(record);

    // Durable persistence so the webhook/return can grant after a restart.
    try {
      await store.saveCheckoutSession({
        sessionId,
        tracker: co.tracker,
        userId,
        plan: offerObj.id,
        priceUsd: offerObj.priceUsd,
        offerVersion: offerObj.version,
        email: email || null,
      });
    } catch (e) {
      console.error("[safepay] checkout-session persist failed (continuing on cache):", e && e.message);
    }

    return {
      ok: true,
      sessionId,
      tracker: co.tracker,
      checkoutUrl: co.checkoutUrl,
      environment: co.environment,
      planId: offerObj.id,
      planName: offerObj.name,
      priceUsd: offerObj.priceUsd,
      currency: offerObj.currency || "USD",
    };
  }

  async function recordForEvent(evt) {
    const meta = evt.metadata || {};
    const orderId = meta.order_id || (meta.data && meta.data.order_id);
    return loadRecord({ sessionId: orderId, tracker: evt.tracker });
  }

  async function handleWebhook({ rawBody, signature } = {}) {
    const verified = gateway.verifyWebhook(rawBody, signature);
    if (!verified.ok) {
      return { ok: false, error: verified.error || "invalid-signature", status: 400 };
    }
    const evt = gateway.parsePaymentEvent(verified.event);

    // Acknowledge (200) events we do not act on so Safepay stops retrying.
    if (evt.type !== "payment.succeeded") {
      return { ok: true, ignored: evt.type, status: 200 };
    }

    const record = await recordForEvent(evt);
    if (!record) {
      // Truly unknown even after the DB lookup — ack to avoid infinite retries.
      return { ok: true, unmatched: true, tracker: evt.tracker, status: 200 };
    }

    const res = await grant(record, { email: evt.customerEmail, paymentReference: record.tracker });
    if (res.ok) {
      return { ok: true, granted: true, sessionId: record.sessionId, status: 200 };
    }
    // A transient failure (e.g. Supabase briefly unreachable) MUST return non-2xx
    // so Safepay RETRIES the webhook; a permanent failure is acked but logged.
    const transient = res.error === "supabase-sync-failed";
    if (!transient) {
      console.error("[safepay] permanent grant failure for session " + record.sessionId + ": " + res.error);
    }
    return { ok: false, granted: false, grantError: res.error, sessionId: record.sessionId, status: transient ? 500 : 200 };
  }

  async function confirmReturn({ tracker, sessionId } = {}) {
    // The client-supplied `tracker` is used ONLY to look up the session; the
    // payment is always verified against the session's OWN server-created
    // tracker, so a shopper can't confirm their unpaid session against someone
    // else's paid tracker.
    const record = await loadRecord({ sessionId, tracker });
    if (!record) return { ok: false, error: "unknown-session", status: 404 };

    const st = await gateway.fetchPaymentState(record.tracker);
    if (!st.ok) return { ok: false, error: "status-unavailable", detail: st.detail, status: 502 };
    if (!st.paid) {
      return { ok: true, paid: false, state: st.state, sessionId: record.sessionId, status: 200 };
    }

    const res = await grant(record, { paymentReference: record.tracker });
    const granted = !!res.ok || !!res.alreadyGranted;
    if (!granted) {
      const transient = res.error === "supabase-sync-failed";
      return { ok: !transient, paid: true, granted: false, grantError: res.error, sessionId: record.sessionId, status: transient ? 502 : 200 };
    }
    return { ok: true, paid: true, granted: true, sessionId: record.sessionId, planName: record.planName, status: 200 };
  }

  function getSession(sessionId) {
    const r = sessions.get(sessionId);
    if (!r) return { ok: false, error: "unknown-session" };
    return {
      ok: true,
      sessionId: r.sessionId,
      status: r.status,
      paid: !!r.entitlementGranted,
      planId: r.planId,
      planName: r.planName,
      tracker: r.tracker,
    };
  }

  return { isConfigured, start, handleWebhook, confirmReturn, getSession, loadRecord };
}

module.exports = { createSafepayCheckoutService };
