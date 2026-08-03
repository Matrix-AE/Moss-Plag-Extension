"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const gate = require(path.join(root, "apps/api/pipeline/submission-gate"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/submission-pipeline-gate.md"), "utf8");

test("P070-T01 module validation", async () => {
  assert.equal((await gate.validateSubmissionPipelineGate()).ok, true);
});

test("P070-T02 pair batch projects base forget delete cleanup", async () => {
  const report = await gate.runSubmissionPipelineGate({
    journeys: ["pair", "batch", "projects", "base-code"],
  });
  assert.equal(report.ok, true);
  assert.ok(report.journeys.every((j) => j.ok));
  assert.ok(report.checks.authQuota.ok);
  assert.ok(report.checks.protocolFailure.ok);
  assert.ok(report.checks.urlForget.ok);
  assert.ok(report.checks.historyDelete.ok);
  assert.ok(report.checks.cleanup.ok);
  assert.ok(report.checks.idor.ok);
  assert.equal(report.constraints.liveAccounts, false);
  assert.equal(report.constraints.realCustomerCode, false);
  assert.equal(report.constraints.mockServerOnly, true);
});

test("P070-T03 evidence security a11y retention", async () => {
  const report = await gate.runSubmissionPipelineGate({ journeys: ["pair"] });
  assert.ok(report.evidencePath);
  assert.ok(fs.existsSync(path.join(root, report.evidencePath)));
  assert.ok(report.audits.permission.ok);
  assert.ok(report.audits.csp.ok);
  assert.ok(report.audits.redactedLogs.ok);
  assert.ok(report.audits.accessibility.ok);
  assert.equal(report.highSeverityDefects, 0);
  assert.match(doc, /synthetic/i);
  assert.match(doc, /mock server/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./pipeline/submission-gate"], "./pipeline/submission-gate.js");
});
