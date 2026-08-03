"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const settings = require(path.join(root, "packages/ui/settings"));
const doc = fs.readFileSync(path.join(root, "docs/product/comparison-settings.md"), "utf8");

test("P044-T01 module validation and defaults", () => {
  assert.equal(settings.validateSettingsModule().ok, true);
  assert.equal(settings.createSettings().settings.resultCount, 250);
});

test("P044-T02 bounds, sanitize, reset, serialize", () => {
  const { settings: s } = settings.createSettings();
  assert.equal(settings.updateSetting(s, "resultCount", 0).ok, false);
  assert.equal(settings.updateSetting(s, "resultCount", 1000).ok, true);
  assert.equal(settings.updateSetting(s, "reportLabel", "x;y").ok, false);
  assert.equal(settings.updateSetting(s, "reportLabel", "Lab\u0000").ok, false);
  assert.equal(settings.updateSetting(s, "experimental", true).ok, false);
  assert.equal(settings.updateSetting(s, "directoryMode", "x").ok, false);
  const reset = settings.resetSettings();
  assert.equal(reset.settings.commonMatchThreshold, 10);
  const draft = {
    groups: [{ files: [{}, {}] }, { files: [{}] }],
    settings: s,
  };
  const a = settings.serializeSettings(draft);
  const b = settings.serializeSettings(draft);
  assert.equal(a, b);
  assert.match(a, /"directoryMode":"project"/);
});

test("P044-T03 docs and wiring", () => {
  assert.match(doc, /Directory mode is derived/i);
  assert.match(settings.buildSettingsPanelHtml(settings.DEFAULTS).html, /Experimental mode is disabled/);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./settings"], "./settings/index.js");
  const workspace = fs.readFileSync(
    path.join(root, "apps/extension/src/entrypoints/workspace/Workspace.tsx"),
    "utf8",
  );
  assert.match(workspace, /Comparison settings|settings-panel|resultCount/i);
});
