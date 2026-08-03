"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const auth = require(path.join(root, "apps/api/auth"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/auth-sessions.md"), "utf8");

test("P048-T01 module validation and prod guard", () => {
  assert.equal(auth.validateAuthModule().ok, true);
  assert.throws(() => auth.createAuthService({ production: true, entitlements: auth.createFakeEntitlements() }));
});

test("P048-T02 nonce, refresh, logout, idor", () => {
  let t = 1_000_000;
  const svc = auth.createAuthService({
    now: () => t,
    entitlements: auth.createPluggableEntitlements(),
  });
  const link = svc.requestMagicLink({ email: "a@ex.com", deviceId: "d1", origin: "https://app.example" });
  const session = svc.verifyMagicLink({ nonce: link.nonce, code: link.code, deviceId: "d1" });
  assert.equal(session.ok, true);
  assert.equal(svc.verifyMagicLink({ nonce: link.nonce, code: link.code, deviceId: "d1" }).error, "replay");

  const rotated = svc.refresh({ refreshToken: session.refreshToken, deviceId: "d1" });
  assert.equal(rotated.ok, true);
  assert.equal(svc.refresh({ refreshToken: session.refreshToken, deviceId: "d1" }).error, "refresh-reuse");

  const link2 = svc.requestMagicLink({ email: "b@ex.com", deviceId: "d2" });
  const s2 = svc.verifyMagicLink({ nonce: link2.nonce, code: link2.code, deviceId: "d2" });
  svc.logoutAll(s2.userId);
  assert.equal(svc.authorize({ accessToken: s2.accessToken }).ok, false);

  const link3 = svc.requestMagicLink({ email: "c@ex.com", deviceId: "d3" });
  const s3 = svc.verifyMagicLink({ nonce: link3.nonce, code: link3.code, deviceId: "d3" });
  assert.equal(svc.authorize({ accessToken: s3.accessToken, jobOwnerUserId: "nope" }).error, "idor");
  assert.equal(svc.assertPurchaseIdNotAuth("p1").ok, false);
});

test("P048-T03 docs and package export", () => {
  assert.match(doc, /Purchase IDs are never authentication/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./auth"], "./auth/index.js");
});
