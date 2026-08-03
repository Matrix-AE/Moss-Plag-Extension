"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const adrPath = path.join(
  repositoryRoot,
  "docs",
  "adr",
  "0005b-byo-moss-after-purchase.md",
);
const adr = fs.readFileSync(adrPath, "utf8");

function extractHelpJson() {
  const match = adr.match(
    /<!-- moss-registration-help:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- moss-registration-help:end -->/,
  );
  assert.ok(match, "help JSON block missing");
  return JSON.parse(match[1]);
}

test("P005B-T01 BYO ADR selects customer Moss userid after purchase", () => {
  assert.match(adr, /Accepted decision: \*\*go\*\* with \*\*customer BYO Moss userid\*\*/);
  assert.match(adr, /Customer BYO numeric Moss userid after purchase \| \*\*Selected\*\*/);
  assert.match(adr, /Managed Matrix-AE commercial credentials as default MVP \| Deferred/);
});

test("P005B-T02 registration remains manual and pooling stays forbidden", () => {
  assert.match(adr, /Registration automation \| Forbidden/);
  assert.match(adr, /Shared\/pooled\/rotated accounts \| Permanently forbidden/);
  assert.match(adr, /never an email password/);
  assert.match(adr, /Automating Moss registration email/);
});

test("P005B-T03 help copy is strict JSON with required Moss registration steps", () => {
  const help = extractHelpJson();
  assert.equal(help.schemaVersion, 1);
  assert.equal(help.locale, "en-US");
  assert.equal(help.title, "Register for a Moss account");
  assert.ok(help.steps.includes("registeruser"));
  assert.ok(help.steps.some((step) => step.startsWith("mail ")));
  assert.equal(help.primaryLinkUrl, "https://theory.stanford.edu/~aiken/moss/");
  assert.match(help.officialNotice, /non-commercial use/);
  assert.match(help.officialNotice, /Similix Corporation/);
  assert.ok(help.warnings.some((w) => /not Stanford or Moss/i.test(w)));
  assert.ok(help.warnings.some((w) => /40 hosted checks/.test(w)));
});

test("P005B-T04 encrypted transport requirement is preserved", () => {
  assert.match(adr, /Raw TCP to `moss\.stanford\.edu:7690` remains forbidden/);
  assert.match(adr, /Missing encrypted route ⇒ no-launch/);
});

test("P005B-T05 charter audience boundary remains adults 18\\+", () => {
  assert.match(adr, /adults 18\+/);
  assert.match(adr, /does not expand MVP scope to minors/);
});

test("P005B-T06 ADR contains no live userids or secrets", () => {
  assert.doesNotMatch(adr, /\$userid\s*=\s*[0-9]{6,}/);
  assert.doesNotMatch(adr, /https?:\/\/moss\.stanford\.edu\/results\/[0-9]+/i);
  assert.doesNotMatch(adr, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
  assert.doesNotMatch(adr, /sk_(?:live|test)_[A-Za-z0-9]{16,}/);
});
