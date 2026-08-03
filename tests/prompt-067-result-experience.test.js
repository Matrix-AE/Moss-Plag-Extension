"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const resultUx = require(path.join(root, "packages/ui/result-experience"));
const doc = fs.readFileSync(path.join(root, "docs/design/result-experience.md"), "utf8");

test("P067-T01 module validation", () => assert.equal(resultUx.validateResultExperienceModule().ok, true));

test("P067-T02 open copy warnings noreferrer", () => {
  const vm = resultUx.buildResultExperience({
    completedAt: "2026-08-03T10:00:00Z",
    language: "python",
    mode: "pair",
    availabilityEstimate: { availableUntil: Date.now() + 86400000 },
    reportUrl: "https://mock.local/results/1",
  });
  assert.equal(vm.ok, true);
  assert.equal(vm.autoOpen, false);
  assert.equal(vm.fabricatePercent, false);
  assert.equal(vm.impliesMisconduct, false);
  assert.equal(vm.open.rel, "noreferrer noopener");
  assert.equal(vm.open.target, "_blank");
  assert.ok(vm.warnings.some((w) => /bearer|confidential/i.test(w)));
  assert.ok(vm.warnings.some((w) => /clipboard|browser history/i.test(w)));
  assert.ok(vm.warnings.some((w) => /forget/i.test(w)));
  assert.ok(vm.reviewGuidance.length >= 1);

  const open = resultUx.performAction(vm, "open");
  assert.equal(open.ok, true);
  assert.equal(open.url, "https://mock.local/results/1");
  const copy = resultUx.performAction(vm, "copy");
  assert.equal(copy.ok, true);
  assert.equal(copy.copied, true);
});

test("P067-T03 past estimate forgotten blocked a11y", () => {
  const past = resultUx.buildResultExperience({
    completedAt: "2026-01-01T00:00:00Z",
    language: "java",
    mode: "batch",
    availabilityEstimate: { availableUntil: Date.now() - 1000 },
    reportUrl: "https://mock.local/results/old",
  });
  assert.equal(past.pastEstimate, true);
  assert.ok(past.warnings.some((w) => /may already be unavailable/i.test(w)));

  const forgotten = resultUx.buildResultExperience({
    completedAt: "2026-08-03T10:00:00Z",
    language: "python",
    mode: "pair",
    urlForgotten: true,
    reportUrl: null,
  });
  assert.equal(forgotten.actions.open.disabled, true);
  assert.equal(forgotten.actions.copy.disabled, true);
  const blocked = resultUx.performAction(forgotten, "open");
  assert.equal(blocked.ok, false);

  assert.equal(forgotten.a11y.role, "region");
  assert.ok(forgotten.a11y.keyboardOrder.includes("open"));
  assert.match(doc, /noreferrer/i);
  assert.match(doc, /not plagiarism/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./result-experience"], "./result-experience/index.js");
});
