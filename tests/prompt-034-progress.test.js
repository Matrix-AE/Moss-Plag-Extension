"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const progress = require(path.join(root, "packages/ui/progress"));
const doc = fs.readFileSync(path.join(root, "docs/design/progress-results.md"), "utf8");

test("P034-T01 state machine happy path", () => {
  assert.equal(progress.validateProgressUi().ok, true);
  let state = "validate";
  for (const _ of [1, 2, 3, 4, 5]) {
    state = progress.transition(state, "next").state;
  }
  assert.equal(state, "success");
});

test("P034-T02 failure recovery and constraints", () => {
  const fail = progress.transition("wait", "fail");
  assert.equal(fail.state, "failure");
  assert.equal(progress.transition("failure", "retry").state, "validate");
  const vm = progress.viewModel("success", { reportUrl: "https://example.test/r", etaMinutes: 10 });
  assert.equal(vm.autoOpen, false);
  assert.equal(vm.fabricatePercent, false);
  assert.equal(vm.action, "Copy link");
  assert.match(vm.detail, /password/i);
  assert.doesNotMatch(JSON.stringify(progress.COPY), /plagiarism|verdict/i);
});

test("P034-T03 announcements and export", () => {
  assert.equal(progress.viewModel("failure", { diagnosticId: "diag-1" }).diagnosticId, "diag-1");
  assert.equal(progress.viewModel("failure").announcements.assertive, true);
  assert.equal(progress.viewModel("wait").announcements.polite, true);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./progress"], "./progress/index.js");
  assert.match(doc, /Never fabricates percentages/);
});
