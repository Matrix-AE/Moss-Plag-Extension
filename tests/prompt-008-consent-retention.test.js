"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const docPath = path.join(
  repositoryRoot,
  "docs",
  "privacy",
  "consent-retention-deletion.md",
);
const dataFlowPath = path.join(repositoryRoot, "docs", "privacy", "data-flow.md");
const prototypeModel = require(path.join(
  repositoryRoot,
  "docs",
  "product",
  "research",
  "prototype",
  "prototype-model.js",
));

const doc = fs.readFileSync(docPath, "utf8");
const dataFlow = fs.readFileSync(dataFlowPath, "utf8");

test("P008-T01 consent-retention doc has required sections in order", () => {
  const headings = [
    "# Consent, Retention, and Deletion Requirements",
    "## Document Control",
    "## Consent Requirements",
    "## Retention Schedule",
    "## Deletion and User Controls",
    "## Incident Response Skeleton",
    "## Traceability to UI Copy",
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

test("P008-T02 consent requirements C-01 through C-08 are unique", () => {
  const consentSection = doc.slice(
    doc.indexOf("## Consent Requirements"),
    doc.indexOf("## Retention Schedule"),
  );
  const ids = [...consentSection.matchAll(/^\| (C-\d{2}) \|/gm)].map((m) => m[1]);
  assert.equal(ids.length, 8);
  assert.equal(new Set(ids).size, 8);
  assert.match(doc, /Reset C-02\/C-03 whenever files, groups, language/);
  assert.match(doc, /Do not infer consent from install, purchase/);
  assert.match(doc, /consentPolicyVersion/);
});

test("P008-T03 retention schedule uses shortest viable windows for source and drafts", () => {
  assert.match(doc, /Lifecycle ≤ \*\*24 hours\*\*/);
  assert.match(doc, /Draft shell \(D-04\).*≤ \*\*24 hours\*\*/s);
  assert.match(doc, /Job metadata \(D-08\).*Default \*\*90 days\*\*/s);
  assert.match(doc, /shortest viable window/);
});

test("P008-T04 deletion controls DEL-01 through DEL-08 are unique", () => {
  const ids = [...doc.matchAll(/\| (DEL-\d{2}) \|/g)].map((m) => m[1]);
  assert.equal(ids.length, 8);
  assert.equal(new Set(ids).size, 8);
  assert.match(doc, /Forget saved link/);
  assert.match(doc, /does not revoke provider report/);
  assert.match(doc, /no source bytes/);
});

test("P008-T05 processor caveats refuse over-promising provider deletion", () => {
  assert.match(doc, /product deletion does not guarantee provider deletion/);
  assert.match(doc, /browser history\/sync or clipboard/);
  assert.match(doc, /Availability estimates are not guarantees/);
});

test("P008-T06 conceptual consent gating still blocks unconfirmed submit", () => {
  const state = prototypeModel.createScenario("consent");
  assert.equal(prototypeModel.canSubmit(state), false);
  const attempted = prototypeModel.submit(state);
  assert.match(attempted.notice, /Confirm authority and external processing/);
});

test("P008-T07 requirements link to data-flow source deletion path", () => {
  assert.match(dataFlow, /### P-STORE/);
  assert.match(dataFlow, /Immediate delete on terminal state/);
  assert.match(doc, /Cleanup worker deletes P-STORE objects/);
  assert.match(doc, /data-flow\.md/);
});

test("P008-T08 artifacts contain no secrets and local links resolve", () => {
  assert.doesNotMatch(doc, /https?:\/\/moss\.stanford\.edu\/results\/[0-9]+/i);
  assert.doesNotMatch(doc, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
  const links = [...doc.matchAll(/\]\((?!https?:|mailto:|#)([^)#]+)(?:#[^)]*)?\)/g)].map((m) => m[1]);
  for (const relative of links) {
    assert.ok(fs.existsSync(path.resolve(path.dirname(docPath), relative)), relative);
  }
});
