"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const checkout = require(path.join(root, "apps/api/commerce/checkout"));
const entitlements = require(path.join(root, "apps/api/commerce/entitlements"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/hosted-checkout.md"), "utf8");

const SECRET = "whsec_test_secret_value_32chars!!";

function sign(payload, secret, ts) {
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  return { body, sig, ts };
}

test("P080-T01 creates hosted session bound to offer with tax refund terms display", () => {
  const svc = checkout.createCheckoutService({
    webhookSecret: SECRET,
    returnOrigins: ["chrome-extension://abc", "https://app.mossworkflow.dev"],
  });
  const session = svc.createSession({
    userId: "user_1",
    returnOrigin: "chrome-extension://abc",
    reviewDraftId: "draft_1",
  });
  assert.equal(session.ok, true);
  assert.equal(session.priceUsd, 15);
  assert.equal(session.offerVersion, "2.0.0");
  assert.equal(session.runsIncluded, 15);
  assert.match(session.checkoutUrl, /^https:\/\//);
  assert.ok(session.display.taxNote);
  assert.ok(session.display.refundNote);
  assert.ok(session.display.allowanceNote);
  assert.ok(session.display.termsVersion);
  assert.equal(session.jobCreated, false);
  assert.equal(session.uploadStarted, false);
});

test("P080-T02 rejects untrusted return origins and client price tampering", () => {
  const svc = checkout.createCheckoutService({
    webhookSecret: SECRET,
    returnOrigins: ["chrome-extension://abc"],
  });
  const badOrigin = svc.createSession({
    userId: "user_1",
    returnOrigin: "https://evil.example",
    reviewDraftId: "draft_1",
  });
  assert.equal(badOrigin.ok, false);
  assert.equal(badOrigin.error, "return-origin");

  const tamper = svc.createSession({
    userId: "user_1",
    returnOrigin: "chrome-extension://abc",
    reviewDraftId: "draft_1",
    clientPriceUsd: 1,
  });
  assert.equal(tamper.ok, false);
  assert.equal(tamper.error, "client-price-rejected");
});

test("P080-T03 success cancel decline duplicate delay return exactly once", () => {
  const ent = entitlements.createEntitlementService({ webhookSecret: SECRET });
  const svc = checkout.createCheckoutService({
    webhookSecret: SECRET,
    entitlementService: ent,
    returnOrigins: ["chrome-extension://abc"],
  });

  const session = svc.createSession({
    userId: "user_2",
    returnOrigin: "chrome-extension://abc",
    reviewDraftId: "draft_2",
  });

  const cancel = svc.handleReturn({ sessionId: session.sessionId, status: "cancel" });
  assert.equal(cancel.ok, true);
  assert.equal(cancel.entitlementGranted, false);
  assert.equal(cancel.reviewDraftId, "draft_2");

  const session2 = svc.createSession({
    userId: "user_2",
    returnOrigin: "chrome-extension://abc",
    reviewDraftId: "draft_2",
  });
  const decline = svc.recordProcessorOutcome({ sessionId: session2.sessionId, outcome: "decline" });
  assert.equal(decline.ok, true);
  assert.equal(decline.entitlementGranted, false);

  const session3 = svc.createSession({
    userId: "user_2",
    returnOrigin: "chrome-extension://abc",
    reviewDraftId: "draft_2",
  });
  const ts = Math.floor(Date.now() / 1000);
  const event = {
    type: "checkout.session.completed",
    id: "evt_pay_1",
    sessionId: session3.sessionId,
    userId: "user_2",
    offerVersion: "2.0.0",
    amountUsd: 15,
  };
  const signed = sign(event, SECRET, ts);
  const paid = svc.completeFromWebhook({ body: signed.body, signature: signed.sig, timestamp: ts });
  assert.equal(paid.ok, true);
  assert.equal(paid.entitlementGranted, true);
  assert.equal(paid.jobCreated, false);
  assert.equal(paid.uploadStarted, false);

  const ret = svc.handleReturn({ sessionId: session3.sessionId, status: "success" });
  assert.equal(ret.ok, true);
  assert.equal(ret.reviewIntact, true);
  assert.equal(ret.reviewDraftId, "draft_2");
  assert.equal(ret.autoStartedJob, false);

  const retAgain = svc.handleReturn({ sessionId: session3.sessionId, status: "success" });
  assert.equal(retAgain.ok, true);
  assert.equal(retAgain.alreadyReturned, true);

  // duplicate webhook converges
  const event2 = { ...event, id: "evt_pay_2" };
  const signed2 = sign(event2, SECRET, ts + 1);
  const dup = svc.completeFromWebhook({
    body: signed2.body,
    signature: signed2.sig,
    timestamp: ts + 1,
  });
  assert.equal(dup.ok, true);
  assert.equal(ent.getEntitlement("user_2").remaining, 15);

  const delayed = svc.recordProcessorOutcome({ sessionId: session3.sessionId, outcome: "delay" });
  assert.equal(delayed.ok, true);
  assert.equal(delayed.pending, true);
});

test("P080-T04 zero pre-entitlement job or upload and no secrets logged", () => {
  const svc = checkout.createCheckoutService({
    webhookSecret: SECRET,
    returnOrigins: ["chrome-extension://abc"],
  });
  const gate = svc.assertNoJobBeforeEntitlement({ userId: "user_new", entitlementActive: false });
  assert.equal(gate.ok, false);
  assert.equal(gate.error, "entitlement-required");

  const start = svc.startFirstJobAfterPurchase({
    userId: "user_new",
    entitlementActive: false,
    reviewDraftId: "draft_x",
    explicitConfirm: true,
  });
  assert.equal(start.ok, false);

  const logs = svc.redactedLogSample({
    sessionId: "cs_x",
    checkoutSecret: "secret_should_not_appear",
    cardLast4: "4242",
  });
  assert.doesNotMatch(JSON.stringify(logs), /secret_should_not_appear/);
  assert.doesNotMatch(JSON.stringify(logs), /4242/);
  assert.match(doc, /hosted checkout/i);
  assert.match(doc, /allowlist/i);
  assert.match(doc, /zero pre-entitlement/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./commerce/checkout"], "./commerce/checkout.js");
});
