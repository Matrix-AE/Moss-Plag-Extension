"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const privacy = require(path.join(root, "apps/api/legal/privacy"));
const doc = fs.readFileSync(path.join(root, "docs/legal/privacy-policy.md"), "utf8");
const inventory = JSON.parse(
  fs.readFileSync(path.join(root, "docs/legal/data-inventory.json"), "utf8"),
);

test("P077-T01 versioned policy covers purpose basis recipients retention rights", () => {
  const p = privacy.getPrivacyPolicy();
  assert.equal(p.version, "1.0.0");
  assert.ok(p.sections.purposeBasis);
  assert.ok(p.sections.recipients);
  assert.ok(p.sections.transfers);
  assert.ok(p.sections.retention);
  assert.ok(p.sections.safeguards);
  assert.ok(p.sections.choices);
  assert.ok(p.sections.rights);
  assert.ok(p.sections.minors);
  assert.ok(p.sections.subprocessors);
  assert.ok(p.sections.contacts);
});

test("P077-T02 forbids unproven local-only private E2E claims", () => {
  const p = privacy.getPrivacyPolicy();
  assert.equal(p.claims.localOnly, false);
  assert.equal(p.claims.privateReports, false);
  assert.equal(p.claims.providerDeletionGuaranteed, false);
  assert.equal(p.claims.endToEndEncryption, false);
  assert.match(doc, /bearer/i);
  assert.match(doc, /does not guarantee provider deletion/i);
});

test("P077-T03 machine-readable inventory has owners and categories", () => {
  assert.equal(inventory.version, "1.0.0");
  assert.ok(Array.isArray(inventory.categories));
  assert.ok(inventory.categories.length >= 6);
  for (const c of inventory.categories) {
    assert.ok(c.id);
    assert.ok(c.purpose);
    assert.ok(c.owner);
    assert.ok(c.retention);
  }
  assert.ok(Array.isArray(inventory.subprocessors));
  assert.ok(inventory.subprocessors.some((s) => /stripe/i.test(s.name)));
  assert.ok(inventory.changeNotice);
});

test("P077-T04 inventory reconciles with module and docs", () => {
  const fromModule = privacy.getDataInventory();
  assert.equal(fromModule.version, inventory.version);
  assert.equal(fromModule.categories.length, inventory.categories.length);
  assert.match(doc, /Privacy Policy/i);
  assert.match(doc, /minors|18\+/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./legal/privacy"], "./legal/privacy.js");
});
