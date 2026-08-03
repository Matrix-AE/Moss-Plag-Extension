"use strict";

/**
 * Authentication, sessions, and authorization boundary (Prompt 048).
 */

const crypto = require("node:crypto");

const AUTH_VERSION = 1;
const MAGIC_TTL_MS = 10 * 60 * 1000;
const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function createAuthService({ now = () => Date.now(), entitlements = null, production = false } = {}) {
  if (production && (!entitlements || entitlements.mode === "fake")) {
    throw new Error("production-cannot-start-with-fake-entitlements");
  }

  const nonces = new Map();
  const sessions = new Map();
  const refreshByHash = new Map();
  const retiredRefreshHashes = new Set();
  const users = new Map();

  function requestMagicLink({ email, deviceId, origin }) {
    if (!email || !deviceId) return { ok: false, error: "missing-fields" };
    if (origin && !isAllowedOrigin(origin)) return { ok: false, error: "origin" };
    const nonce = crypto.randomBytes(24).toString("base64url");
    const code = String(crypto.randomInt(100000, 999999));
    nonces.set(nonce, {
      email: email.toLowerCase(),
      deviceId,
      codeHash: hash(code),
      expiresAt: now() + MAGIC_TTL_MS,
      used: false,
    });
    return { ok: true, nonce, code, expiresInMs: MAGIC_TTL_MS };
  }

  function verifyMagicLink({ nonce, code, deviceId }) {
    const entry = nonces.get(nonce);
    if (!entry) return { ok: false, error: "unknown-nonce" };
    if (entry.used) return { ok: false, error: "replay" };
    if (entry.expiresAt < now()) return { ok: false, error: "expired" };
    if (entry.deviceId !== deviceId) return { ok: false, error: "device-binding" };
    if (entry.codeHash !== hash(code)) return { ok: false, error: "bad-code" };
    entry.used = true;
    const userId = upsertUser(entry.email);
    return issueSession({ userId, deviceId, email: entry.email });
  }

  function issueSession({ userId, deviceId, email }) {
    const accessToken = crypto.randomBytes(24).toString("base64url");
    const refreshToken = crypto.randomBytes(32).toString("base64url");
    const refreshHash = hash(refreshToken);
    const session = {
      userId,
      deviceId,
      email,
      accessToken,
      accessExpiresAt: now() + ACCESS_TTL_MS,
      refreshHash,
      refreshExpiresAt: now() + REFRESH_TTL_MS,
      revoked: false,
    };
    sessions.set(accessToken, session);
    refreshByHash.set(refreshHash, session);
    return {
      ok: true,
      accessToken,
      refreshToken,
      accessExpiresInMs: ACCESS_TTL_MS,
      refreshExpiresInMs: REFRESH_TTL_MS,
      userId,
    };
  }

  function refresh({ refreshToken, deviceId }) {
    const h = hash(refreshToken);
    if (retiredRefreshHashes.has(h)) {
      for (const s of [...sessions.values()]) {
        if (s.deviceId === deviceId) logoutAll(s.userId);
      }
      return { ok: false, error: "refresh-reuse" };
    }
    const session = refreshByHash.get(h);
    if (!session) return { ok: false, error: "unknown-refresh" };
    if (session.revoked) return { ok: false, error: "revoked" };
    if (session.refreshExpiresAt < now()) return { ok: false, error: "refresh-expired" };
    if (session.deviceId !== deviceId) return { ok: false, error: "device-binding" };
    retiredRefreshHashes.add(h);
    refreshByHash.delete(h);
    sessions.delete(session.accessToken);
    return issueSession({ userId: session.userId, deviceId, email: session.email });
  }

  function authorize({ accessToken, jobOwnerUserId = null, deviceId = null }) {
    const session = sessions.get(accessToken);
    if (!session || session.revoked) return { ok: false, error: "unauthorized" };
    if (session.accessExpiresAt < now()) return { ok: false, error: "access-expired" };
    if (deviceId && session.deviceId !== deviceId) return { ok: false, error: "device-binding" };
    if (jobOwnerUserId && session.userId !== jobOwnerUserId) return { ok: false, error: "idor" };
    const entitled = entitlements ? entitlements.check(session.userId) : { ok: true, mode: "pluggable" };
    return { ok: true, userId: session.userId, deviceId: session.deviceId, entitlement: entitled };
  }

  function logoutAll(userId) {
    for (const [token, session] of sessions) {
      if (session.userId === userId) {
        session.revoked = true;
        sessions.delete(token);
        refreshByHash.delete(session.refreshHash);
      }
    }
    return { ok: true };
  }

  function upsertUser(email) {
    if (!users.has(email)) users.set(email, { userId: `user_${users.size + 1}`, email });
    return users.get(email).userId;
  }

  function assertPurchaseIdNotAuth(purchaseId) {
    return { ok: false, error: "purchase-id-not-authentication", purchaseId: Boolean(purchaseId) };
  }

  return {
    requestMagicLink,
    verifyMagicLink,
    refresh,
    authorize,
    logoutAll,
    assertPurchaseIdNotAuth,
    MAGIC_TTL_MS,
    ACCESS_TTL_MS,
    REFRESH_TTL_MS,
  };
}

function createFakeEntitlements() {
  return { mode: "fake", check: () => ({ ok: true, mode: "fake" }) };
}

function createPluggableEntitlements(checker) {
  return { mode: "pluggable", check: checker || (() => ({ ok: true, mode: "pluggable" })) };
}

function isAllowedOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function validateAuthModule() {
  const errors = [];
  try {
    createAuthService({ production: true, entitlements: createFakeEntitlements() });
    errors.push("prod-fake");
  } catch {
    // expected
  }

  let t = 1_000_000;
  const auth = createAuthService({
    now: () => t,
    entitlements: createPluggableEntitlements(),
    production: false,
  });

  const link = auth.requestMagicLink({ email: "a@example.com", deviceId: "dev1", origin: "https://app.example" });
  if (!link.ok) errors.push("link");

  const replayPrep = auth.verifyMagicLink({ nonce: link.nonce, code: link.code, deviceId: "dev1" });
  if (!replayPrep.ok) errors.push("verify");
  if (auth.verifyMagicLink({ nonce: link.nonce, code: link.code, deviceId: "dev1" }).ok) errors.push("replay");

  const link2 = auth.requestMagicLink({ email: "a@example.com", deviceId: "dev1" });
  t += MAGIC_TTL_MS + 1;
  if (auth.verifyMagicLink({ nonce: link2.nonce, code: link2.code, deviceId: "dev1" }).ok) errors.push("expiry");

  const link3 = auth.requestMagicLink({ email: "a@example.com", deviceId: "dev1" });
  if (auth.verifyMagicLink({ nonce: link3.nonce, code: link3.code, deviceId: "other" }).ok) errors.push("device");

  const link4 = auth.requestMagicLink({ email: "a@example.com", deviceId: "dev1" });
  const session = auth.verifyMagicLink({ nonce: link4.nonce, code: link4.code, deviceId: "dev1" });
  const rotated = auth.refresh({ refreshToken: session.refreshToken, deviceId: "dev1" });
  if (!rotated.ok) errors.push("rotate");
  if (auth.refresh({ refreshToken: session.refreshToken, deviceId: "dev1" }).error !== "refresh-reuse") {
    errors.push("reuse");
  }

  const link5 = auth.requestMagicLink({ email: "b@example.com", deviceId: "dev2" });
  const s5 = auth.verifyMagicLink({ nonce: link5.nonce, code: link5.code, deviceId: "dev2" });
  auth.logoutAll(s5.userId);
  if (auth.authorize({ accessToken: s5.accessToken }).ok) errors.push("logout-all");

  if (auth.authorize({ accessToken: rotated.accessToken, jobOwnerUserId: "nope" }).error !== "idor") {
    // rotated session may have been revoked by reuse — issue fresh
  }
  const link6 = auth.requestMagicLink({ email: "c@example.com", deviceId: "dev3" });
  const s6 = auth.verifyMagicLink({ nonce: link6.nonce, code: link6.code, deviceId: "dev3" });
  if (auth.authorize({ accessToken: s6.accessToken, jobOwnerUserId: "other" }).error !== "idor") errors.push("idor");
  if (auth.assertPurchaseIdNotAuth("purchase_1").ok) errors.push("purchase");

  if (auth.requestMagicLink({ email: "x@y.com", deviceId: "d", origin: "http://evil.com" }).ok) {
    // http non-localhost should fail
    errors.push("csrf-origin");
  }

  return { ok: errors.length === 0, errors };
}

module.exports = {
  AUTH_VERSION,
  MAGIC_TTL_MS,
  ACCESS_TTL_MS,
  REFRESH_TTL_MS,
  createAuthService,
  createFakeEntitlements,
  createPluggableEntitlements,
  validateAuthModule,
};
