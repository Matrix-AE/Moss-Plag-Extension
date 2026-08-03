"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const prdPath = path.join(repositoryRoot, "docs", "product", "mvp-prd.md");
const marketScanPath = path.join(
  repositoryRoot,
  "docs",
  "product",
  "research",
  "prompt-003-market-scan.md",
);
const prototypeIndexPath = path.join(
  repositoryRoot,
  "docs",
  "product",
  "research",
  "prototype",
  "index.html",
);
const prototypeModelPath = path.join(
  repositoryRoot,
  "docs",
  "product",
  "research",
  "prototype",
  "prototype-model.js",
);

function readUtf8(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  assert.equal(text.includes("\uFFFD"), false, `replacement char in ${filePath}`);
  assert.ok(text.endsWith("\n"), `missing final newline: ${filePath}`);
  return text;
}

const prd = readUtf8(prdPath);
const marketScan = readUtf8(marketScanPath);
const prototypeIndex = readUtf8(prototypeIndexPath);
const prototypeModel = require(prototypeModelPath);

test("P003-D01 PRD exists with required top-level sections in order", () => {
  const headings = [
    "# MVP Product Requirements Document",
    "## Document Control",
    "## Research Evidence Summary",
    "## MVP Workflows",
    "## Prioritized Requirements",
    "## User Stories",
    "## Edge Cases and Expected Behavior",
    "## Traceable Acceptance Criteria",
    "## Out of Scope (MVP)",
    "## Downstream Traceability",
    "## Verification Record",
  ];
  let lastIndex = -1;
  for (const heading of headings) {
    const index = prd.indexOf(`\n${heading}\n`);
    const alt = heading.startsWith("# ") ? prd.indexOf(`${heading}\n`) : index;
    const found = heading.startsWith("# ") ? prd.startsWith(`${heading}\n`) || alt === 0 : index >= 0;
    assert.ok(found || prd.includes(heading), `missing heading: ${heading}`);
    const at = prd.indexOf(heading);
    assert.ok(at > lastIndex, `out of order: ${heading}`);
    lastIndex = at;
  }
});

test("P003-D02 research evidence table covers market scan, prototype, tests, and live walkthrough", () => {
  for (const evidenceId of ["E-01", "E-02", "E-03", "E-04"]) {
    assert.match(prd, new RegExp(`\\| ${evidenceId} \\|`));
  }
  assert.match(prd, /prompt-003-market-scan\.md/);
  assert.match(prd, /research\/prototype\/index\.html/);
  assert.match(prd, /prompt-003-research-prototype\.test\.js/);
  assert.match(prd, /Live prototype walkthrough/);
});

test("P003-D03 moderated interview metrics remain explicitly unmet", () => {
  assert.match(prd, /remain \*\*open\*\*/);
  assert.match(prd, /M-01–M-09 must stay labeled unmet/);
  assert.match(prd, /Do not mark a charter metric met from team opinion/);
});

test("P003-D04 MVP workflows cover pair, batch, projects, base code, and result delivery", () => {
  for (const workflow of [
    "### W-01 Pair Check",
    "### W-02 Batch Check",
    "### W-03 Multi-file project grouping",
    "### W-04 Optional base code",
    "### W-05 Configuration, progress, and result",
  ]) {
    assert.match(prd, new RegExp(workflow.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(prd, /does not scrape, proxy, rewrite, or permanently archive/);
});

test("P003-D05 prioritized requirements are numbered uniquely with P0/P1/P2", () => {
  const rows = [...prd.matchAll(/\| (R-\d{3}) \| (P[012]) \|/g)];
  assert.equal(rows.length, 20);
  const ids = rows.map((match) => match[1]);
  assert.equal(new Set(ids).size, 20);
  assert.ok(rows.some((match) => match[1] === "R-001" && match[2] === "P0"));
  assert.ok(rows.some((match) => match[1] === "R-018" && match[2] === "P2"));
  assert.match(prd, /R-008 \| P0 \| Return only a validated provider-hosted similarity report link/);
  assert.match(prd, /R-013 \| P0 \| Do not implement account pooling/);
});

test("P003-D06 user stories and edge cases are complete and linked", () => {
  for (let index = 1; index <= 8; index += 1) {
    assert.match(prd, new RegExp(`\\| US-0${index} \\|`));
  }
  for (const edge of [
    "E-EMPTY",
    "E-ONE",
    "E-INVALID",
    "E-MIXED",
    "E-OFFLINE",
    "E-TIMEOUT",
    "E-CONSENT",
    "E-RESULT",
    "E-PRICE",
    "E-FLAT",
  ]) {
    assert.match(prd, new RegExp(`\\| ${edge} \\|`));
  }
});

test("P003-D07 acceptance criteria map to automated and live evidence", () => {
  for (let index = 1; index <= 11; index += 1) {
    const id = `AC-${String(index).padStart(2, "0")}`;
    assert.match(prd, new RegExp(`\\| ${id} \\|`));
  }
  assert.match(prd, /tests\/prompt-003-mvp-prd\.test\.js/);
  assert.match(prd, /tests\/prompt-003-research-prototype\.test\.js/);
});

test("P003-D08 commercial and provider gates remain closed in the PRD", () => {
  assert.match(prd, /Prompt 005 written authorization/);
  assert.match(prd, /Prompt 006 approved offer\/economics/);
  assert.match(prd, /Prompt 004 official service and protocol verification/);
  assert.match(prd, /No checkout, commercial provider traffic/);
  assert.match(prd, /Checkout or .*buy now.* copy before Prompts 005–006/i);
  assert.doesNotMatch(prd, /(?:^|[^.])\bbuy now\b(?![^.]*before Prompts)/im);
  assert.match(prd, /Unlimited\/lifetime hosted processing promises/);
});

test("P003-D09 out-of-scope list preserves charter exclusions", () => {
  for (const phrase of [
    "Report scraping",
    "Internet-wide",
    "AI-generated-code",
    "Minor-authored code",
    "Account pooling",
    "Checkout",
  ]) {
    assert.match(prd, new RegExp(phrase));
  }
});

test("P003-D10 PRD local references resolve inside the repository", () => {
  const links = [...prd.matchAll(/\]\((?!https?:|mailto:|#)([^)#]+)(?:#[^)]*)?\)/g)].map(
    (match) => match[1],
  );
  assert.ok(links.length >= 4);
  for (const relative of links) {
    const absolute = path.resolve(path.dirname(prdPath), relative);
    assert.ok(fs.existsSync(absolute), `missing local link: ${relative}`);
    assert.ok(
      absolute.startsWith(repositoryRoot),
      `link escapes repository: ${relative}`,
    );
  }
});

test("P003-D11 market scan and prototype remain non-commercial and synthetic", () => {
  assert.match(marketScan, /does not validate willingness to pay USD \$15/i);
  assert.match(marketScan, /Account pooling.*is not a commercial strategy/i);
  assert.match(prototypeIndex, /Synthetic data only/);
  assert.match(prototypeIndex, /default-src 'self'/);
  assert.deepEqual(prototypeModel.SCENARIO_IDS, [
    "empty",
    "two-files",
    "twenty-files",
    "two-projects",
    "invalid-input",
    "mixed-language",
    "offline",
    "timeout",
    "consent",
    "pricing",
    "result",
  ]);
});

test("P003-D12 Prompt 003 artifacts contain no live secrets or provider endpoints", () => {
  const sources = [
    prd,
    marketScan,
    prototypeIndex,
    fs.readFileSync(path.join(path.dirname(prototypeIndexPath), "app.js"), "utf8"),
    fs.readFileSync(path.join(path.dirname(prototypeIndexPath), "prototype-model.js"), "utf8"),
  ].join("\n");
  assert.doesNotMatch(sources, /moss\.stanford\.edu/i);
  assert.doesNotMatch(sources, /https?:\/\/moss\.stanford\.edu\/results\/[0-9]+/i);
  assert.doesNotMatch(sources, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
  assert.doesNotMatch(sources, /(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}/);
  assert.doesNotMatch(sources, /sk_(?:live|test)_[A-Za-z0-9]{16,}/);
});
