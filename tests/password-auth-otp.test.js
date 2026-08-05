"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createPasswordAuthService } = require("../apps/api/auth/password-auth");
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
