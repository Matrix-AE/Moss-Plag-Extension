"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const names = require(path.join(root, "packages/provider-adapter/protocol-names"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/protocol-names.md"), "utf8");

test("P057-T01 module validation", () => assert.equal(names.validateNamesModule().ok, true));
test("P057-T02 collisions controls paths", () => {
  assert.equal(names.sanitizeProtocolName("a\u0000.py").ok, false);
  assert.equal(names.sanitizeProtocolName("C:/Users/x/a.py").ok, false);
  const m = names.buildProtocolManifest({ groups: [
    { id: "g1", files: [{ displayName: "main.py", bytes: 1 }, { displayName: "main.py", bytes: 1 }] },
    { id: "g2", files: [{ displayName: "main.py", bytes: 1 }] },
  ]});
  assert.equal(m.ok, true);
  assert.equal(new Set(m.manifest.files.map((f) => f.protocolName)).size, 3);
});
test("P057-T03 docs wiring", () => {
  assert.match(doc, /Collision-safe/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/provider-adapter/package.json"), "utf8"));
  assert.equal(pkg.exports["./protocol-names"], "./protocol-names.js");
});
