"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const consent = require(path.join(root, "apps/api/legal/consent-copy"));
const review = require(path.join(root, "packages/ui/review"));
const doc = fs.readFileSync(path.join(root, "docs/legal/consent-and-data-rights.md"), "utf8");

test("P078-T01 layered copy links policies and stays unselected by default", () => {
  const copy = consent.getConsentCopy();
  assert.equal(copy.version, "1.1.0");
  assert.equal(copy.ageGate, "18+");
  assert.equal(copy.defaults.ownershipSelected, false);
  assert.equal(copy.defaults.sensitiveLinkSelected, false);
  assert.ok(copy.layers.short);
  assert.ok(copy.layers.detailed);
  assert.match(copy.links.terms, /terms/);
  assert.match(copy.links.privacy, /privacy/);
  assert.ok(copy.dataRights.export);
  assert.ok(copy.dataRights.delete);
});

test("P078-T02 gating reset eligibility version migration evidence without source", () => {
  const gate = consent.evaluateConsentGate({
    ownership: false,
    sensitiveLink: false,
    ageConfirmed: false,
    policyVersion: null,
  });
  assert.equal(gate.ok, false);
  assert.ok(gate.blockers.includes("ownership"));
  assert.ok(gate.blockers.includes("age"));

  const ok = consent.evaluateConsentGate({
    ownership: true,
    sensitiveLink: true,
    ageConfirmed: true,
    policyVersion: "1.1.0",
  });
  assert.equal(ok.ok, true);

  const reset = consent.resetTriggers();
  assert.ok(reset.includes("files-changed"));
  assert.ok(reset.includes("provider-changed"));

  const migrated = consent.migrateConsentVersion({ from: "1.0.0", to: "1.1.0" });
  assert.equal(migrated.requiresReconsent, true);

  const evidence = consent.recordConsentEvidence({
    userId: "u1",
    policyVersion: "1.1.0",
    ownership: true,
    sensitiveLink: true,
    ageConfirmed: true,
  });
  assert.equal(evidence.ok, true);
  assert.equal(evidence.storesSource, false);
});

test("P078-T03 review UI consent remains unchecked and versioned", () => {
  const state = review.createConsentState();
  assert.equal(state.ownership, false);
  assert.equal(state.sensitiveLink, false);
  assert.match(doc, /18\+/);
  assert.match(doc, /bearer/i);
  assert.match(doc, /localized-ready|locale/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./legal/consent-copy"], "./legal/consent-copy.js");
});

test("P078-T04 surfaces share consistent copy keys", () => {
  const surfaces = consent.surfaces();
  assert.ok(surfaces.includes("preview"));
  assert.ok(surfaces.includes("checkout"));
  assert.ok(surfaces.includes("review"));
  assert.ok(surfaces.includes("settings"));
  const html = consent.renderConsentHtml();
  assert.match(html, /type="checkbox"/);
  assert.doesNotMatch(html, /checked/);
  assert.match(html, /1\.1\.0/);
});
