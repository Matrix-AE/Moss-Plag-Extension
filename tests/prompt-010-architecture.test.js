"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const adrPath = path.join(repositoryRoot, "docs", "adr", "0010-product-architecture.md");
const adr = fs.readFileSync(adrPath, "utf8");

test("P010-T01 architecture ADR selects hosted encrypted relay", () => {
  assert.match(adr, /Accepted: \*\*hosted encrypted relay\*\*/);
  assert.match(adr, /\*\*Hosted architecture\*\*/);
  assert.match(adr, /approved encrypted commercial provider route/);
  assert.match(adr, /Secrets remain server-side/);
});

test("P010-T02 topology includes extension API storage queue workers provider payment", () => {
  assert.match(adr, /\[Extension MV3\]/);
  assert.match(adr, /\[API\]/);
  assert.match(adr, /\[Encrypted object storage\]/);
  assert.match(adr, /\[Queue\]/);
  assert.match(adr, /\[Submission worker\]/);
  assert.match(adr, /\[Cleanup worker\]/);
  assert.match(adr, /\[Payment page\/webhooks\]/);
});

test("P010-T03 rejected alternatives include extension TCP and silent local pivot", () => {
  assert.match(adr, /Direct extension TCP to public Moss/);
  assert.match(adr, /Native companion first/);
  assert.match(adr, /Pure local engine \(JPlag\) only/);
  assert.match(adr, /[Ww]ould be a pivot requiring regenerated backlog/);
});

test("P010-T04 ADR wires ADR-0005A economics and failure semantics", () => {
  assert.match(adr, /ADR-0005A/);
  assert.match(adr, /40 checks/);
  assert.match(adr, /no blind retry after send/);
  assert.match(adr, /raw public TCP must fail closed/);
});

test("P010-T05 no secrets and required sections exist", () => {
  for (const heading of [
    "## Context",
    "## Decision",
    "## Component Responsibilities",
    "## Trust, Scaling, Failure",
    "## Consequences",
  ]) {
    assert.match(adr, new RegExp(heading));
  }
  assert.doesNotMatch(adr, /sk_(?:live|test)_/);
  assert.doesNotMatch(adr, /https?:\/\/moss\.stanford\.edu\/results\/[0-9]+/i);
});
