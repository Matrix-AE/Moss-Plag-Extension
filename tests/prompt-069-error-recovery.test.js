"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const errors = require(path.join(root, "packages/ui/error-recovery"));
const doc = fs.readFileSync(path.join(root, "docs/design/error-recovery.md"), "utf8");

test("P069-T01 module validation", () => assert.equal(errors.validateErrorRecoveryModule().ok, true));

test("P069-T02 typed errors retry gating uncertain", () => {
  const catalog = errors.listErrorCatalog();
  assert.ok(catalog.length >= 8);
  for (const entry of catalog) {
    assert.ok(entry.copy.title);
    assert.ok(entry.copy.body);
    assert.ok(entry.action || entry.terminalExplanation);
    assert.doesNotMatch(entry.copy.title + entry.copy.body, /stack|credential|object key|userid|\.py|https?:\/\//i);
  }

  const quota = errors.resolveError({ code: "quota", correlationId: "corr_1" });
  assert.equal(quota.retryEligible, false);
  assert.ok(quota.actions.some((a) => a.id === "settings" || a.id === "support"));

  const uncertain = errors.resolveError({ code: "uncertain-query", correlationId: "corr_2" });
  assert.equal(uncertain.retryEligible, false);
  assert.equal(uncertain.requiresDeliberateResubmit, true);
  assert.ok(/deliberate|uncertain/i.test(uncertain.copy.body));

  const offline = errors.resolveError({ code: "offline", correlationId: "corr_3" });
  assert.equal(offline.retryEligible, true);
  assert.ok(offline.actions.some((a) => a.id === "reconnect"));
});

test("P069-T03 a11y unknown fallback support snapshot", () => {
  const unknown = errors.resolveError({ code: "totally-new", correlationId: "corr_x", raw: "Error: ENOENT /secret/path userid 99" });
  assert.equal(unknown.code, "unknown");
  assert.doesNotMatch(JSON.stringify(unknown), /secret|userid 99|ENOENT/i);
  assert.equal(unknown.a11y.live, "assertive");
  assert.ok(unknown.a11y.focusTarget);

  const snapshots = errors.snapshotAllErrors();
  assert.ok(snapshots.length === errors.listErrorCatalog().length);
  assert.ok(snapshots.every((s) => s.correlationIdPlaceholder));

  assert.match(doc, /correlation/i);
  assert.match(doc, /uncertain/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./error-recovery"], "./error-recovery/index.js");
});
