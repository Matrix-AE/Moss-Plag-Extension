"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const docPath = path.join(root, "docs/product/extension-information-architecture.md");
const ia = require(path.join(root, "docs/product/research/ia-prototype/ia-model.js"));

const REQUIRED_SCENARIOS = [
  "first-use",
  "return-draft",
  "free-demo",
  "local-draft",
  "pair",
  "batch",
  "processing",
  "results",
  "failures",
  "accounts",
  "paywall",
  "review",
];

test("P025-T01 IA doc has hierarchy, disclosure, paywall, keyboard, and wireframes", () => {
  const doc = fs.readFileSync(docPath, "utf8");
  for (const heading of [
    "## Hierarchy",
    "## Popup vs workspace",
    "## Progressive disclosure",
    "## Synthetic / local preview",
    "## Final-review → paywall transition",
    "## Keyboard order",
    "## Wireframes",
    "## Requirement → entry → recovery map",
    "## Live walkthrough checklist",
  ]) {
    assert.ok(doc.includes(heading), heading);
  }
  assert.match(doc, /320×520/);
  assert.match(doc, /880×720/);
  assert.match(doc, /never hide privacy|Never icon-only|Ambiguous icons alone are forbidden/i);
  assert.match(doc, /Payment is \*\*never\*\* shown before Review/i);
});

test("P025-T02 every acceptance wireframe scenario exists at target sizes", () => {
  for (const id of REQUIRED_SCENARIOS) {
    assert.ok(ia.SCENARIOS[id], id);
  }
  for (const wf of ia.WIREFRAMES) {
    assert.ok(
      Object.values(ia.SCENARIOS).some((scenario) => scenario.wireframe === wf),
      `unused wireframe ${wf}`,
    );
  }
  const walked = ia.walkChecklist();
  assert.equal(walked.length, Object.keys(ia.SCENARIOS).length);
  for (const item of walked) {
    assert.equal(item.primaryVisible, true, item.id);
    assert.equal(item.paymentOnlyBeforeUpload, true, item.id);
    if (item.surface === "popup") {
      assert.deepEqual(item.size, ia.POPUP_SIZE);
    } else {
      assert.deepEqual(item.size, ia.WORKSPACE_SIZE);
    }
  }
});

test("P025-T03 paywall is reachable only after review consent", () => {
  const session = ia.createSession("review");
  assert.equal(ia.canEnterPaywall(session), false);
  const early = ia.advance(session, "open-paywall-early");
  assert.equal(early.ok, false);
  assert.equal(early.code, "paywall-too-early");

  const blocked = ia.advance(session, "continue-to-payment");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "consent-required");

  const granted = ia.advance(session, "grant-consent");
  assert.equal(granted.ok, true);
  const allowed = ia.advance(granted.session, "continue-to-payment");
  assert.equal(allowed.ok, true);
  assert.equal(allowed.session.step, "paywall");

  const paywall = ia.SCENARIOS.paywall;
  assert.equal(paywall.allowsPayment, true);
  assert.equal(paywall.uploadStarted, false);
  assert.equal(ia.paymentOnlyBeforeUpload(paywall), true);
});

test("P025-T04 every mapped requirement has one entry and recovery path", () => {
  const ids = ia.REQUIREMENT_MAP.map((row) => row.id);
  for (const required of [
    "R-001",
    "R-002",
    "R-006",
    "R-007",
    "R-010",
    "R-014",
    "R-015",
    "US-08",
    "Paywall",
    "Account",
  ]) {
    assert.ok(ids.includes(required), required);
  }
  for (const row of ia.REQUIREMENT_MAP) {
    assert.ok(row.entry && row.recovery && row.wireframe, row.id);
    assert.ok(ia.WIREFRAMES.includes(row.wireframe), row.wireframe);
  }
});

test("P025-T05 facilitator prototype and product wiring exist", () => {
  for (const relative of [
    "docs/product/research/ia-prototype/index.html",
    "docs/product/research/ia-prototype/ia-model.js",
    "docs/product/research/ia-prototype/ia-browser.js",
  ]) {
    assert.ok(fs.existsSync(path.join(root, relative)), relative);
  }
  const html = fs.readFileSync(path.join(root, "docs/product/research/ia-prototype/index.html"), "utf8");
  assert.match(html, /ia-model\.js/);
  assert.match(html, /Continue to payment/);
  assert.match(html, /Try paywall early/);

  const workspace = fs.readFileSync(
    path.join(root, "apps/extension/src/shared/workflow/WorkflowApp.tsx"),
    "utf8",
  );
  assert.match(workspace, /Paywall/);
  assert.match(workspace, /aria-label="Workspace steps"/);
  assert.match(workspace, /Review → Paywall/);
});

test("P025-T06 primary action stays visible and destructive actions stay labeled in copy", () => {
  const doc = fs.readFileSync(docPath, "utf8");
  assert.match(doc, /Primary action always visible|sticky footer|←P/);
  assert.match(doc, /Forget link/);
  assert.match(doc, /Discard/);
  assert.doesNotMatch(doc, /icon-only destructive|trash icon alone/i);

  for (const scenario of Object.values(ia.SCENARIOS)) {
    assert.ok(ia.primaryActionVisible(scenario), scenario.wireframe);
  }
});
