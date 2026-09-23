"use strict";

/**
 * Safepay Express Checkout (hosted) gateway — raw fetch, no SDK.
 *
 * Flow (https://safepay-docs.netlify.app/build-your-integration/express-checkout):
 *   1. POST /order/payments/v3/          -> payment session (tracker.token)
 *   2. POST /client/passport/v1/token    -> short-lived auth token (tbt, 1h)
 *   3. build {embedded}/?environment&tracker&tbt&source=hosted&redirect_url&cancel_url
 *   4. redirect shopper; verify via GET /reporter/api/v1/payments/{tracker}
 *   5. authoritative confirmation via signed webhook (payment.succeeded)
 *
 * Auth: header `x-sfpy-merchant-secret: <SAFEPAY_SECRET_KEY>` (authType "secret").
 * Webhook: HMAC-SHA512 of the JSON body, hex, in header `X-SFPY-SIGNATURE`.
 */

const crypto = require("node:crypto");

const API_HOST = {
  sandbox: "https://sandbox.api.getsafepay.com",
  production: "https://api.getsafepay.com",
};

const EMBEDDED_HOST = {
  sandbox: "https://sandbox.api.getsafepay.com/embedded/",
  production: "https://getsafepay.com/embedded/",
};

function normalizeEnv(value) {
  const v = String(value || "sandbox").trim().toLowerCase();
  return v === "production" || v === "live" ? "production" : "sandbox";
}

function buildQuery(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

function createSafepayGateway({
  apiKey = process.env.SAFEPAY_API_KEY,
  secretKey = process.env.SAFEPAY_SECRET_KEY,
  webhookSecret = process.env.SAFEPAY_WEBHOOK_SECRET,
  environment = process.env.SAFEPAY_ENVIRONMENT,
  intent = "CYBERSOURCE",
  fetchImpl = globalThis.fetch,
} = {}) {
  const env = normalizeEnv(environment);
  const apiBase = API_HOST[env];
  const embeddedBase = EMBEDDED_HOST[env];

  if (apiKey && secretKey && webhookSecret && String(webhookSecret).length < 16) {
    console.warn(
      "[safepay] SAFEPAY_WEBHOOK_SECRET is shorter than 16 chars — webhook verification may be misconfigured.",
    );
  }

  function isConfigured() {
    return Boolean(apiKey && secretKey && apiKey.startsWith("sec_") && secretKey.length >= 20);
  }

  async function apiRequest(method, path, body) {
    if (!secretKey) return { ok: false, error: "safepay-secret-missing" };
    let res;
    try {
      res = await fetchImpl(`${apiBase}${path}`, {
        method,
        headers: {
          "x-sfpy-merchant-secret": secretKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      return { ok: false, error: "safepay-network", detail: error?.message || String(error) };
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: "safepay-http",
        status: res.status,
        detail: json?.status?.message || json?.message || JSON.stringify(json).slice(0, 300),
      };
    }
    return { ok: true, json };
  }

  /**
   * Create a hosted-checkout session and return the URL to redirect the shopper to.
   * amount is in the currency's lowest denomination (e.g. USD cents: $15 => 1500).
   */
  async function createCheckout({ amount, currency = "USD", metadata = {}, redirectUrl, cancelUrl, customerToken, includeFees = false } = {}) {
    if (!isConfigured()) return { ok: false, error: "safepay-not-configured" };
    if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: "invalid-amount" };
    if (!redirectUrl || !cancelUrl) return { ok: false, error: "redirect-urls-required" };

    // 1. Payment session
    const session = await apiRequest("POST", "/order/payments/v3/", {
      merchant_api_key: apiKey,
      user: customerToken || undefined,
      intent,
      mode: "payment",
      entry_mode: "raw",
      currency,
      amount,
      metadata,
      include_fees: includeFees,
    });
    if (!session.ok) return session;
    const tracker = session.json?.data?.tracker?.token;
    if (!tracker) return { ok: false, error: "safepay-no-tracker", detail: JSON.stringify(session.json).slice(0, 300) };

    // 2. Authentication token (tbt)
    const passport = await apiRequest("POST", "/client/passport/v1/token", {});
    if (!passport.ok) return passport;
    const tbt = typeof passport.json?.data === "string" ? passport.json.data : passport.json?.data?.token;
    if (!tbt) return { ok: false, error: "safepay-no-tbt", detail: JSON.stringify(passport.json).slice(0, 300) };

    // 3. Hosted checkout URL
    const checkoutUrl = `${embeddedBase}?${buildQuery({
      environment: env,
      tracker,
      tbt,
      source: "hosted",
      user_id: customerToken || undefined,
      redirect_url: redirectUrl,
      cancel_url: cancelUrl,
    })}`;

    return { ok: true, tracker, checkoutUrl, environment: env };
  }

  /** Poll a tracker to confirm payment; success when tracker.state === "TRACKER_ENDED". */
  async function fetchPaymentState(tracker) {
    if (!tracker) return { ok: false, error: "tracker-required" };
    const res = await apiRequest("GET", `/reporter/api/v1/payments/${encodeURIComponent(tracker)}`);
    if (!res.ok) return res;
    const state = res.json?.data?.tracker?.state || null;
    return { ok: true, state, paid: state === "TRACKER_ENDED", data: res.json?.data || null };
  }

  /**
   * Verify a webhook's HMAC-SHA512 signature (header X-SFPY-SIGNATURE) and return the event.
   * rawBody may be the raw string or the already-parsed object.
   */
  function hmacHex(buf) {
    return crypto.createHmac("sha512", webhookSecret).update(buf).digest("hex");
  }

  function sigEquals(expectedHex, provided) {
    const a = Buffer.from(expectedHex);
    const b = Buffer.from(String(provided).trim());
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  function verifyWebhook(rawBody, signature) {
    if (!webhookSecret) return { ok: false, error: "webhook-secret-missing" };
    if (!signature) return { ok: false, error: "signature-missing" };

    const rawStr = typeof rawBody === "string" ? rawBody : null;
    let payload;
    try {
      payload = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    } catch {
      return { ok: false, error: "invalid-json" };
    }

    /*
     * Verify against the EXACT raw received bytes first — the only form
     * guaranteed to match the provider's signature (whitespace, non-ASCII
     * escaping, number formatting and key order all survive). Fall back to a
     * canonical re-serialization for callers/SDKs that sign that instead.
     */
    const candidates = [];
    if (rawStr != null) candidates.push(Buffer.from(rawStr, "utf8"));
    candidates.push(Buffer.from(JSON.stringify(payload)));

    const matched = candidates.some((buf) => sigEquals(hmacHex(buf), signature));
    if (!matched) return { ok: false, error: "signature-mismatch" };
    return { ok: true, event: payload };
  }

  /** Normalize a payment.succeeded event's data for our purchase pipeline. */
  function parsePaymentEvent(event) {
    const d = (event && event.data) || {};
    return {
      type: event?.type || null,
      tracker: d.tracker || null,
      state: d.state || null,
      customerEmail: d.customer_email || null,
      amount: d.amount != null ? d.amount : null, // charged amount (base currency, e.g. PKR)
      currency: d.currency || null,
      metadata: d.metadata || {},
      eventToken: event?.token || null,
      merchantApiKey: event?.merchant_api_key || null,
    };
  }

  return {
    env,
    apiBase,
    embeddedBase,
    isConfigured,
    createCheckout,
    fetchPaymentState,
    verifyWebhook,
    parsePaymentEvent,
  };
}

module.exports = { createSafepayGateway, API_HOST, EMBEDDED_HOST };
