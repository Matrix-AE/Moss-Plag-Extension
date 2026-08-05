"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createPasswordAuthService,
  validatePassword,
} = require("../apps/api/auth/password-auth");
const {
  createOAuthBroker,
  signState,
  verifyState,
} = require("../apps/api/auth/oauth-broker");

test("strong password policy enforces every documented rule", () => {
  assert.equal(validatePassword("StrongPass1!").ok, true);
  assert.deepEqual(validatePassword("weak").failedRules.sort(), [
    "length",
    "number",
    "symbol",
    "uppercase",
  ]);
  assert.ok(validatePassword("Strong Pass1!").failedRules.includes("noWhitespace"));
});

test("OAuth state signatures reject tampering", () => {
  const secret = "test-secret-that-is-at-least-thirty-two-bytes";
  const state = signState({ id: "one", expiresAt: Date.now() + 1000 }, secret);
  assert.equal(verifyState(state, secret).ok, true);
  assert.equal(verifyState(`${state}x`, secret).ok, false);
});

test("Google OAuth callback verifies token, links email, and exchanges once", async () => {
  const storePath = path.join(os.tmpdir(), `moss-oauth-${process.pid}-${Date.now()}.json`);
  const auth = createPasswordAuthService({
    production: false,
    storePath,
    sendOtp: async () => ({ ok: true }),
  });
  const registered = await auth.register({
    email: "person@example.com",
    password: "StrongPass1!",
  });
  assert.equal(registered.ok, true);

  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const jwk = publicKey.export({ format: "jwk" });
  jwk.kid = "test-key";
  jwk.alg = "RS256";
  jwk.use = "sig";

  let nonce = "";
  const env = {
    GOOGLE_CLIENT_ID: "google-client-id",
    GOOGLE_CLIENT_SECRET: "google-client-secret",
    OAUTH_STATE_SECRET: "oauth-state-secret-that-is-long-enough-for-tests",
    PUBLIC_API_BASE_URL: "https://mossapi-production.up.railway.app",
  };
  const fetchImpl = async (url) => {
    if (String(url).includes("/token")) {
      return {
        ok: true,
        json: async () => ({
          id_token: signJwt(
            {
              iss: "https://accounts.google.com",
              aud: env.GOOGLE_CLIENT_ID,
              sub: "google-subject-1",
              email: "person@example.com",
              email_verified: true,
              nonce,
              exp: Math.floor(Date.now() / 1000) + 300,
            },
            privateKey,
          ),
        }),
      };
    }
    return { ok: true, json: async () => ({ keys: [jwk] }) };
  };
  const broker = createOAuthBroker({ auth, env, fetchImpl });
  const redirectUri = `https://${"a".repeat(32)}.chromiumapp.org/oauth`;
  const started = broker.start({ provider: "google", redirectUri, deviceId: "device-1" });
  assert.equal(started.ok, true);
  const authorization = new URL(started.authorizationUrl);
  nonce = authorization.searchParams.get("nonce");
  const state = authorization.searchParams.get("state");

  const completed = await broker.completeCallback({
    provider: "google",
    code: "provider-code",
    state,
  });
  assert.equal(completed.ok, true);
  const callback = new URL(completed.redirectUri);
  const exchangeCode = callback.searchParams.get("oauth_code");
  const session = broker.exchange({ code: exchangeCode, deviceId: "device-1" });
  assert.equal(session.ok, true);
  assert.equal(session.email, "person@example.com");
  assert.equal(auth.listUsersPublic().length, 1, "verified email links to existing user");

  assert.equal(broker.exchange({ code: exchangeCode, deviceId: "device-1" }).ok, false);
  const replay = await broker.completeCallback({
    provider: "google",
    code: "provider-code",
    state,
  });
  assert.equal(replay.ok, false);

  fs.unlinkSync(storePath);
});

function signJwt(claims, privateKey) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test-key", typ: "JWT" }))
    .toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const content = `${header}.${payload}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(content), privateKey).toString("base64url");
  return `${content}.${signature}`;
}
