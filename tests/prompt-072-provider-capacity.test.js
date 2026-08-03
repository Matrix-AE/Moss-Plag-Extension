"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const capacity = require(path.join(root, "apps/api/commerce/provider-capacity"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/provider-capacity.md"), "utf8");

test("P072-T01 versioned capabilities match public evidence without invented reset TZ", () => {
  const cfg = capacity.createProviderCapacityConfig();
  assert.equal(cfg.version, capacity.CAPACITY_VERSION);
  assert.equal(cfg.providerPublicDailyLimitPerUser, 100);
  assert.equal(cfg.resetTimezone, null);
  assert.equal(cfg.resetTimezonePolicy, "unspecified-do-not-invent");
  assert.equal(cfg.publicSlaFound, false);
  assert.equal(cfg.evidenceSource, "moss-service-research-public-materials");
  assert.match(cfg.consumptionEvent, /provider-accepted/);
});

test("P072-T02 enforces credential concurrency file group byte timeout bounds", () => {
  const cfg = capacity.createProviderCapacityConfig();
  assert.equal(cfg.credentialQuota.maxActivePerTenant, 1);
  assert.equal(cfg.concurrency.maxInFlightPerTenant, 2);
  assert.equal(cfg.concurrency.maxInFlightGlobal, 20);
  assert.equal(cfg.bounds.maxFilesPerSubmission, 100);
  assert.equal(cfg.bounds.maxGroupsPerSubmission, 50);
  assert.equal(cfg.bounds.maxBytesPerSubmission, 32 * 1024 * 1024);
  assert.equal(cfg.timeouts.submitMs, 120_000);
  assert.equal(cfg.timeouts.resultPollMs, 300_000);
  assert.ok(cfg.maintenance.windowUtcHint === null);
  assert.ok(cfg.escalation.opsOwner);
  assert.ok(cfg.forecasts.launchPeakJobsPerHour > 0);
});

test("P072-T03 never promises greater availability retention capacity or support than evidence", () => {
  const cfg = capacity.createProviderCapacityConfig();
  assert.equal(cfg.promises.availabilityPercent, null);
  assert.equal(cfg.promises.providerRetentionDays, null);
  assert.equal(cfg.promises.supportSlaHours, null);
  assert.equal(cfg.promises.greaterThanPublicEvidence, false);
  const stress = capacity.stressScenarios(cfg);
  assert.ok(stress.highUse.ok);
  assert.ok(stress.providerOutage.ok);
  assert.equal(stress.providerOutage.degradedMode, "disable-new-submissions");
});

test("P072-T04 validates submissions against capacity and covers operational scenarios", () => {
  const cfg = capacity.createProviderCapacityConfig();
  const ok = capacity.validateAgainstCapacity(cfg, {
    files: 10,
    groups: 2,
    bytes: 1_000_000,
    inFlightTenant: 1,
    inFlightGlobal: 5,
  });
  assert.equal(ok.ok, true);

  const over = capacity.validateAgainstCapacity(cfg, {
    files: 101,
    groups: 2,
    bytes: 1_000_000,
    inFlightTenant: 1,
    inFlightGlobal: 5,
  });
  assert.equal(over.ok, false);
  assert.ok(over.violations.includes("max-files"));

  const plan = capacity.operationalCapacityPlan(cfg);
  assert.ok(plan.scenarios.includes("launch-peak"));
  assert.ok(plan.scenarios.includes("outage"));
  assert.ok(plan.scenarios.includes("exhaustion"));
  assert.ok(plan.scenarios.includes("growth"));
  assert.ok(plan.scenarios.includes("contract-change"));
  assert.ok(plan.scenarios.includes("termination"));
});

test("P072-T05 docs reconcile values with evidence", () => {
  assert.match(doc, /100 submissions/i);
  assert.match(doc, /do not invent/i);
  assert.match(doc, /no published SLA/i);
  assert.match(doc, /CAPACITY_VERSION|versioned/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./commerce/provider-capacity"], "./commerce/provider-capacity.js");
});
