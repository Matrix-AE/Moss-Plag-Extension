"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const failures = require(path.join(root, "packages/provider-adapter/failures"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/upstream-failures.md"), "utf8");

test("P060-T01 module validation", () => assert.equal(failures.validateFailuresModule().ok, true));
test("P060-T02 phase retry quota", () => {
  const before = failures.classifyFailure({ phase: "before-connect", cause: "timeout" });
  assert.equal(before.retryable, true);
  assert.equal(before.quotaAction, "release");
  const after = failures.classifyFailure({ phase: "query-sent", cause: "timeout" });
  assert.equal(after.retryable, false);
  assert.equal(after.quotaAction, "consume");
  const amb = failures.classifyFailure({ phase: "awaiting-url", cause: "ambiguous" });
  assert.equal(amb.requiresDeliberateResubmit, true);
});
test("P060-T03 docs wiring", () => {
  assert.match(doc, /deliberate resubmit/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/provider-adapter/package.json"), "utf8"));
  assert.equal(pkg.exports["./failures"], "./failures.js");
  assert.ok(fs.existsSync(path.join(root, "docs/engineering/extension-local-testing.md")));
});
