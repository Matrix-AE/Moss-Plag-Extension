"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const docPath = path.join(
  repositoryRoot,
  "docs",
  "product",
  "nonfunctional-requirements.md",
);
const offer = require(path.join(
  repositoryRoot,
  "docs",
  "product",
  "offer-economics-model.js",
));
const doc = fs.readFileSync(docPath, "utf8");

test("P012-T01 NFR doc has required sections", () => {
  const headings = [
    "# Nonfunctional Requirements and Launch Gates",
    "## SLIs / SLOs (user-visible)",
    "## Limits (launch gates)",
    "## Compatibility",
    "## Accessibility",
    "## Security & privacy",
    "## Support expectations",
    "## Launch-blocking checklist",
  ];
  const lines = doc.split(/\r?\n/);
  let last = -1;
  for (const heading of headings) {
    const at = lines.indexOf(heading);
    assert.ok(at >= 0, `missing ${heading}`);
    assert.ok(at > last, `out of order ${heading}`);
    last = at;
  }
  assert.match(doc, /provisional/);
  assert.match(doc, /Do not promise permanent reports/);
});

test("P012-T02 allowance and devices match Prompt 006 offer", () => {
  assert.equal(offer.OFFER.hostedChecksIncluded, 40);
  assert.equal(offer.OFFER.devices, 2);
  assert.equal(offer.OFFER.hostedOperabilityMonths, 36);
  assert.match(doc, /\*\*40\*\*/);
  assert.match(doc, /\*\*2\*\*/);
  assert.match(doc, /\*\*36 months\*\*/);
  assert.match(doc, /ADR-0005B BYO Moss userid/);
});

test("P012-T03 limit IDs NFR-L01 through NFR-L10 are unique", () => {
  const ids = [...doc.matchAll(/^\| (NFR-L\d{2}) \|/gm)].map((m) => m[1]);
  assert.equal(ids.length, 10);
  assert.equal(new Set(ids).size, 10);
});

test("P012-T04 accessibility and Chrome matrix are launch-oriented", () => {
  assert.match(doc, /WCAG target \| \*\*2\.2 AA\*\*/);
  assert.match(doc, /Latest 2 stable Chrome major versions/);
  assert.match(doc, /MV3 only/);
});

test("P012-T05 security gates require encryption BYO validation and deletion", () => {
  assert.match(doc, /Encrypted provider transport only/);
  assert.match(doc, /BYO userid numeric validation; no password collection/);
  assert.match(doc, /Source deleted on terminal \+ ≤24h backstop/);
  assert.match(doc, /No D-06\/D-07\/full D-09 in analytics\/logs/);
});

test("P012-T06 each NFR table row includes an evidence or gate signal", () => {
  assert.match(doc, /Evidence/);
  assert.match(doc, /Launch-blocking/);
  assert.match(doc, /Deletion audit/);
  assert.match(doc, /In-product ADR-0005B copy/);
  assert.doesNotMatch(doc, /sk_(?:live|test)_/);
});
