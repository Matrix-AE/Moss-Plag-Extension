"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const results = require(path.join(root, "apps/api/results/metadata"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/result-metadata.md"), "utf8");

test("P066-T01 module validation", () => assert.equal(results.validateResultMetadataModule().ok, true));

test("P066-T02 encrypt validate url forget delete", () => {
  const store = results.createResultStore({ encryptionKey: Buffer.alloc(32, 5) });
  const saved = store.saveResult({
    jobId: "j1",
    ownerUserId: "u1",
    reportUrl: "https://mock.local/results/abc",
    language: "python",
    mode: "pair",
    entitlementOk: true,
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.plaintextUrl, undefined);
  assert.ok(saved.estimate);

  const idor = store.getResult("j1", { ownerUserId: "u2" });
  assert.equal(idor.ok, false);

  const view = store.getResult("j1", { ownerUserId: "u1" });
  assert.equal(view.ok, true);
  assert.equal(view.projection.reportUrl, undefined);
  assert.ok(view.projection.reportUrlAvailable);
  assert.ok(view.projection.availabilityEstimate);

  const forget = store.forgetUrl("j1", { ownerUserId: "u1" });
  assert.equal(forget.ok, true);
  assert.equal(forget.claimsProviderRevocation, false);
  const afterForget = store.getResult("j1", { ownerUserId: "u1" });
  assert.equal(afterForget.projection.reportUrlAvailable, false);
  assert.equal(afterForget.projection.historyRetained, true);

  store.saveResult({
    jobId: "j2",
    ownerUserId: "u1",
    reportUrl: "https://moss.stanford.edu/results/x",
    language: "java",
    mode: "batch",
    entitlementOk: true,
    status: "awaiting-report",
  });
  const activeDel = store.deleteHistory("j2", { ownerUserId: "u1" });
  assert.equal(activeDel.ok, false);
  assert.equal(activeDel.error, "active-job");

  store.saveResult({
    jobId: "j3",
    ownerUserId: "u1",
    reportUrl: "https://mock.local/results/z",
    language: "python",
    mode: "pair",
    entitlementOk: true,
    status: "succeeded",
  });
  const del = store.deleteHistory("j3", { ownerUserId: "u1" });
  assert.equal(del.ok, true);
  assert.equal(del.claimsProviderRevocation, false);
  assert.equal(store.getResult("j3", { ownerUserId: "u1" }).ok, false);
});

test("P066-T03 invalid url entitlement audits", () => {
  const store = results.createResultStore({ encryptionKey: Buffer.alloc(32, 5) });
  const bad = store.saveResult({
    jobId: "bad",
    ownerUserId: "u1",
    reportUrl: "http://evil.test/x",
    entitlementOk: true,
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "invalid-url");

  const noEnt = store.saveResult({
    jobId: "e1",
    ownerUserId: "u1",
    reportUrl: "https://mock.local/results/1",
    entitlementOk: false,
  });
  assert.equal(noEnt.ok, false);

  const ok = store.saveResult({
    jobId: "e2",
    ownerUserId: "u1",
    reportUrl: "https://mock.local/results/2",
    entitlementOk: true,
    language: "python",
    mode: "pair",
  });
  const audits = store.listAudits("e2");
  assert.ok(audits.every((a) => !/mock\.local\/results\/2/.test(JSON.stringify(a))));
  assert.match(doc, /bearer/i);
  assert.match(doc, /URL-only forget/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./results/metadata"], "./results/metadata.js");
});
