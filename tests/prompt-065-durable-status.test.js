"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const status = require(path.join(root, "apps/api/jobs/durable-status"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/durable-job-status.md"), "utf8");

test("P065-T01 module validation", () => assert.equal(status.validateDurableStatusModule().ok, true));

test("P065-T02 poller backoff restore stages cancel", async () => {
  const store = status.createJobStatusStore();
  store.upsert({
    jobId: "job_1",
    ownerUserId: "u1",
    status: "uploading",
    stage: "upload",
  });

  const delays = [];
  const poller = status.createStatusPoller({
    jobIds: ["job_1"],
    ownerUserId: "u1",
    fetchStatus: async (jobId) => store.getProjection(jobId, { ownerUserId: "u1" }),
    onUpdate: () => {},
    sleep: async (ms) => {
      delays.push(ms);
    },
    maxBackoffMs: 8000,
    baseBackoffMs: 500,
  });

  store.upsert({ jobId: "job_1", ownerUserId: "u1", status: "validating", stage: "validation" });
  await poller.tick();
  store.upsert({ jobId: "job_1", ownerUserId: "u1", status: "queued", stage: "queued" });
  await poller.tick();
  store.upsert({ jobId: "job_1", ownerUserId: "u1", status: "submitting", stage: "provider" });
  await poller.tick();
  assert.ok(delays.length >= 2);
  assert.ok(delays[1] >= delays[0]);

  const restored = status.restoreJobIds({ storage: { jobIds: ["job_1", "job_2"] } });
  assert.deepEqual(restored, ["job_1", "job_2"]);

  const cancelBefore = store.requestCancel("job_1", { ownerUserId: "u1" });
  assert.equal(cancelBefore.ok, true);
  assert.equal(cancelBefore.status, "cancel-requested");

  store.upsert({ jobId: "job_1", ownerUserId: "u1", status: "awaiting-report", stage: "waiting", queryAccepted: true });
  const late = store.requestCancel("job_1", { ownerUserId: "u1" });
  assert.equal(late.ok, true);
  assert.equal(late.stoppedAcceptedQuery, false);
  assert.match(late.message, /may still complete/i);
});

test("P065-T03 terminal stop notification privacy auth", async () => {
  const store = status.createJobStatusStore();
  store.upsert({ jobId: "job_s", ownerUserId: "u1", status: "succeeded", stage: "succeeded", title: "Lab1" });
  const proj = store.getProjection("job_s", { ownerUserId: "u1" });
  assert.equal(proj.status, "succeeded");

  const note = status.buildCompletionNotification(proj);
  assert.ok(note);
  assert.doesNotMatch(note.title + note.message, /http|Lab1|moss\.stanford/i);

  let fetches = 0;
  const poller = status.createStatusPoller({
    jobIds: ["job_s"],
    ownerUserId: "u1",
    fetchStatus: async () => {
      fetches += 1;
      return store.getProjection("job_s", { ownerUserId: "u1" });
    },
    sleep: async () => {},
  });
  await poller.tick();
  await poller.tick();
  assert.equal(fetches, 1); // stopped after terminal

  const unauth = store.getProjection("job_s", { ownerUserId: "other" });
  assert.equal(unauth.ok, false);

  store.upsert({ jobId: "job_f", ownerUserId: "u1", status: "succeeded", stage: "succeeded" });
  store.markForgotten("job_f", { ownerUserId: "u1" });
  assert.equal(store.getProjection("job_f", { ownerUserId: "u1" }).stopPolling, true);

  let forgottenFetches = 0;
  const pollForgotten = status.createStatusPoller({
    jobIds: ["job_f"],
    ownerUserId: "u1",
    fetchStatus: async () => {
      forgottenFetches += 1;
      return store.getProjection("job_f", { ownerUserId: "u1" });
    },
    sleep: async () => {},
  });
  await pollForgotten.tick();
  await pollForgotten.tick();
  assert.equal(forgottenFetches, 1);

  assert.match(doc, /service-worker/i);
  assert.match(doc, /bounded backoff/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./jobs/durable-status"], "./jobs/durable-status.js");
});
