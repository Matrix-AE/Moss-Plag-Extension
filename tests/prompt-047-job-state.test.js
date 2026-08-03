"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const jobs = require(path.join(root, "apps/api/jobs/state-machine"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/job-state-machine.md"), "utf8");

test("P047-T01 module and migrations", () => {
  const result = jobs.validateJobModule();
  assert.equal(result.ok, true);
  assert.ok(result.plan.tables.jobs);
});

test("P047-T02 transitions, cancel, race, isolation", () => {
  const repo = jobs.createRepository();
  const created = repo.createJob({
    ownerUserId: "u1",
    deviceId: "d1",
    idempotencyKey: "k1",
    title: "T",
    manifest: { n: 1 },
  });
  assert.equal(created.ok, true);
  assert.equal(
    repo.createJob({
      ownerUserId: "u1",
      deviceId: "d1",
      idempotencyKey: "k1",
      title: "T",
      manifest: { n: 1 },
    }).reused,
    true,
  );

  let job = created.job;
  for (const step of ["uploading", "uploaded", "validating", "queued", "submitting", "awaiting-report", "succeeded"]) {
    const r = repo.transition(job.id, step, { ownerUserId: "u1", expectedVersion: job.version });
    assert.equal(r.ok, true, step);
    job = r.job;
  }
  assert.equal(repo.transition(job.id, "queued", { ownerUserId: "u1" }).error, "terminal-no-reprocess");
  assert.equal(repo.getJob(job.id, { ownerUserId: "u2" }).error, "tenant-isolation");
  assert.equal(repo.requestCancel(job.id, { ownerUserId: "u1" }).error, "late-cancellation");

  const j2 = repo.createJob({
    ownerUserId: "u1",
    deviceId: "d1",
    idempotencyKey: "k2",
    title: "U",
    manifest: { n: 2 },
  }).job;
  repo.transition(j2.id, "uploading", { ownerUserId: "u1" });
  const v = repo.getJob(j2.id).job.version;
  assert.equal(repo.transition(j2.id, "uploaded", { ownerUserId: "u1", expectedVersion: v }).ok, true);
  assert.equal(repo.transition(j2.id, "uploaded", { ownerUserId: "u1", expectedVersion: v }).error, "version-conflict");
});

test("P047-T03 docs and package export", () => {
  assert.match(doc, /Guarded transitions/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./jobs"], "./jobs/state-machine.js");
});
