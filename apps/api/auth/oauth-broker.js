"use strict";

const crypto = require("node:crypto");

const STATE_TTL_MS = 10 * 60 * 1000;
const EXCHANGE_TTL_MS = 2 * 60 * 1000;

const PROVIDERS = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
    scopes: "openid email profile",
  },
  microsoft: {
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    jwksUrl: "https://login.microsoftonline.com/common/discovery/v2.0/keys",
    scopes: "openid email profile",
  },
};

function createOAuthBroker({
  auth,
  env = process.env,
  now = () => Date.now(),
  fetchImpl = fetch,
} = {}) {
  if (!auth) throw new Error("auth-service-required");
  const usedStateIds = new Set();
  const exchanges = new Map();
  const jwksCache = new Map();

  function providerConfig(provider) {
    const base = PROVIDERS[provider];
    if (!base) return null;
    const prefix = provider === "google" ? "GOOGLE" : "MICROSOFT";
    const clientId = env[`${prefix}_CLIENT_ID`];
    const clientSecret = env[`${prefix}_CLIENT_SECRET`];
    if (!clientId || !clientSecret) return null;
    if (provider === "microsoft") {
      const tenant = String(env.MICROSOFT_TENANT || "common");
      return {
        ...base,
        authorizeUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
        tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
        jwksUrl: `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
        clientId,
        clientSecret,
      };
    }
    return { ...base, clientId, clientSecret };
  }

  function callbackUrl(provider) {
    const base = String(
      env.PUBLIC_API_BASE_URL || "https://mossapi-production.up.railway.app",
    ).replace(/\/+$/, "");
    return `${base}/v1/auth/oauth/${provider}/callback`;
  }

  function start({ provider, redirectUri, deviceId }) {
    const config = providerConfig(provider);
    if (!config) return { ok: false, error: "provider-not-configured", status: 503 };
    if (!isAllowedChromeRedirect(redirectUri) || !deviceId) {
      return { ok: false, error: "invalid-oauth-request", status: 400 };
    }
    const secret = String(env.OAUTH_STATE_SECRET || "");
    if (secret.length < 32) {
      return { ok: false, error: "oauth-state-secret-missing", status: 503 };
    }
    const nonce = crypto.randomBytes(24).toString("base64url");
    const payload = {
      id: crypto.randomUUID(),
      provider,
      redirectUri,
      deviceId,
      nonce,
      expiresAt: now() + STATE_TTL_MS,
    };
    const state = signState(payload, secret);
    const url = new URL(config.authorizeUrl);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", callbackUrl(provider));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", config.scopes);
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("prompt", "select_account");
    return { ok: true, authorizationUrl: url.toString(), expiresInMs: STATE_TTL_MS };
  }

  async function completeCallback({ provider, code, state }) {
    const config = providerConfig(provider);
    if (!config) return { ok: false, error: "provider-not-configured", status: 503 };
    const secret = String(env.OAUTH_STATE_SECRET || "");
    const parsed = verifyState(state, secret);
    if (!parsed.ok) return parsed;
    const payload = parsed.payload;
    if (
      payload.provider !== provider ||
      payload.expiresAt < now() ||
      usedStateIds.has(payload.id) ||
      !isAllowedChromeRedirect(payload.redirectUri)
    ) {
      return { ok: false, error: "oauth-state-invalid", status: 401 };
    }
    usedStateIds.add(payload.id);
    const redirectFailure = (error) => ({
      ok: true,
      redirectUri: appendQuery(payload.redirectUri, { oauth_error: error, provider }),
    });
    if (!code) return redirectFailure("oauth-code-missing");

    const tokenResponse = await fetchImpl(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl(provider),
      }),
    });
    const tokens = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokens.id_token) {
      return redirectFailure("oauth-token-exchange-failed");
    }

    const identity = await verifyIdToken({
      provider,
      idToken: tokens.id_token,
      clientId: config.clientId,
      nonce: payload.nonce,
      jwksUrl: config.jwksUrl,
      now,
      fetchImpl,
      jwksCache,
    });
    if (!identity.ok) return redirectFailure(identity.error);

    const session = auth.authenticateProvider({
      provider,
      subject: identity.subject,
      email: identity.email,
      emailVerified: identity.emailVerified,
      deviceId: payload.deviceId,
    });
    if (!session.ok) return redirectFailure(session.error);

    const exchangeCode = crypto.randomBytes(32).toString("base64url");
    exchanges.set(exchangeCode, {
      session,
      deviceId: payload.deviceId,
      expiresAt: now() + EXCHANGE_TTL_MS,
    });
    return {
      ok: true,
      redirectUri: appendQuery(payload.redirectUri, {
        oauth_code: exchangeCode,
        provider,
      }),
    };
  }

  function exchange({ code, deviceId }) {
    const record = exchanges.get(String(code || ""));
    if (!record) return { ok: false, error: "oauth-exchange-invalid", status: 401 };
    exchanges.delete(code);
    if (record.expiresAt < now() || record.deviceId !== deviceId) {
      return { ok: false, error: "oauth-exchange-invalid", status: 401 };
    }
    return record.session;
  }

  return { start, completeCallback, exchange, callbackUrl };
}

function isAllowedChromeRedirect(value) {
  try {
    const url = new URL(String(value || ""));
    return (
      url.protocol === "https:" &&
      /^[a-p]{32}\.chromiumapp\.org$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

function signState(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyState(state, secret) {
  if (!secret || secret.length < 32) {
    return { ok: false, error: "oauth-state-secret-missing", status: 503 };
  }
  const [encoded, signature] = String(state || "").split(".");
  if (!encoded || !signature) return { ok: false, error: "oauth-state-invalid", status: 401 };
  const expected = crypto.createHmac("sha256", secret).update(encoded).digest();
  let actual;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return { ok: false, error: "oauth-state-invalid", status: 401 };
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return { ok: false, error: "oauth-state-invalid", status: 401 };
  }
  try {
    return {
      ok: true,
      payload: JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
    };
  } catch {
    return { ok: false, error: "oauth-state-invalid", status: 401 };
  }
}

async function verifyIdToken({
  provider,
  idToken,
  clientId,
  nonce,
  jwksUrl,
  now,
  fetchImpl,
  jwksCache,
}) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) return { ok: false, error: "oauth-token-invalid", status: 401 };
  let header;
  let claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "oauth-token-invalid", status: 401 };
  }
  if (header.alg !== "RS256" || !header.kid) {
    return { ok: false, error: "oauth-token-invalid", status: 401 };
  }
  let keys = jwksCache.get(jwksUrl);
  if (!keys) {
    const response = await fetchImpl(jwksUrl);
    if (!response.ok) return { ok: false, error: "oauth-jwks-failed", status: 502 };
    const document = await response.json();
    keys = Array.isArray(document.keys) ? document.keys : [];
    jwksCache.set(jwksUrl, keys);
  }
  const jwk = keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) return { ok: false, error: "oauth-signing-key-missing", status: 401 };
  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const verified = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    Buffer.from(parts[2], "base64url"),
  );
  if (!verified) return { ok: false, error: "oauth-token-invalid", status: 401 };

  const audienceOk = Array.isArray(claims.aud)
    ? claims.aud.includes(clientId)
    : claims.aud === clientId;
  const issuerOk =
    provider === "google"
      ? claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com"
      : /^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]+\/v2\.0$/i.test(claims.iss);
  const email = String(claims.email || claims.preferred_username || "").toLowerCase();
  const emailVerified =
    provider === "google" ? claims.email_verified === true : Boolean(email && claims.sub);
  if (
    !audienceOk ||
    !issuerOk ||
    claims.nonce !== nonce ||
    Number(claims.exp || 0) * 1000 <= now() ||
    !claims.sub ||
    !email ||
    !emailVerified
  ) {
    return { ok: false, error: "oauth-claims-invalid", status: 401 };
  }
  return {
    ok: true,
    subject: String(claims.sub),
    email,
    emailVerified: true,
  };
}

function appendQuery(uri, values) {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value);
  return url.toString();
}

module.exports = {
  STATE_TTL_MS,
  EXCHANGE_TTL_MS,
  createOAuthBroker,
  isAllowedChromeRedirect,
  signState,
  verifyState,
  verifyIdToken,
};
