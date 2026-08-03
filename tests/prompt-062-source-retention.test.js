"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const retention = require(path.join(root, "apps/api/retention/source"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/source-retention.md"), "utf8");

test("P062-T01 module validation", () => assert.equal(retention.validateSourceRetentionModule().ok, true));

test("P062-T02 terminal processing deletes source keeps metadata", () => {
  const svc = retention.createRetentionService({ backstopMs: 1000 });
  svc.registerSource({ jobId: "j1", objectKeys: ["o1", "o2"], tempPaths: ["tmp/a"] });
  const done = svc.onTerminal({ jobId: "j1", outcome: "succeeded", metadata: { language: "python", mode: "pair" } });
  assert.equal(done.ok, true);
  assert.equal(done.deletionStatus, "deleted");
  assert.ok(done.deletedAt);
  assert.equal(svc.getSource("j1").present, false);
  assert.deepEqual(svc.getApprovedMetadata("j1"), { language: "python", mode: "pair" });
  assert.equal(svc.assertNoSourceInPayload({ queue: { jobId: "j1" } }).ok, true);
});

test("P062-T03 crash outage lifecycle orphan user deletion", () => {
  const svc = retention.createRetentionService({ backstopMs: 50, now: (() => { let t = 1000; return () => (t += 10); })() });
  svc.registerSource({ jobId: "j2", objectKeys: ["o3"], tempPaths: ["tmp/b"] });
  const crash = svc.onWorkerCrash({ jobId: "j2" });
  assert.equal(crash.deletionStatus, "deleted");

  svc.registerSource({ jobId: "j3", objectKeys: ["o4"], tempPaths: [] });
  const outage = svc.deleteSource({ jobId: "j3", simulate: "storage-outage" });
  assert.equal(outage.ok, false);
  assert.equal(outage.deletionStatus, "retry-scheduled");
  const retried = svc.runDeletionRetries();
  assert.ok(retried.repaired >= 1);

  svc.registerSource({ jobId: "j4", objectKeys: ["orphan1"], tempPaths: ["tmp/o"] });
  // advance beyond backstop
  for (let i = 0; i < 10; i++) svc.now();
  const life = svc.runLifecycleSweep();
  assert.ok(life.removed >= 1);
  assert.ok(life.alerts.length >= 1);

  svc.registerSource({ jobId: "j5", objectKeys: ["u1"], tempPaths: [] });
  const userDel = svc.userRequestedDeletion({ jobId: "j5", userId: "owner", ownerUserId: "owner" });
  assert.equal(userDel.ok, true);
  assert.equal(userDel.deletionStatus, "deleted");

  const audit = svc.getDeletionAudit("j5");
  assert.ok(audit.deletedAt);
  assert.match(doc, /backups/i);
  assert.match(doc, /provider retention/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./retention/source"], "./retention/source.js");
});
