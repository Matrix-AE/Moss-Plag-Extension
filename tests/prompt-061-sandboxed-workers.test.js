"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const workers = require(path.join(root, "apps/api/workers/sandboxed"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/sandboxed-workers.md"), "utf8");

test("P061-T01 module validation", () => assert.equal(workers.validateSandboxedWorkersModule().ok, true));

test("P061-T02 intake has no credential egress", () => {
  const runtime = workers.createWorkerRuntime();
  const lease = runtime.leaseIntake({
    jobId: "job_1",
    manifest: { hash: "abc", files: [{ id: "1", displayName: "a.py", bytes: 3 }] },
    sourceArtifacts: [{ key: "obj_1", bytes: 3 }],
  });
  assert.equal(lease.ok, true);
  assert.equal(lease.worker.privileges.providerEgress, false);
  assert.equal(lease.worker.privileges.credentialAccess, false);
  assert.equal(lease.worker.privileges.root, false);

  const result = runtime.runIntake(lease.worker.id, { injectCredential: "99999" });
  assert.equal(result.ok, true);
  assert.equal(result.stages.some((s) => /99999|userid/i.test(JSON.stringify(s))), false);
  assert.ok(result.stages.some((s) => s.stage === "credential-denied"));
  assert.equal(result.artifactsCleaned, true);
});

test("P061-T03 submission accepts immutable manifests only", () => {
  const runtime = workers.createWorkerRuntime();
  const mutable = { hash: "h1", files: [{ id: "1", displayName: "a.py", bytes: 1 }] };
  const bad = runtime.leaseSubmission({
    jobId: "job_2",
    manifest: mutable,
    credentialRef: "cred_1",
    sourceArtifacts: [{ key: "obj_2", bytes: 1 }],
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "manifest-not-immutable");

  const frozen = Object.freeze({
    hash: "h1",
    files: Object.freeze([{ id: "1", displayName: "a.py", bytes: 1 }]),
  });
  const lease = runtime.leaseSubmission({
    jobId: "job_2",
    manifest: frozen,
    credentialRef: "cred_1",
    sourceArtifacts: [{ key: "obj_2", bytes: 1 }],
  });
  assert.equal(lease.ok, true);
  assert.equal(lease.worker.privileges.providerEgress, true);
  assert.equal(lease.worker.privileges.executeSource, false);

  const done = runtime.runSubmission(lease.worker.id, {
    resultUrl: "https://mock.local/results/r1",
  });
  assert.equal(done.ok, true);
  assert.equal(done.resultMeta.reportUrlRef.startsWith("ref_"), true);
  assert.equal(done.resultMeta.reportUrl, undefined);
  assert.equal(done.artifactsCleaned, true);
  assert.equal(done.sourceExecuted, false);
});

test("P061-T04 timeout cancel crash cleanup and redaction", () => {
  const runtime = workers.createWorkerRuntime({ deadlineMs: 5 });
  const lease = runtime.leaseIntake({
    jobId: "job_3",
    manifest: { hash: "x", files: [{ id: "1", displayName: "secret.py", bytes: 9 }] },
    sourceArtifacts: [{ key: "obj_secret", bytes: 9 }],
  });
  const timed = runtime.runIntake(lease.worker.id, { simulate: "timeout" });
  assert.equal(timed.ok, false);
  assert.equal(timed.error, "deadline-exceeded");
  assert.equal(timed.artifactsCleaned, true);
  assert.ok(timed.stages.every((s) => !/secret\.py|obj_secret/.test(JSON.stringify(s))));

  const lease2 = runtime.leaseIntake({
    jobId: "job_4",
    manifest: { hash: "y", files: [{ id: "2", displayName: "b.py", bytes: 1 }] },
    sourceArtifacts: [{ key: "obj_b", bytes: 1 }],
  });
  const canceled = runtime.runIntake(lease2.worker.id, { simulate: "cancel" });
  assert.equal(canceled.ok, false);
  assert.equal(canceled.error, "canceled");
  assert.equal(canceled.artifactsCleaned, true);

  const lease3 = runtime.leaseIntake({
    jobId: "job_5",
    manifest: { hash: "z", files: [{ id: "3", displayName: "c.py", bytes: 1 }] },
    sourceArtifacts: [{ key: "obj_c", bytes: 1 }],
  });
  const crashed = runtime.simulateCrash(lease3.worker.id);
  assert.equal(crashed.artifactsCleaned, true);
  assert.equal(crashed.sourceBeyondBackstop, false);

  const lease4 = runtime.leaseSubmission({
    jobId: "job_6",
    manifest: Object.freeze({ hash: "m", files: Object.freeze([{ id: "4", displayName: "d.py", bytes: 1 }]) }),
    credentialRef: "cred_1",
    sourceArtifacts: [{ key: "obj_d", bytes: 1 }],
  });
  const denied = runtime.runSubmission(lease4.worker.id, { simulate: "egress-denied" });
  assert.equal(denied.ok, false);
  assert.equal(denied.error, "egress-denied");
  assert.equal(denied.artifactsCleaned, true);

  const lease5 = runtime.leaseIntake({
    jobId: "job_7",
    manifest: { hash: "n", files: [{ id: "5", displayName: "e.py", bytes: 1 }] },
    sourceArtifacts: [{ key: "obj_e", bytes: 1 }],
  });
  const pressure = runtime.runIntake(lease5.worker.id, { simulate: "memory-pressure" });
  assert.equal(pressure.ok, false);
  assert.equal(pressure.error, "resource-limit");
  assert.equal(pressure.artifactsCleaned, true);

  assert.match(doc, /backstop/i);
  assert.match(doc, /no provider credential/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./workers/sandboxed"], "./workers/sandboxed.js");
});
