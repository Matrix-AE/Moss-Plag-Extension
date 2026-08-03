"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const files = require(path.join(root, "packages/ui/file-selection"));
const doc = fs.readFileSync(path.join(root, "docs/design/file-selection.md"), "utf8");

test("P032-T01 classify accepted rejected duplicate base", () => {
  assert.equal(files.validateFileUi().ok, true);
  assert.equal(files.classifyLocalFile({ name: "Main.java", size: 20 }).status, "accepted");
  assert.equal(files.classifyLocalFile({ name: "x.exe", size: 20 }).status, "rejected");
  assert.equal(files.classifyLocalFile({ name: "a.py", size: 0 }).reason, "zero-byte");
  assert.equal(
    files.classifyLocalFile({ name: "a.py", size: 5 }, { existingKeys: ["a.py::5"] }).status,
    "duplicate",
  );
  assert.equal(files.classifyLocalFile({ name: "base.py", size: 5 }, { asBase: true }).status, "base");
});

test("P032-T02 consent gate and sanitization", () => {
  assert.equal(files.assertNoUploadBeforeConsent({ consentGranted: false, attemptUpload: true }).ok, false);
  assert.equal(files.assertNoUploadBeforeConsent({ consentGranted: true, attemptUpload: true }).ok, true);
  assert.equal(files.sanitizeDisplayName("..\\secret\\x.py"), "x.py");
  assert.match(doc, /consent/i);
});

test("P032-T03 package export and row builder", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./file-selection"], "./file-selection/index.js");
  const row = files.buildFileRow({ displayName: "a.py", status: "accepted" });
  assert.match(row.html, /Remove a\.py/);
});
