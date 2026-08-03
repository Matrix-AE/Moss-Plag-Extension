"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const transfer = require(path.join(root, "apps/api/uploads/transfer-manager"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/upload-transfer.md"), "utf8");

test("P050-T01 module validation", async () => {
  assert.equal((await transfer.validateTransferModule()).ok, true);
});

test("P050-T02 start run cancel resume idempotency", async () => {
  const api = transfer.createMockApi();
  const mgr = transfer.createTransferManager({ api, concurrency: 2 });
  const files = [
    { localId: "1", displayName: "a.py", bytes: 10, hash: "h1" },
    { localId: "2", displayName: "b.py", bytes: 20, hash: "h2" },
  ];
  const draft = { title: "Lab", idempotencyKey: "idem-50", mode: "batch" };
  const started = await mgr.startAfterReview({
    draft,
    consent: { recordedAt: new Date().toISOString() },
    entitlement: { ok: true },
    accessToken: "t",
    files,
  });
  assert.equal(started.ok, true);
  const again = await mgr.startAfterReview({
    draft,
    consent: { recordedAt: new Date().toISOString() },
    entitlement: { ok: true },
    accessToken: "t",
    files,
  });
  assert.equal(again.jobId, started.jobId);
  assert.equal((await mgr.run(started.transferId)).ok, true);
  assert.equal(mgr.getProgress(started.transferId).ratio, 1);

  const cancelStart = await mgr.startAfterReview({
    draft: { ...draft, idempotencyKey: "idem-50-c", title: "C" },
    consent: { recordedAt: new Date().toISOString() },
    entitlement: { ok: true },
    accessToken: "t",
    files,
  });
  assert.equal(mgr.cancel(cancelStart.transferId).forgot, false);
  assert.equal((await mgr.run(cancelStart.transferId)).error, "canceled");
});

test("P050-T03 docs and package export", () => {
  assert.match(doc, /Cancel cleans active objects/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./uploads/transfer"], "./uploads/transfer-manager.js");
  const workspace = fs.readFileSync(
    path.join(root, "apps/extension/src/shared/workflow/WorkflowApp.tsx"),
    "utf8",
  );
  assert.match(workspace, /upload|Start Pair Check|entitlement/i);
});
