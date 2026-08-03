"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

test("P017-T01 editorconfig declares required formatting rules", () => {
  const text = fs.readFileSync(path.join(root, ".editorconfig"), "utf8");
  assert.match(text, /root = true/);
  assert.match(text, /charset = utf-8/);
  assert.match(text, /end_of_line = lf/);
  assert.match(text, /indent_size = 2/);
});

test("P017-T02 package scripts expose format and lint entrypoints", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok(pkg.scripts["format:check"]);
  assert.ok(pkg.scripts.lint);
  assert.ok(pkg.scripts.typecheck);
});

test("P017-T03 format check script passes", () => {
  const result = spawnSync(process.execPath, [path.join(root, "scripts/check-editorconfig.js")], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("P017-T04 quality baseline doc records commit convention", () => {
  const doc = fs.readFileSync(path.join(root, "docs/engineering/quality-baseline.md"), "utf8");
  assert.match(doc, /Commit convention/);
  assert.match(doc, /npm run lint/);
  assert.match(doc, /tsc -b/);
});

test("P017-T05 lint script still enforces boundaries", () => {
  const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "lint"],
    { cwd: root, encoding: "utf8", shell: true },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Boundary check passed/);
});
