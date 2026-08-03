"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const ingest = require(path.join(root, "apps/api/intake/ingest"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/server-intake.md"), "utf8");

test("P051-T01 module validation", () => assert.equal(ingest.validateIntakeModule().ok, true));
test("P051-T02 traversal absolute bomb symlink binary nested", () => {
  assert.equal(ingest.ingestObjects([{ path: "../x", bytes: 1, content: "a" }]).code, "traversal-or-link");
  assert.equal(ingest.ingestObjects([{ path: "C:/a.py", bytes: 1, content: "a" }]).code, "absolute-or-drive-path");
  assert.equal(ingest.ingestObjects([{ path: "a.py", symlink: true, bytes: 1 }]).code, "symlink-or-link");
  assert.equal(ingest.ingestObjects([{ path: "a.exe", bytes: 1, content: "MZ" }]).code, "binary-rejected");
  assert.equal(ingest.ingestObjects([{ archive: true, compressedBytes: 10, members: [{ path: "x.zip", bytes: 1 }] }]).code, "nested-archive");
});
test("P051-T03 valid zip manifest docs wiring", () => {
  const ok = ingest.ingestObjects([{ archive: true, compressedBytes: 20, members: [
    { path: "a/a.py", bytes: 2, content: "a" }, { path: "b/b.py", bytes: 2, content: "b" },
  ]}], { jobId: "z" });
  assert.equal(ok.ok, true);
  assert.equal(ok.manifest.immutable, true);
  assert.equal(ok.sandbox.deleted, true);
  assert.match(doc, /fail closed/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./intake/ingest"], "./intake/ingest.js");
});
