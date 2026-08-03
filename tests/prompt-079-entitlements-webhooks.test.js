"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const entitlements = require(path.join(root, "apps/api/commerce/entitlements"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/entitlements-webhooks.md"), "utf8");

function sign(payload, secret, ts) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const signed = `${ts}.${body}`;
  const sig = crypto.createHmac("sha256", secret).update(signed).digest("hex");
  return { body, ts, sig };
}

test("P079-T01 rejects forged altered replayed expired wrong-user tokens", () => {
  const secret = "whsec_test_secret_value_32chars!!";
  const svc = entitlements.createEntitlementService({ webhookSecret: secret });
  const purchase = {
    type: "checkout.session.completed",
    id: "evt_1",
    userId: "user_1",
    offerVersion: "2.0.0",
    amountUsd: 15,
  };
  const { body, ts, sig } = sign(purchase, secret, Math.floor(Date.now() / 1000));
  const ok = svc.handleWebhook({ body, signature: sig, timestamp: ts });
  assert.equal(ok.ok, true);

  const forged = svc.handleWebhook({ body, signature: "deadbeef", timestamp: ts });
  assert.equal(forged.ok, false);
  assert.equal(forged.error, "bad-signature");

  const altered = svc.handleWebhook({
    body: JSON.stringify({ ...purchase, amountUsd: 1 }),
    signature: sig,
    timestamp: ts,
  });
  assert.equal(altered.ok, false);

  const replay = svc.handleWebhook({ body, signature: sig, timestamp: ts });
  assert.equal(replay.ok, false);
  assert.equal(replay.error, "replay");

  const oldTs = Math.floor(Date.now() / 1000) - 3600;
  const expiredSig = sign(purchase, secret, oldTs);
  // use new event id to avoid replay map collision on same body hash path
  const expiredPayload = { ...purchase, id: "evt_old" };
  const exp = sign(expiredPayload, secret, oldTs);
  const expired = svc.handleWebhook({ body: exp.body, signature: exp.sig, timestamp: oldTs });
  assert.equal(expired.ok, false);
  assert.equal(expired.error, "timestamp-skew");

  const token = svc.issueLicenseToken({ userId: "user_1" });
  assert.equal(token.ok, true);
  const wrongUser = svc.verifyLicenseToken({ token: token.token, userId: "user_other" });
  assert.equal(wrongUser.ok, false);
  assert.equal(wrongUser.error, "wrong-user");
});

test("P079-T02 idempotent purchase refund dispute override transitions", () => {
  const secret = "whsec_test_secret_value_32chars!!";
  let now = Math.floor(Date.now() / 1000);
  const svc = entitlements.createEntitlementService({
    webhookSecret: secret,
    now: () => now * 1000,
  });

  const purchase = {
    type: "checkout.session.completed",
    id: "evt_buy",
    userId: "user_2",
    offerVersion: "2.0.0",
    amountUsd: 15,
  };
  const s1 = sign(purchase, secret, now);
  assert.equal(svc.handleWebhook({ body: s1.body, signature: s1.sig, timestamp: now }).ok, true);
  const status = svc.getEntitlement("user_2");
  assert.equal(status.status, "active");
  assert.equal(status.remaining, 15);

  now += 1;
  const dup = { ...purchase, id: "evt_buy_dup" };
  // duplicate logical purchase with different event id but same session should converge
  const sDup = sign(
    { ...dup, sessionId: "cs_1", type: "checkout.session.completed" },
    secret,
    now,
  );
  // first event lacked sessionId — set purchase with session
  const svc2 = entitlements.createEntitlementService({ webhookSecret: secret, now: () => now * 1000 });
  const p = {
    type: "checkout.session.completed",
    id: "evt_a",
    sessionId: "cs_shared",
    userId: "user_3",
    offerVersion: "2.0.0",
    amountUsd: 15,
  };
  const a = sign(p, secret, now);
  assert.equal(svc2.handleWebhook({ body: a.body, signature: a.sig, timestamp: now }).ok, true);
  now += 1;
  const p2 = { ...p, id: "evt_b" };
  const b = sign(p2, secret, now);
  const second = svc2.handleWebhook({ body: b.body, signature: b.sig, timestamp: now });
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(svc2.getEntitlement("user_3").remaining, 15);

  now += 1;
  const refund = {
    type: "charge.refunded",
    id: "evt_ref",
    userId: "user_3",
    sessionId: "cs_shared",
  };
  const r = sign(refund, secret, now);
  assert.equal(svc2.handleWebhook({ body: r.body, signature: r.sig, timestamp: now }).ok, true);
  assert.equal(svc2.getEntitlement("user_3").status, "refunded");

  now += 1;
  const dispute = {
    type: "charge.dispute.created",
    id: "evt_disp",
    userId: "user_3",
    sessionId: "cs_shared",
  };
  const d = sign(dispute, secret, now);
  assert.equal(svc2.handleWebhook({ body: d.body, signature: d.sig, timestamp: now }).ok, true);
  assert.equal(svc2.getEntitlement("user_3").status, "disputed");

  const override = svc2.applySupportOverride({
    userId: "user_3",
    status: "active",
    remaining: 2,
    actor: "support",
    reason: "goodwill",
  });
  assert.equal(override.ok, true);
  assert.equal(svc2.getEntitlement("user_3").remaining, 2);
});

test("P079-T03 short-lived scoped tokens and backend enforcement", () => {
  const secret = "whsec_test_secret_value_32chars!!";
  let nowMs = Date.now();
  const svc = entitlements.createEntitlementService({
    webhookSecret: secret,
    now: () => nowMs,
    tokenTtlMs: 60_000,
  });
  const ts = Math.floor(nowMs / 1000);
  const purchase = {
    type: "checkout.session.completed",
    id: "evt_tok",
    userId: "user_4",
    offerVersion: "2.0.0",
    amountUsd: 15,
    sessionId: "cs_tok",
  };
  const s = sign(purchase, secret, ts);
  assert.equal(svc.handleWebhook({ body: s.body, signature: s.sig, timestamp: ts }).ok, true);

  const issued = svc.issueLicenseToken({ userId: "user_4", deviceId: "dev_1" });
  assert.equal(issued.ok, true);
  assert.ok(issued.expiresAt > nowMs);

  const verified = svc.verifyLicenseToken({ token: issued.token, userId: "user_4", deviceId: "dev_1" });
  assert.equal(verified.ok, true);
  assert.equal(verified.remaining, 15);

  const consume = svc.consumeRun({ userId: "user_4", token: issued.token, deviceId: "dev_1" });
  assert.equal(consume.ok, true);
  assert.equal(consume.remaining, 14);

  // client tampering cannot grant runs without server state
  const tampered = svc.consumeRun({ userId: "user_4", claimedRemaining: 999 });
  assert.equal(tampered.ok, false);

  nowMs += 120_000;
  const expired = svc.verifyLicenseToken({ token: issued.token, userId: "user_4" });
  assert.equal(expired.ok, false);
  assert.equal(expired.error, "expired");
});

test("P079-T04 no secrets shipped and docs cover auditability", () => {
  const src = fs.readFileSync(path.join(root, "apps/api/commerce/entitlements.js"), "utf8");
  assert.doesNotMatch(src, /sk_live_/);
  assert.doesNotMatch(src, /whsec_live/);
  assert.match(doc, /webhook/i);
  assert.match(doc, /idempotent/i);
  assert.match(doc, /short-lived/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./commerce/entitlements"], "./commerce/entitlements.js");
});
