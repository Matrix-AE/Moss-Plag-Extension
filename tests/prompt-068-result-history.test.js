"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const history = require(path.join(root, "apps/api/results/history"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/result-history.md"), "utf8");

test("P068-T01 module validation", () => assert.equal(history.validateResultHistoryModule().ok, true));

test("P068-T02 pagination filters forget delete isolation", () => {
  const h = history.createHistoryService();
  for (let i = 0; i < 5; i++) {
    h.record({
      jobId: `j${i}`,
      ownerUserId: "u1",
      title: `Job ${i}`,
      mode: i % 2 === 0 ? "pair" : "batch",
      language: i % 2 === 0 ? "python" : "java",
      state: "succeeded",
      completedAt: 1000 + i,
      estimate: { availableUntil: 999999 },
      hasReportUrl: true,
    });
  }
  h.record({
    jobId: "other",
    ownerUserId: "u2",
    title: "Other",
    mode: "pair",
    language: "python",
    state: "succeeded",
    completedAt: 2000,
    hasReportUrl: true,
  });

  const page = h.list({ ownerUserId: "u1", limit: 2, offset: 0 });
  assert.equal(page.items.length, 2);
  assert.equal(page.total, 5);
  assert.ok(page.items.every((i) => i.ownerUserId === undefined));
  assert.ok(page.items.every((i) => i.reportUrl === undefined));
  assert.ok(page.items.every((i) => !i.originalPath && !i.sourcePreview));

  const filtered = h.list({ ownerUserId: "u1", mode: "pair", language: "python" });
  assert.ok(filtered.items.every((i) => i.mode === "pair" && i.language === "python"));

  const forget = h.forgetLink("j0", { ownerUserId: "u1" });
  assert.equal(forget.ok, true);
  const after = h.get("j0", { ownerUserId: "u1" });
  assert.equal(after.hasReportUrl, false);
  assert.equal(after.historyRetained, true);

  const active = h.record({
    jobId: "active",
    ownerUserId: "u1",
    title: "Active",
    mode: "pair",
    language: "python",
    state: "submitting",
    completedAt: null,
    hasReportUrl: false,
  });
  assert.equal(active.ok, true);
  const conflict = h.deleteHistory("active", { ownerUserId: "u1" });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.error, "active-job");

  const del = h.deleteHistory("j1", { ownerUserId: "u1" });
  assert.equal(del.ok, true);
  assert.equal(h.get("j1", { ownerUserId: "u1" }).ok, false);

  const cross = h.list({ ownerUserId: "u1" });
  assert.ok(cross.items.every((i) => i.jobId !== "other"));
});

test("P068-T03 rerun purge browser-sync", () => {
  const h = history.createHistoryService();
  h.record({
    jobId: "r1",
    ownerUserId: "u1",
    title: "Rerun me",
    mode: "batch",
    language: "java",
    state: "succeeded",
    completedAt: 1,
    hasReportUrl: true,
    settings: { resultCount: 100 },
  });
  const rerun = h.prepareRerun("r1", { ownerUserId: "u1" });
  assert.equal(rerun.ok, true);
  assert.equal(rerun.restore.sourceCleared, true);
  assert.equal(rerun.restore.mandatoryReselection, true);
  assert.deepEqual(rerun.restore.settings, { resultCount: 100 });
  assert.equal(rerun.restore.files, undefined);

  const persist = h.persistencePolicy();
  assert.equal(persist.browserSync, false);
  assert.equal(persist.plaintextUrlsInLists, false);

  assert.match(doc, /forget link/i);
  assert.match(doc, /tenant isolation/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./results/history"], "./results/history.js");
});
