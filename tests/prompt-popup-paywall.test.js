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
const entitlementSrc = fs.readFileSync(
  path.join(root, "apps/extension/src/shared/entitlement-demo.ts"),
  "utf8",
);
const css = fs.readFileSync(path.join(root, "apps/extension/src/styles/base.css"), "utf8");
const background = fs.readFileSync(
  path.join(root, "apps/extension/src/entrypoints/background.ts"),
  "utf8",
);
const shellDoc = fs.readFileSync(path.join(root, "docs/engineering/extension-shell.md"), "utf8");
const localDoc = fs.readFileSync(path.join(root, "docs/engineering/extension-local-testing.md"), "utf8");
const changeNote = fs.readFileSync(path.join(root, ".changes/0049-popup-paywall.md"), "utf8");

const caps = language.normalizeCapabilities(language.createMossCapabilitiesFixture()).capabilities;

test("P-POP-T01 capability fixture covers every screenshot MOSS language", () => {
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

test("P-POP-T02 M/N/C bounds, file restrictions, derived directory, experimental lockout", () => {
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

test("P-POP-T03 masked provider ID never looks like auth and rejects junk", () => {
  const good = settings.maskProviderId("987654321");
  assert.equal(good.ok, true);
  assert.match(good.masked, /\*+4321$/);
  assert.equal(settings.maskProviderId("12").ok, false);
  assert.equal(settings.maskProviderId("abc").ok, false);
  assert.match(workflow, /never authentication|local vault|Masked on device|Connected ID/i);
  assert.doesNotMatch(workflow, /storage\.sync/);
});

test("P-POP-T04 progressive disclosure, sticky CTA, focus-friendly popup chrome", () => {
  assert.match(workflow, /Advanced options/);
  assert.match(workflow, /aria-expanded=\{advancedOpen\}/);
  assert.match(workflow, /sticky-cta|popup-footer/);
  assert.match(workflow, /info-tip/);
  assert.match(workflow, /Confirm language/);
  assert.match(css, /shell--popup/);
  assert.match(css, /status-card/);
  assert.match(css, /180ms/);
  assert.match(css, /focus-visible/);
  assert.match(css, /settings-chip/);
});

test("P-POP-T05 popup is primary; Side Panel open-on-action is off; no workspace tabs", () => {
  assert.match(background, /openPanelOnActionClick:\s*false/);
  assert.doesNotMatch(background, /tabs\.create/);
  assert.match(shellDoc, /default_popup|Popup/);
  assert.match(localDoc, /popup/i);
  assert.ok(fs.existsSync(path.join(root, "apps/extension/src/entrypoints/popup/Popup.tsx")));
  assert.ok(!fs.existsSync(path.join(root, "apps/extension/src/entrypoints/sidepanel")));
});

test("P-POP-T06 offer catalog includes free demo, Pair $15/15/2 and Batch $50/50", () => {
  assert.match(entitlementSrc, /priceUsd:\s*15/);
  assert.match(entitlementSrc, /runs:\s*15/);
  assert.match(entitlementSrc, /maxFilesPerRun:\s*2/);
  assert.match(entitlementSrc, /priceUsd:\s*50/);
  assert.match(entitlementSrc, /runs:\s*50/);
  assert.match(entitlementSrc, /id:\s*"trial"|planId.*trial|Free demo/);
  assert.match(entitlementSrc, /Prompt 006|40-check/);
  assert.match(workflow, /\$\{PLANS\.|PLAN_LIST|Unlock Pair|Unlock Batch|\$15|\$50|Start free demo/);
  assert.match(workflow, /claimDeviceTrial|syncLocalStateForAccount/);
  assert.match(workflow, /maxFilesPerRun|multi-file|Folder/);
  assert.match(changeNote, /15 runs|15\/2/);
  assert.match(changeNote, /50/);
  assert.match(changeNote, /40/);
  assert.match(shellDoc, /15.*runs|\$15|Batch.*\$50|50.*runs/i);
});

test("P-POP-T07 auth and paywall gate workflow until entitled", () => {
  assert.match(workflow, /gate === "auth"/);
  assert.match(workflow, /gate === "paywall"/);
  assert.match(workflow, /gate === "moss-id"/);
  assert.match(workflow, /gate === "portal"/);
  assert.match(workflow, /Complete a plan first|Files are not uploaded/);
  assert.match(workflow, /consumeDemoRun|purchaseDemoEntitlement|claimDeviceTrial/);
  assert.match(workflow, /Start Pair Check|Start Batch Check/);
  assert.doesNotMatch(workflow, /sk_live|:7690|createConnection/);
});
