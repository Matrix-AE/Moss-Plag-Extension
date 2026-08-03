"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const parser = require(path.join(root, "packages/provider-adapter/line-parser"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/line-parser.md"), "utf8");

test("P056-T01 module validation", async () => assert.equal((await parser.validateParserModule()).ok, true));
test("P056-T02 chunks surplus abort", async () => {
  const p = parser.createLineParser();
  p.push(Buffer.from("A\nB"));
  assert.equal((await p.readLine()).line, "A");
  assert.equal(p.getSurplus().toString(), "B");
});
test("P056-T03 docs wiring", () => {
  assert.match(doc, /deadline\/abort/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/provider-adapter/package.json"), "utf8"));
  assert.equal(pkg.exports["./line-parser"], "./line-parser.js");
});
