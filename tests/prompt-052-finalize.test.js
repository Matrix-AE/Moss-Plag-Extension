"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const finalize = require(path.join(root, "apps/api/intake/finalize"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/finalize-outbox.md"), "utf8");

test("P052-T01 module validation", () => assert.equal(finalize.validateFinalizeModule().ok, true));
test("P052-T02 idempotency quota cancel", () => {
  const svc = finalize.createFinalizeService();
  const base = { userId: "u1", idempotencyKey: "k", entitlementOk: true,
    consent: { policyVersion: "1.0.0", recordedAt: new Date().toISOString() },
    objects: [{ path: "a/a.py", bytes: 1, content: "a" }, { path: "b/b.py", bytes: 1, content: "b" }],
    language: "python", settings: {}, title: "T" };
  const a = svc.finalize(base);
  assert.equal(svc.finalize(base).jobId, a.jobId);
  svc.processValidationOutbox();
  assert.equal(svc.getQuota("u1").reserved, 1);
  svc.processProviderOutbox();
  assert.equal(svc.getQuota("u1").consumed, 1);
});
test("P052-T03 docs wiring", () => {
  assert.match(doc, /Quota reserves after intake/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./intake/finalize"], "./intake/finalize.js");
});
