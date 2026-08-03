"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const docPath = path.join(repositoryRoot, "docs", "privacy", "data-flow.md");
const doc = fs.readFileSync(docPath, "utf8");

test("P007-T01 data-flow doc has required sections in order", () => {
  const headings = [
    "# Privacy Data Inventory and Flow Map",
    "## Document Control",
    "## Data Categories",
    "## Path Coverage Map",
    "## Representative Job Traces",
    "## Minimization and Prohibitions",
    "## Owner Index",
    "## Verification Record",
  ];
  const lines = doc.split(/\r?\n/);
  let last = -1;
  for (const heading of headings) {
    const at = lines.indexOf(heading);
    assert.ok(at >= 0, `missing ${heading}`);
    assert.ok(at > last, `out of order ${heading}`);
    last = at;
  }
});

test("P007-T02 all twelve data categories are unique", () => {
  const ids = [...doc.matchAll(/\| (D-\d{2}) \|/g)].map((m) => m[1]);
  assert.equal(ids.length, 12);
  assert.equal(new Set(ids).size, 12);
  assert.match(doc, /D-06 \| Source code \| Highly sensitive/);
  assert.match(doc, /D-07 \| Provider credentials \| Secret/);
  assert.match(doc, /D-09 \| Result link \| Bearer secret/);
});

test("P007-T03 required processing paths are documented", () => {
  for (const pathId of [
    "### P-LOCAL",
    "### P-EXT",
    "### P-API",
    "### P-STORE",
    "### P-QUEUE",
    "### P-WORKER",
    "### P-PROVIDER",
    "### P-PAY",
    "### P-SUPPORT",
    "### P-OBS",
  ]) {
    assert.match(doc, new RegExp(pathId));
  }
});

test("P007-T04 pair and batch traces cover upload, provider, and forget-link limits", () => {
  assert.match(doc, /### Trace T-PAIR/);
  assert.match(doc, /### Trace T-BATCH/);
  assert.match(doc, /entitlement reserves one of 40 hosted checks/);
  assert.match(doc, /forget-link removes product URL only/);
  assert.match(doc, /Product cannot directly delete provider copies/);
});

test("P007-T05 minimization forbids secrets in analytics and logs", () => {
  assert.match(doc, /forbidden in analytics, ordinary logs/);
  assert.match(doc, /No card data in extension or API databases/);
  assert.match(doc, /No provider secrets in the extension bundle/);
  assert.match(doc, /No raw public TCP commercial submissions/);
  assert.match(doc, /Draft recovery never stores filenames/);
});

test("P007-T06 each category row includes retention-oriented columns in path tables", () => {
  assert.match(doc, /\| Field \| Owner \| Purpose \| Storage \| Encryption \| Retention \| Deletion \/ user control \|/);
  assert.match(doc, /Immediate delete on terminal state; hours-scale lifecycle backstop/);
  assert.match(doc, /chrome\.storage\.local` ≤ 24h/);
});

test("P007-T07 local links resolve and commercial gates are referenced", () => {
  assert.match(doc, /0005a-commercial-permission-go\.md/);
  assert.match(doc, /offer-and-unit-economics\.md/);
  const links = [...doc.matchAll(/\]\((?!https?:|mailto:|#)([^)#]+)(?:#[^)]*)?\)/g)].map((m) => m[1]);
  for (const relative of links) {
    assert.ok(fs.existsSync(path.resolve(path.dirname(docPath), relative)), relative);
  }
});

test("P007-T08 inventory contains no live credentials or result URLs", () => {
  assert.doesNotMatch(doc, /https?:\/\/moss\.stanford\.edu\/results\/[0-9]+/i);
  assert.doesNotMatch(doc, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
  assert.doesNotMatch(doc, /sk_(?:live|test)_[A-Za-z0-9]{16,}/);
  assert.doesNotMatch(doc, /(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}/);
});
