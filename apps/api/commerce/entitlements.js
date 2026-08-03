"use strict";

/**
 * Webhooks, entitlements, and short-lived license tokens (Prompt 079).
 * Server-owned commercial state; secrets never ship in extension code.
 */

const crypto = require("node:crypto");
const offer = require("./customer-offer");

const ENTITLEMENTS_VERSION = 1;
const DEFAULT_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_SKEW_SEC = 300;

function createEntitlementService({
  webhookSecret,
  now = () => Date.now(),
  tokenTtlMs = DEFAULT_TOKEN_TTL_MS,
  offlineGraceMs = 0,
} = {}) {
  if (!webhookSecret || String(webhookSecret).length < 16) {
    throw new Error("webhook-secret-required");
  }

  const approved = offer.getApprovedOffer();
  const entitlements = new Map();
  const processedEvents = new Map(); // eventId -> true
  const sessionsPurchased = new Map(); // sessionId -> userId
  const tokens = new Map();
  const audits = [];

  function audit(entry) {
    audits.push({ ...entry, at: now() });
  }

  function verifySignature({ body, signature, timestamp }) {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return { ok: false, error: "bad-timestamp" };
    const skew = Math.abs(Math.floor(now() / 1000) - ts);
    if (skew > MAX_SKEW_SEC) return { ok: false, error: "timestamp-skew" };
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(`${ts}.${body}`)
      .digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature || ""));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, error: "bad-signature" };
    }
    return { ok: true };
  }

  function handleWebhook({ body, signature, timestamp }) {
    const sigCheck = verifySignature({ body, signature, timestamp });
    if (!sigCheck.ok) return sigCheck;

    let event;
    try {
      event = JSON.parse(body);
    } catch {
      return { ok: false, error: "bad-json" };
    }
    if (!event?.id || !event?.type) return { ok: false, error: "bad-event" };
    if (processedEvents.has(event.id)) return { ok: false, error: "replay" };

    let result;
    switch (event.type) {
      case "checkout.session.completed":
        result = applyPurchase(event);
        break;
      case "charge.refunded":
        result = applyStatus(event, "refunded");
        break;
      case "charge.dispute.created":
        result = applyStatus(event, "disputed");
        break;
      default:
        processedEvents.set(event.id, true);
        audit({ action: "webhook-ignored", eventId: event.id, type: event.type });
        return { ok: true, ignored: true };
    }
    if (result.ok) processedEvents.set(event.id, true);
    return result;
  }

  function applyPurchase(event) {
    if (event.amountUsd !== approved.priceUsd || event.offerVersion !== approved.version) {
      return { ok: false, error: "offer-mismatch" };
    }
    if (!event.userId) return { ok: false, error: "missing-user" };

    if (event.sessionId && sessionsPurchased.has(event.sessionId)) {
      audit({ action: "purchase-duplicate", eventId: event.id, sessionId: event.sessionId });
      return { ok: true, duplicate: true };
    }

    const record = {
      userId: event.userId,
      status: "active",
      remaining: approved.runsIncluded,
      total: approved.runsIncluded,
      maxFilesPerRun: approved.maxFilesPerRun,
      offerVersion: approved.version,
      sessionId: event.sessionId || null,
      purchasedAt: now(),
    };
    entitlements.set(event.userId, record);
    if (event.sessionId) sessionsPurchased.set(event.sessionId, event.userId);
    audit({ action: "purchase", eventId: event.id, userId: event.userId });
    return { ok: true, entitlement: publicEntitlement(record) };
  }

  function applyStatus(event, status) {
    const record = entitlements.get(event.userId);
    if (!record) return { ok: false, error: "unknown-entitlement" };
    record.status = status;
    if (status === "refunded" || status === "disputed") {
      record.remaining = 0;
    }
    audit({ action: status, eventId: event.id, userId: event.userId });
    return { ok: true, entitlement: publicEntitlement(record) };
  }

  function applySupportOverride({ userId, status, remaining, actor, reason }) {
    if (!userId || !actor || !reason) return { ok: false, error: "missing-fields" };
    const record = entitlements.get(userId) || {
      userId,
      total: approved.runsIncluded,
      maxFilesPerRun: approved.maxFilesPerRun,
      offerVersion: approved.version,
      purchasedAt: now(),
    };
    record.status = status;
    record.remaining = remaining;
    entitlements.set(userId, record);
    audit({ action: "support-override", userId, actor, reason, status, remaining });
    return { ok: true, entitlement: publicEntitlement(record) };
  }

  function getEntitlement(userId) {
    const record = entitlements.get(userId);
    if (!record) return { status: "none", remaining: 0 };
    return publicEntitlement(record);
  }

  function issueLicenseToken({ userId, deviceId = null }) {
    const record = entitlements.get(userId);
    if (!record || record.status !== "active" || record.remaining < 0) {
      return { ok: false, error: "not-entitled" };
    }
    const token = crypto.randomBytes(24).toString("base64url");
    const expiresAt = now() + tokenTtlMs;
    tokens.set(token, { userId, deviceId, expiresAt, revoked: false });
    audit({ action: "issue-token", userId, deviceId });
    return {
      ok: true,
      token,
      expiresAt,
      scope: Object.freeze({ userId, deviceId, offerVersion: record.offerVersion }),
    };
  }

  function verifyLicenseToken({ token, userId, deviceId = null }) {
    const entry = tokens.get(token);
    if (!entry || entry.revoked) return { ok: false, error: "invalid-token" };
    if (entry.userId !== userId) return { ok: false, error: "wrong-user" };
    if (deviceId && entry.deviceId && entry.deviceId !== deviceId) {
      return { ok: false, error: "device-mismatch" };
    }
    const grace = offlineGraceMs > 0 ? offlineGraceMs : 0;
    if (entry.expiresAt + grace < now()) return { ok: false, error: "expired" };
    const record = entitlements.get(userId);
    if (!record || record.status !== "active") return { ok: false, error: "not-entitled" };
    return {
      ok: true,
      remaining: record.remaining,
      status: record.status,
      offerVersion: record.offerVersion,
    };
  }

  function consumeRun({ userId, token = null, deviceId = null, claimedRemaining = null }) {
    if (claimedRemaining != null) {
      return { ok: false, error: "client-claim-rejected" };
    }
    if (token) {
      const verified = verifyLicenseToken({ token, userId, deviceId });
      if (!verified.ok) return verified;
    }
    const record = entitlements.get(userId);
    if (!record || record.status !== "active") return { ok: false, error: "not-entitled" };
    if (record.remaining < 1) return { ok: false, error: "quota-exhausted" };
    record.remaining -= 1;
    audit({ action: "consume", userId, remaining: record.remaining });
    return { ok: true, remaining: record.remaining };
  }

  function publicEntitlement(record) {
    return Object.freeze({
      userId: record.userId,
      status: record.status,
      remaining: record.remaining,
      total: record.total,
      maxFilesPerRun: record.maxFilesPerRun,
      offerVersion: record.offerVersion,
    });
  }

  return {
    version: ENTITLEMENTS_VERSION,
    handleWebhook,
    getEntitlement,
    issueLicenseToken,
    verifyLicenseToken,
    consumeRun,
    applySupportOverride,
    audits: () => [...audits],
  };
}

module.exports = {
  ENTITLEMENTS_VERSION,
  MAX_SKEW_SEC,
  createEntitlementService,
};
