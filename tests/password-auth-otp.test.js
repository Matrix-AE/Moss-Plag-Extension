"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createPasswordAuthService, REFRESH_TTL_MS } = require("../apps/api/auth/password-auth");
const { createServer } = require("../apps/api/server");

test("email/password register → otp verify → authorize", async () => {
  const storePath = path.join(os.tmpdir(), `moss-auth-${process.pid}-${Date.now()}.json`);
  const sent = [];
  const auth = createPasswordAuthService({
    production: false,
    storePath,
    sendOtp: async ({ to, code }) => {
      sent.push({ to, code });
      return { ok: true, id: "test" };
    },
  });

  const reg = await auth.register({ email: "Tahir.Nazir@NDEExperts.com", password: "Secret123!" });
  assert.equal(reg.ok, true);
  assert.ok(reg.nonce);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "tahir.nazir@ndeexperts.com");

  const bad = auth.verifyOtp({ nonce: reg.nonce, code: "000000", deviceId: "dev-a" });
  assert.equal(bad.ok, false);

  const ok = auth.verifyOtp({ nonce: reg.nonce, code: sent[0].code, deviceId: "dev-a" });
  assert.equal(ok.ok, true);
  assert.ok(ok.accessToken);
  assert.equal(ok.email, "tahir.nazir@ndeexperts.com");

  const me = auth.authorize({ accessToken: ok.accessToken });
  assert.equal(me.ok, true);
  assert.equal(me.email, "tahir.nazir@ndeexperts.com");

  const login = await auth.login({ email: "tahir.nazir@ndeexperts.com", password: "Secret123!" });
  assert.equal(login.ok, true);
  assert.equal(sent.length, 2);

  const dup = await auth.register({ email: "tahir.nazir@ndeexperts.com", password: "Secret123!" });
  assert.equal(dup.ok, false);
  assert.equal(dup.error, "email-taken");

  fs.unlinkSync(storePath);
});

test("verified laptop can sign in without OTP for 30 days", async () => {
  let t = Date.now();
  const storePath = path.join(os.tmpdir(), `moss-auth-remember-${process.pid}-${t}.json`);
  const sent = [];
  const auth = createPasswordAuthService({
    now: () => t,
    production: false,
    storePath,
    sendOtp: async ({ to, code }) => {
      sent.push({ to, code });
      return { ok: true, id: "test" };
    },
  });

  const reg = await auth.register({ email: "remember@example.com", password: "Secret123!" });
  const first = auth.verifyOtp({
    nonce: reg.nonce,
    code: sent.at(-1).code,
    deviceId: "dev-trusted-1",
  });
  assert.equal(first.ok, true);

  const remembered = await auth.login({
    email: "remember@example.com",
    password: "Secret123!",
    deviceId: "dev-trusted-1",
  });
  assert.equal(remembered.ok, true);
  assert.ok(remembered.accessToken);
  assert.equal(sent.length, 1);

  const otherDevice = await auth.login({
    email: "remember@example.com",
    password: "Secret123!",
    deviceId: "dev-new-2",
  });
  assert.equal(otherDevice.ok, true);
  assert.ok(otherDevice.nonce);
  assert.equal(sent.length, 2);

  t += REFRESH_TTL_MS + 1;
  const expired = await auth.login({
    email: "remember@example.com",
    password: "Secret123!",
    deviceId: "dev-trusted-1",
  });
  assert.equal(expired.ok, true);
  assert.ok(expired.nonce);
  assert.equal(sent.length, 3);

  fs.unlinkSync(storePath);
});

test("auth HTTP routes register and verify-otp", async () => {
  const storePath = path.join(os.tmpdir(), `moss-auth-http-${process.pid}-${Date.now()}.json`);
  const sent = [];
  const auth = createPasswordAuthService({
    production: false,
    storePath,
    sendOtp: async ({ to, code }) => {
      sent.push({ to, code });
      return { ok: true, id: "test" };
    },
  });
  const api = createServer({
    host: "127.0.0.1",
    port: 0,
    submitMode: "mock-loopback",
    auth,
  });
  await new Promise((resolve, reject) => {
    api.server.listen(0, "127.0.0.1", (err) => (err ? reject(err) : resolve()));
  });
  const { port } = api.server.address();
  const origin = `http://127.0.0.1:${port}`;

  const regRes = await fetch(`${origin}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "friend@example.com", password: "Password1!" }),
  });
  const regBody = await regRes.json();
  assert.equal(regRes.status, 200);
  assert.equal(regBody.ok, true);

  const verifyRes = await fetch(`${origin}/v1/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nonce: regBody.nonce,
      code: sent[0].code,
      deviceId: "ext-device-1",
    }),
  });
  const verifyBody = await verifyRes.json();
  assert.equal(verifyRes.status, 200);
  assert.ok(verifyBody.accessToken);

  const meRes = await fetch(`${origin}/v1/auth/me`, {
    headers: { Authorization: `Bearer ${verifyBody.accessToken}` },
  });
  const meBody = await meRes.json();
  assert.equal(meBody.email, "friend@example.com");

  await api.close();
  fs.unlinkSync(storePath);
});

test("forgot password issues a code that installs a new password", async () => {
  const storePath = path.join(os.tmpdir(), `moss-auth-reset-${process.pid}-${Date.now()}.json`);
  const sent = [];
  const auth = createPasswordAuthService({
    production: false,
    storePath,
    sendOtp: async ({ to, code }) => {
      sent.push({ to, code });
      return { ok: true, id: "test" };
    },
  });

  const reg = await auth.register({ email: "locked.out@example.com", password: "OldPass123!" });
  auth.verifyOtp({ nonce: reg.nonce, code: sent[0].code, deviceId: "dev-a" });

  const unknown = await auth.requestPasswordReset({ email: "nobody@example.com" });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.error, "no-account");

  const requested = await auth.requestPasswordReset({ email: "locked.out@example.com" });
  assert.equal(requested.ok, true);
  const resetCode = sent.at(-1).code;

  // A reset code proves email ownership only — it must never mint a session.
  const hijack = auth.verifyOtp({ nonce: requested.nonce, code: resetCode, deviceId: "dev-b" });
  assert.equal(hijack.ok, false);
  assert.equal(hijack.error, "wrong-purpose");

  const wrongCode = auth.resetPassword({
    nonce: requested.nonce,
    code: "000000",
    newPassword: "BrandNew123!",
  });
  assert.equal(wrongCode.ok, false);
  assert.equal(wrongCode.error, "bad-code");

  // A rejected weak password must not consume the code.
  const weak = auth.resetPassword({
    nonce: requested.nonce,
    code: resetCode,
    newPassword: "short",
  });
  assert.equal(weak.ok, false);
  assert.equal(weak.error, "weak-password");

  const done = auth.resetPassword({
    nonce: requested.nonce,
    code: resetCode,
    newPassword: "BrandNew123!",
  });
  assert.equal(done.ok, true);

  const replay = auth.resetPassword({
    nonce: requested.nonce,
    code: resetCode,
    newPassword: "Another123!",
  });
  assert.equal(replay.ok, false);
  assert.equal(replay.error, "replay");

  const oldPassword = await auth.login({
    email: "locked.out@example.com",
    password: "OldPass123!",
  });
  assert.equal(oldPassword.ok, false);
  assert.equal(oldPassword.error, "invalid-credentials");

  const newPassword = await auth.login({
    email: "locked.out@example.com",
    password: "BrandNew123!",
  });
  assert.equal(newPassword.ok, true);

  fs.unlinkSync(storePath);
});

test("reset password revokes sessions issued before the change", async () => {
  const storePath = path.join(os.tmpdir(), `moss-auth-revoke-${process.pid}-${Date.now()}.json`);
  const sent = [];
  const auth = createPasswordAuthService({
    production: false,
    storePath,
    sendOtp: async ({ to, code }) => {
      sent.push({ to, code });
      return { ok: true, id: "test" };
    },
  });

  const reg = await auth.register({ email: "stolen@example.com", password: "OldPass123!" });
  const session = auth.verifyOtp({ nonce: reg.nonce, code: sent[0].code, deviceId: "dev-a" });
  assert.equal(auth.authorize({ accessToken: session.accessToken }).ok, true);

  const requested = await auth.requestPasswordReset({ email: "stolen@example.com" });
  auth.resetPassword({
    nonce: requested.nonce,
    code: sent.at(-1).code,
    newPassword: "BrandNew123!",
  });

  assert.equal(auth.authorize({ accessToken: session.accessToken }).ok, false);

  fs.unlinkSync(storePath);
});

test("auth HTTP routes expose forgot-password and reset-password", async () => {
  const storePath = path.join(os.tmpdir(), `moss-auth-reset-http-${process.pid}-${Date.now()}.json`);
  const sent = [];
  const auth = createPasswordAuthService({
    production: false,
    storePath,
    sendOtp: async ({ to, code }) => {
      sent.push({ to, code });
      return { ok: true, id: "test" };
    },
  });
  const api = createServer({ host: "127.0.0.1", port: 0, submitMode: "mock-loopback", auth });
  await new Promise((resolve, reject) => {
    api.server.listen(0, "127.0.0.1", (err) => (err ? reject(err) : resolve()));
  });
  const { port } = api.server.address();
  const origin = `http://127.0.0.1:${port}`;
  const post = async (path, body) => {
    const res = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  await post("/v1/auth/register", { email: "reset@example.com", password: "OldPass123!" });

  const missing = await post("/v1/auth/forgot-password", { email: "ghost@example.com" });
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error, "no-account");

  const forgot = await post("/v1/auth/forgot-password", { email: "reset@example.com" });
  assert.equal(forgot.status, 200);
  assert.ok(forgot.body.nonce);

  const reset = await post("/v1/auth/reset-password", {
    nonce: forgot.body.nonce,
    code: sent.at(-1).code,
    newPassword: "BrandNew123!",
  });
  assert.equal(reset.status, 200);
  assert.equal(reset.body.ok, true);

  const login = await post("/v1/auth/login", {
    email: "reset@example.com",
    password: "BrandNew123!",
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.ok, true);

  await api.close();
  fs.unlinkSync(storePath);
});

test("device trial can be claimed once per deviceId across accounts", async () => {
  const storePath = path.join(os.tmpdir(), `moss-auth-trial-${process.pid}-${Date.now()}.json`);
  const auth = createPasswordAuthService({
    production: false,
    storePath,
    sendOtp: async () => ({ ok: true, id: "test" }),
  });

  assert.equal(auth.getDeviceTrial({ deviceId: "dev_abc12345" }).claimed, false);

  const first = auth.claimDeviceTrial({
    deviceId: "dev_abc12345",
    email: "a@example.com",
    userId: "user_a",
  });
  assert.equal(first.ok, true);
  assert.equal(first.claimed, true);

  const again = auth.claimDeviceTrial({
    deviceId: "dev_abc12345",
    email: "b@example.com",
    userId: "user_b",
  });
  assert.equal(again.ok, false);
  assert.equal(again.error, "device-trial-used");

  const otherPc = auth.claimDeviceTrial({
    deviceId: "dev_otherpc99",
    email: "b@example.com",
    userId: "user_b",
  });
  assert.equal(otherPc.ok, true);

  const status = auth.getDeviceTrial({ deviceId: "dev_abc12345" });
  assert.equal(status.claimed, true);
  assert.equal(status.email, "a@example.com");

  fs.unlinkSync(storePath);
});

test("auth HTTP routes expose device-trial claim", async () => {
  const storePath = path.join(os.tmpdir(), `moss-auth-trial-http-${process.pid}-${Date.now()}.json`);
  const auth = createPasswordAuthService({
    production: false,
    storePath,
    sendOtp: async () => ({ ok: true, id: "test" }),
  });
  const api = createServer({ host: "127.0.0.1", port: 0, submitMode: "mock-loopback", auth });
  await new Promise((resolve, reject) => {
    api.server.listen(0, "127.0.0.1", (err) => (err ? reject(err) : resolve()));
  });
  const { port } = api.server.address();
  const origin = `http://127.0.0.1:${port}`;

  const open = await fetch(`${origin}/v1/auth/device-trial?deviceId=dev_http_trial1`);
  const openBody = await open.json();
  assert.equal(open.status, 200);
  assert.equal(openBody.claimed, false);

  const claim = await fetch(`${origin}/v1/auth/claim-device-trial`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId: "dev_http_trial1",
      email: "trial@example.com",
      userId: "user_trial",
    }),
  });
  const claimBody = await claim.json();
  assert.equal(claim.status, 200);
  assert.equal(claimBody.ok, true);

  const dup = await fetch(`${origin}/v1/auth/claim-device-trial`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId: "dev_http_trial1",
      email: "other@example.com",
      userId: "user_other",
    }),
  });
  assert.equal(dup.status, 409);

  await api.close();
  fs.unlinkSync(storePath);
});
