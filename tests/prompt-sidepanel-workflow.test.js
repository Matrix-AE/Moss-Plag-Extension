"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const language = require(path.join(root, "packages/ui/language"));
const settings = require(path.join(root, "packages/ui/settings"));
const workflowPath = path.join(root, "apps/extension/src/shared/workflow/WorkflowApp.tsx");
const workflow = fs.readFileSync(workflowPath, "utf8");
const css = fs.readFileSync(path.join(root, "apps/extension/src/styles/base.css"), "utf8");
const background = fs.readFileSync(
  path.join(root, "apps/extension/src/entrypoints/background.ts"),
  "utf8",
);
const shellDoc = fs.readFileSync(path.join(root, "docs/engineering/extension-shell.md"), "utf8");
const localDoc = fs.readFileSync(path.join(root, "docs/engineering/extension-local-testing.md"), "utf8");

const caps = language.normalizeCapabilities(language.createMossCapabilitiesFixture()).capabilities;

test("P-SP-T01 capability fixture covers every screenshot MOSS language", () => {
  const expected = [
    "c",
    "cc",
    "java",
    "ml",
    "pascal",
    "ada",
    "lisp",
    "scheme",
    "haskell",
    "fortran",
    "ascii",
    "vhdl",
    "perl",
    "matlab",
    "python",
    "mips",
    "prolog",
    "spice",
    "vb",
    "csharp",
    "modula2",
    "a8086",
    "javascript",
    "plsql",
  ];
  assert.deepEqual([...language.MOSS_LANGUAGE_CODES], expected);
  assert.equal(caps.languages.length, expected.length);
  assert.equal(language.validateLanguageModule().ok, true);
});

test("P-SP-T02 M/N/C bounds, file restrictions, derived directory, experimental lockout", () => {
  const { settings: s } = settings.createSettings();
  assert.equal(settings.updateSetting(s, "commonMatchThreshold", 0).ok, false);
  assert.equal(settings.updateSetting(s, "commonMatchThreshold", 10).ok, true);
  assert.equal(settings.updateSetting(s, "resultCount", 1001).ok, false);
  assert.equal(settings.updateSetting(s, "resultCount", 250).ok, true);
  assert.equal(settings.updateSetting(s, "reportLabel", "ok-label").ok, true);
  assert.equal(settings.updateSetting(s, "reportLabel", "bad;").ok, false);
  assert.equal(settings.updateSetting(s, "fileExtensions", [".py"]).ok, true);
  assert.equal(settings.updateSetting(s, "fileExtensions", ["..bad"]).ok, false);
  assert.equal(settings.updateSetting(s, "experimental", true).ok, false);
  assert.equal(settings.updateSetting(s, "directoryMode", "flat").ok, false);
  assert.equal(settings.deriveDirectoryMode({ groups: [{ files: [{}, {}] }] }), "project");
  assert.equal(settings.deriveDirectoryMode({ groups: [{ files: [{}] }] }), "flat");
  assert.match(settings.buildSettingsPanelHtml(s).html, /Experimental server is unavailable/);
});

test("P-SP-T03 masked provider ID never looks like auth and rejects junk", () => {
  const good = settings.maskProviderId("987654321");
  assert.equal(good.ok, true);
  assert.match(good.masked, /\*+4321$/);
  assert.equal(settings.maskProviderId("12").ok, false);
  assert.equal(settings.maskProviderId("abc").ok, false);
  assert.match(workflow, /never authentication|encrypted-vault|Masked on device/i);
  assert.doesNotMatch(workflow, /storage\.sync/);
});

test("P-SP-T04 progressive disclosure, sticky CTA, focus-friendly side panel chrome", () => {
  assert.match(workflow, /Advanced options/);
  assert.match(workflow, /aria-expanded=\{advancedOpen\}/);
  assert.match(workflow, /sticky-cta|sidepanel-footer/);
  assert.match(workflow, /info-tip/);
  assert.match(workflow, /Confirm language/);
  assert.match(css, /shell--sidepanel/);
  assert.match(css, /min-width:\s*360px/);
  assert.match(css, /max-width:\s*600px/);
  assert.match(css, /180ms/);
  assert.match(css, /focus-visible/);
  assert.match(css, /segmented/);
});

test("P-SP-T05 no tab-opening workspace/popup flow; Side Panel behavior is wired", () => {
  assert.match(background, /openPanelOnActionClick:\s*true/);
  assert.doesNotMatch(background, /tabs\.create/);
  assert.match(shellDoc, /`sidePanel`/);
  assert.match(localDoc, /Side Panel|toolbar/i);
  assert.ok(fs.existsSync(path.join(root, "apps/extension/src/entrypoints/sidepanel/index.html")));
  assert.ok(!fs.existsSync(path.join(root, "apps/extension/src/entrypoints/popup/Popup.tsx")));
});
