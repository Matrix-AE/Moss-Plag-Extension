"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const goPath = path.join(
  repositoryRoot,
  "docs",
  "adr",
  "0005a-commercial-permission-go.md",
);
const stopPath = path.join(
  repositoryRoot,
  "docs",
  "adr",
  "0005-commercial-permission-and-account-strategy.md",
);

function readUtf8(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  assert.equal(text.includes("\uFFFD"), false);
  assert.ok(text.endsWith("\n"));
  return text;
}

const go = readUtf8(goPath);
const stop = readUtf8(stopPath);

test("P005A-T01 go ADR has required sections in order", () => {
  const headings = [
    "# ADR 0005A — Commercial Permission Go (Owner Attestation)",
    "## Document Control",
    "## Context",
    "## Decision",
    "## Rights Evidence Record",
    "## Encrypted-Transport Decision",
    "## Credential Model Decision",
    "## Limits and Downstream Parameters",
    "## Owners and Sign-Off",
    "## Consequences",
    "## Verification Record",
  ];
  const lines = go.split(/\r?\n/);
  let last = -1;
  for (const heading of headings) {
    const at = lines.indexOf(heading);
    assert.ok(at >= 0, `missing ${heading}`);
    assert.ok(at > last, `out of order ${heading}`);
    last = at;
  }
});

test("P005A-T02 decision is go and supersedes the stop ADR", () => {
  assert.match(go, /Status \| Accepted decision: \*\*go\*\*/);
  assert.match(go, /\*\*Go\*\*/);
  assert.match(go, /Supersedes \| \[`0005-commercial-permission-and-account-strategy\.md`\]/);
  assert.match(stop, /\*\*Superseded\*\* by \[`0005a-commercial-permission-go\.md`\]/);
  assert.match(go, /Prompt 006\+ of the hosted backlog may proceed/);
});

test("P005A-T03 managed credentials historically selected; BYO refinement is separate", () => {
  assert.match(go, /Managed commercial credentials \| \*\*Selected\*\*/);
  assert.match(go, /Shared\/pooled\/rotated free accounts \| Permanently forbidden/);
  assert.match(go, /Registration automation \| Forbidden/);
  assert.match(go, /credential model refined by \[`0005b-byo-moss-after-purchase\.md`\]/);
});

test("P005A-T04 encrypted transport is mandatory and raw TCP is forbidden", () => {
  assert.match(go, /Encrypted authorized endpoint only/);
  assert.match(go, /Public raw TCP.*Forbidden for commercial traffic/s);
  assert.match(go, /Client-selected host\/port \| Forbidden/);
  assert.match(go, /Missing encrypted route at launch \| No-launch/);
});

test("P005A-T05 owner attestation is explicit and contracts stay out of git", () => {
  assert.match(go, /Owner attestation of written commercial permission/);
  assert.match(go, /executed agreement remains outside git/);
  assert.match(go, /do not commit contracts, quotes, credentials/);
});

test("P005A-T06 go ADR contains no secrets or live result URLs", () => {
  assert.doesNotMatch(go, /https?:\/\/moss\.stanford\.edu\/results\/[0-9]+/i);
  assert.doesNotMatch(go, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
  assert.doesNotMatch(go, /(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}/);
  assert.doesNotMatch(go, /sk_(?:live|test)_[A-Za-z0-9]{16,}/);
  const link = path.resolve(path.dirname(goPath), "./0005-commercial-permission-and-account-strategy.md");
  assert.ok(fs.existsSync(link));
});
