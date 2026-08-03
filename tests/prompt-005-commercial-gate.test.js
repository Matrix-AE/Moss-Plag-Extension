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
  "0005-commercial-permission-and-account-strategy.md",
);
const researchPath = path.join(
  repositoryRoot,
  "docs",
  "compliance",
  "moss-service-research.md",
);

function readUtf8(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  assert.equal(text.includes("\uFFFD"), false, `replacement char in ${filePath}`);
  assert.ok(text.endsWith("\n"), `missing final newline: ${filePath}`);
  return text;
}

const adr = readUtf8(adrPath);
const research = readUtf8(researchPath);

test("P005-T01 ADR has required sections in order", () => {
  const headings = [
    "# ADR 0005 — Commercial Permission and Account Strategy Gate",
    "## Document Control",
    "## Context",
    "## Decision Drivers",
    "## Options Considered",
    "## Decision",
    "## Rights Evidence",
    "## Encrypted-Transport Decision",
    "## Credential Model Decision",
    "## Limits Decision",
    "## Fallback and Pivot Path",
    "## Owners and Sign-Off",
    "## Consequences",
    "## Verification Record",
  ];
  const lines = adr.split(/\r?\n/);
  let lastIndex = -1;
  for (const heading of headings) {
    const at = lines.indexOf(heading);
    assert.ok(at >= 0, `missing heading: ${heading}`);
    assert.ok(at > lastIndex, `out of order: ${heading}`);
    lastIndex = at;
  }
});

test("P005-T02 historical stop ADR remains recorded and marked superseded", () => {
  assert.match(adr, /Status \| \*\*Superseded\*\* by/);
  assert.match(adr, /\*\*Stop\.\*\*/);
  assert.match(adr, /`stop` ends execution/);
  assert.match(adr, /Historical stop\. Hosted-MOSS backlog may resume only under ADR-0005A/);
  assert.match(adr, /Executing Prompt 006 as if a Moss-hosted unit-economics model were approved/);
  assert.doesNotMatch(adr, /Status \| Accepted decision: \*\*go\*\*/);
});

test("P005-T03 rejected credential models include BYO, managed, and pooling", () => {
  assert.match(adr, /Managed commercial Moss credentials \| Not authorized/);
  assert.match(adr, /Customer BYO public Moss userid in a paid wrapper \| Not authorized/);
  assert.match(adr, /Shared, pooled, or rotated free accounts \| Permanently forbidden/);
  assert.match(adr, /Automating Moss registration email \| Forbidden/);
  assert.match(adr, /Permanently rejected: limit evasion/);
});

test("P005-T04 rights matrix marks required commercial terms missing", () => {
  for (const term of [
    "Paid automation / SaaS / reseller rights",
    "Account / end-user model",
    "TLS / encrypted submission and report transport",
    "SLA and support",
    "Brand / naming permission",
  ]) {
    assert.match(adr, new RegExp(`\\| ${term.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")} \\| \\*\\*Missing`));
  }
  assert.match(adr, /No authorization email reply, contract, quote, or brand permission is stored/);
});

test("P005-T05 encrypted transport remains unapproved and no-launch", () => {
  assert.match(adr, /approved encrypted Moss submission\/report route available today\? \| \*\*No\*\*/);
  assert.match(adr, /accept sensitive source for Moss transfer on raw TCP\? \| \*\*No\*\*/);
  assert.match(adr, /Remain \*\*no-launch\*\*/);
});

test("P005-T06 fallback requires explicit future ADR or regenerated backlog", () => {
  assert.match(adr, /Architecture pivot/);
  assert.match(adr, /regenerate `100-prompts\.md`/);
  assert.match(adr, /Native companion pivot/);
  assert.match(adr, /Adopting either is a pivot, not a silent implementation/);
});

test("P005-T07 owners, review date, and local links are present", () => {
  assert.match(adr, /Review-by date \| 2026-09-03/);
  assert.match(adr, /Product \| Matrix-AE product owner \| Stop/);
  assert.match(adr, /Engineering \| Matrix-AE engineering lead \| Stop/);
  assert.match(adr, /Compliance \/ privacy/);
  assert.match(adr, /Finance \| Matrix-AE finance reviewer \| Stop/);
  const links = [...adr.matchAll(/\]\((?!https?:|mailto:|#)([^)#]+)(?:#[^)]*)?\)/g)].map(
    (match) => match[1],
  );
  assert.ok(links.length >= 3);
  for (const relative of links) {
    const absolute = path.resolve(path.dirname(adrPath), relative);
    assert.ok(fs.existsSync(absolute), `missing local link: ${relative}`);
  }
});

test("P005-T08 ADR stays aligned with Prompt 004 and introduces no secrets", () => {
  assert.match(research, /Moss is for non-commercial use/);
  assert.match(research, /100 submissions per day per user/);
  assert.match(research, /raw TCP sockets/);
  assert.match(adr, /public Moss is explicitly \*\*non-commercial\*\*/);
  assert.match(adr, /100 submissions\/day\/user/);
  assert.match(adr, /raw TCP/);
  assert.doesNotMatch(adr, /https?:\/\/moss\.stanford\.edu\/results\/[0-9]+/i);
  assert.doesNotMatch(adr, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
  assert.doesNotMatch(adr, /(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}/);
  assert.doesNotMatch(adr, /sk_(?:live|test)_[A-Za-z0-9]{16,}/);
});
