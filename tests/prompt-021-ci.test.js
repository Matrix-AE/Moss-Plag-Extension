"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const workflowPath = path.join(root, ".github/workflows/ci.yml");

test("P021-T01 CI workflow exists with read-only permissions", () => {
  const text = fs.readFileSync(workflowPath, "utf8");
  assert.match(text, /permissions:\s*\n\s*contents: read/);
  assert.match(text, /node-version-file: \.nvmrc/);
  assert.match(text, /npm ci/);
  assert.match(text, /npm run typecheck/);
  assert.match(text, /npm test/);
  assert.match(text, /npm run build/);
});

test("P021-T02 CI never configures live Moss credentials", () => {
  const text = fs.readFileSync(workflowPath, "utf8");
  assert.doesNotMatch(text, /MOSS_USER/i);
  assert.doesNotMatch(text, /moss\.stanford\.edu/);
  assert.doesNotMatch(text, /MOSS_LIVE_SMOKE/);
  assert.match(text, /CI: true/);
});

test("P021-T03 CI pins setup actions to a supported major and enables Corepack npm", () => {
  const text = fs.readFileSync(workflowPath, "utf8");
  assert.match(text, /actions\/checkout@v5/);
  assert.match(text, /actions\/setup-node@v5/);
  assert.match(text, /corepack prepare npm@10\.9\.2/);
  // Runner-deprecated Node 20 action majors must not come back.
  assert.doesNotMatch(text, /actions\/(?:checkout|setup-node)@v4/);
});

test("P021-T05 every workflow step maps to a documented local gate", () => {
  const text = fs.readFileSync(workflowPath, "utf8");
  const doc = fs.readFileSync(path.join(root, "docs/engineering/ci.md"), "utf8");
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const scripts = [...text.matchAll(/run: npm run ([a-z:-]+)/g)].map((match) => match[1]);
  assert.ok(scripts.length > 0);
  for (const script of scripts) {
    assert.ok(pkg.scripts[script], `package.json is missing script ${script}`);
  }
  assert.match(doc, /actions\/checkout@v5/);
});

test("P021-T04 CI docs describe branch protection expectation", () => {
  const doc = fs.readFileSync(path.join(root, "docs/engineering/ci.md"), "utf8");
  assert.match(doc, /Branch protection/);
  assert.match(doc, /Live Moss submission forbidden/);
  assert.match(doc, /Quality gates/);
});
