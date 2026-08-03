"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
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

const research = readUtf8(researchPath);

test("P004-T01 research document has required sections in order", () => {
  const headings = [
    "# Official MOSS Service and Protocol Research",
    "## Document Control",
    "## Primary Sources Consulted",
    "## Verified Service Facts",
    "## Client-Observed Protocol Notes",
    "## Implementation Assumptions (Not Yet Product Truth)",
    "## Policy Risks",
    "## Open Questions Requiring Written Clarification",
    "## Product Implications for Downstream Prompts",
    "## Verification Record",
  ];
  let lastIndex = -1;
  for (const heading of headings) {
    const at = research.indexOf(heading);
    assert.ok(at >= 0, `missing heading: ${heading}`);
    assert.ok(at > lastIndex, `out of order: ${heading}`);
    lastIndex = at;
  }
});

test("P004-T02 evidence labels and no-traffic method are explicit", () => {
  for (const label of ["**Verified**", "**Client-observed**", "**Unverified / inferred**", "**Unknown**"]) {
    assert.match(research, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(research, /no account registration; no MOSS TCP\/submission traffic/);
  assert.match(research, /No-traffic attestation/);
  assert.match(research, /did \*\*not\*\*/);
  assert.match(research, /open a TCP connection to port 7690/);
});

test("P004-T03 primary sources include official page, scripts index, mossnet, and Similix", () => {
  assert.match(research, /https:\/\/theory\.stanford\.edu\/~aiken\/moss\//);
  assert.match(research, /http:\/\/moss\.stanford\.edu\/general\/scripts\.html/);
  assert.match(research, /http:\/\/moss\.stanford\.edu\/general\/scripts\/mossnet/);
  assert.match(research, /https:\/\/www\.similix\.com\//);
  assert.match(research, /Source access date \| 2026-08-03/);
});

test("P004-T04 commercial and quota facts remain launch-blocking gates", () => {
  assert.match(research, /Moss is for non-commercial use/);
  assert.match(research, /contacting Similix Corporation/);
  assert.match(research, /100 submissions per day per user/);
  assert.match(research, /PR-01 \| Launching a paid extension against the public non-commercial service/);
  assert.match(research, /PR-02 \| Using free\/BYO accounts, pooling, or rotation/);
  assert.match(research, /PR-03 \| Sending source over raw TCP without an approved encrypted route/);
});

test("P004-T05 privacy and retention facts match official caveats", () => {
  assert.match(research, /accessible to anyone with the result URL/);
  assert.match(research, /typically deleted after about 14 days/);
  assert.match(research, /may be deleted earlier/);
  assert.match(research, /Similarity scores are not proof of plagiarism/);
  assert.match(research, /PR-04 \| Treating bearer report URLs as private or revocable/);
  assert.match(research, /PR-05 \| Promising 14-day report availability/);
});

test("P004-T06 protocol notes separate client observations from product truth", () => {
  assert.match(research, /moss\.stanford\.edu.*7690/);
  assert.match(research, /raw TCP sockets/);
  assert.match(research, /moss <userid>/);
  assert.match(research, /directory <0\|1>/);
  assert.match(research, /file <id> <lang> <size> <filename>/);
  assert.match(research, /Base files are uploaded with file id `0`/);
  assert.match(research, /not a written Stanford API contract/);
});

test("P004-T07 language registry divergence is recorded", () => {
  assert.match(research, /Language-code registry divergence/);
  assert.match(research, /no `verilog`/);
  assert.match(research, /HCL2/);
  assert.match(research, /configuration-driven/);
});

test("P004-T08 assumptions and open questions are uniquely numbered", () => {
  const assumptions = [...research.matchAll(/\| (A-\d{2}) \|/g)].map((match) => match[1]);
  const questions = [...research.matchAll(/\| (Q-\d{2}) \|/g)].map((match) => match[1]);
  assert.equal(assumptions.length, 6);
  assert.equal(new Set(assumptions).size, 6);
  assert.equal(questions.length, 12);
  assert.equal(new Set(questions).size, 12);
  assert.match(research, /Q-01 \| May a paid browser extension submit/);
  assert.match(research, /Q-06 \| Is TLS/);
});

test("P004-T09 local links resolve and prompt wiring stays gated", () => {
  const links = [...research.matchAll(/\]\((?!https?:|mailto:|#)([^)#]+)(?:#[^)]*)?\)/g)].map(
    (match) => match[1],
  );
  assert.ok(links.length >= 2);
  for (const relative of links) {
    const absolute = path.resolve(path.dirname(researchPath), relative);
    assert.ok(fs.existsSync(absolute), `missing local link: ${relative}`);
    assert.ok(absolute.startsWith(repositoryRoot), `link escapes repository: ${relative}`);
  }
  assert.match(research, /Prompt 005 commercial permission/);
  assert.match(research, /mock provider/);
  assert.doesNotMatch(research, /commercial use is approved/i);
  assert.doesNotMatch(research, /live smoke test passed/i);
});

test("P004-T10 research artifacts contain no live credentials or result URLs", () => {
  assert.doesNotMatch(research, /https?:\/\/moss\.stanford\.edu\/results\/[0-9]+/i);
  assert.doesNotMatch(research, /\$userid\s*=\s*[0-9]{4,}(?!21)/);
  assert.doesNotMatch(research, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
  assert.doesNotMatch(research, /(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}/);
  assert.doesNotMatch(research, /sk_(?:live|test)_[A-Za-z0-9]{16,}/);
  // Placeholder in documentation of the public script is allowed once as the published example.
  assert.equal((research.match(/987654321/g) || []).length, 1);
});
