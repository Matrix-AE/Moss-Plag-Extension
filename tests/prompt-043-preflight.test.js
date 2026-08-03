"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const preflight = require(path.join(root, "packages/ui/preflight"));
const doc = fs.readFileSync(path.join(root, "docs/product/preflight-validation.md"), "utf8");

const good = {
  mode: "batch",
  language: "python",
  languageConfirmed: true,
  groups: [
    { id: "g1", label: "A", files: [{ id: "f1", key: "k1", displayName: "a.py", bytes: 10 }] },
    { id: "g2", label: "B", files: [{ id: "f2", key: "k2", displayName: "b.py", bytes: 10 }] },
  ],
  baseFiles: [],
};

test("P043-T01 module validation", () => {
  assert.equal(preflight.validatePreflightModule().ok, true);
});

test("P043-T02 rules, boundaries, unicode/control, duplicate hashes", () => {
  const limits = { ...preflight.DEFAULT_LIMITS, version: 1 };
  assert.equal(preflight.runPreflight(good, { limits }).canProceed, true);
  assert.equal(preflight.runPreflight({ ...good, languageConfirmed: false }, { limits }).canProceed, false);

  const control = preflight.runPreflight(
    {
      ...good,
      groups: [
        { id: "g1", label: "A", files: [{ id: "f1", key: "k1", displayName: "a\u0001.py", bytes: 10 }] },
        good.groups[1],
      ],
    },
    { limits },
  );
  assert.ok(control.errors.some((e) => e.code === "control-name"));

  const edge = preflight.runPreflight(good, { limits: { ...limits, maxFileBytes: 10 } });
  assert.equal(edge.canProceed, true);

  const dup = preflight.runPreflight(good, {
    limits,
    hashes: [
      { hash: "x", name: "a.py" },
      { hash: "x", name: "b.py" },
    ],
  });
  assert.ok(dup.warnings.some((w) => w.code === "duplicate-hash"));
  assert.equal(dup.ok, false);
  const ack = preflight.acknowledgeWarnings(good, dup);
  assert.equal(ack.draft.warningsAcknowledged, true);
  const reset = preflight.materialChangeResets(ack.draft, { ...ack.draft, language: "java" });
  assert.equal(reset.warningsAcknowledged, undefined);
});

test("P043-T03 stale limits, html, wiring", () => {
  assert.equal(preflight.runPreflight(good, { limits: null }).canProceed, false);
  assert.match(preflight.buildPreflightHtml(preflight.runPreflight(good, { limits: preflight.DEFAULT_LIMITS })).html, /Blocking/);
  assert.match(doc, /backend remains authoritative/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./preflight"], "./preflight/index.js");
  const workspace = fs.readFileSync(
    path.join(root, "apps/extension/src/entrypoints/workspace/Workspace.tsx"),
    "utf8",
  );
  assert.match(workspace, /Preflight|preflight/i);
});
