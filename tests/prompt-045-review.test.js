"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const review = require(path.join(root, "packages/ui/review"));
const doc = fs.readFileSync(path.join(root, "docs/product/review-consent.md"), "utf8");

const draft = {
  title: "Lab 1",
  mode: "batch",
  language: "python",
  languageConfirmed: true,
  groups: [
    { id: "g1", label: "A", files: [{ id: "f1", key: "k1", displayName: "a.py", bytes: 10 }] },
    { id: "g2", label: "B", files: [{ id: "f2", key: "k2", displayName: "b.py", bytes: 10 }] },
  ],
  baseFiles: [],
};

test("P045-T01 module validation and no pre-checked consent", () => {
  assert.equal(review.validateReviewModule().ok, true);
  const consent = review.createConsentState();
  assert.equal(consent.ownership, false);
  assert.equal(consent.sensitiveLink, false);
});

test("P045-T02 summary, gating, reset, quota", () => {
  const summary = review.buildReviewSummary(draft, { entitlement: { remaining: 2 } });
  assert.equal(summary.terminology, "similarity");
  assert.equal(summary.affiliationClaim, false);
  assert.equal(summary.groups.length, 2);

  let consent = review.createConsentState();
  assert.equal(review.canSubmit(draft, consent).ok, false);
  consent = review.recordConsent(consent, { ownership: true, sensitiveLink: true }).consent;
  assert.equal(review.canSubmit(draft, consent, { entitlement: { remaining: 2 } }).ok, true);
  consent = review.resetConsentAfterMaterialChange(draft, { ...draft, title: "Lab 2" }, consent);
  assert.equal(consent.ownership, false);
  assert.ok(
    review.canSubmit(draft, review.recordConsent(review.createConsentState(), { ownership: true, sensitiveLink: true }).consent, {
      entitlement: { remaining: 0 },
    }).blockers.includes("quota-exhausted"),
  );
});

test("P045-T03 html focus order markers and wiring", () => {
  const html = review.buildReviewHtml(draft, review.createConsentState());
  assert.match(html.html, /disabled/);
  assert.match(html.html, /similarity/);
  assert.doesNotMatch(html.html, /plagiarism verdict/i);
  assert.match(doc, /never pre-checked/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./review"], "./review/index.js");
  const workspace = fs.readFileSync(
    path.join(root, "apps/extension/src/shared/workflow/WorkflowApp.tsx"),
    "utf8",
  );
  assert.match(workspace, /Review consents|Confirm and continue|consent/i);
});
