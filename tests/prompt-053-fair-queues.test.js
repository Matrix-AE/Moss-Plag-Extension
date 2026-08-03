"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const queues = require(path.join(root, "apps/api/queues/fair"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/fair-queues.md"), "utf8");

test("P053-T01 module validation", () => assert.equal(queues.validateQueuesModule().ok, true));
test("P053-T02 fairness caps leases circuit", () => {
  let t = 1; const q = queues.createFairQueues({ now: () => t, perCredentialCap: 1, leaseMs: 50 });
  q.enqueueProvider({ jobId: "1", userId: "u1" }, { credentialId: "c1" });
  q.enqueueProvider({ jobId: "2", userId: "u2" }, { credentialId: "c1" });
  assert.equal(q.claimProvider({ workerId: "w" }).ok, true);
  assert.equal(q.claimProvider({ workerId: "w" }).ok, false);
  t += 100; q.recoverExpiredLeases();
  assert.equal(q.claimProvider({ workerId: "w2" }).ok, true);
  assert.equal(q.quotaResetBoundary().ok, false);
});
test("P053-T03 docs wiring", () => {
  assert.match(doc, /circuit breaker/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./queues/fair"], "./queues/fair.js");
});
