"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const boundaries = require(path.join(root, "scripts/check-boundaries.js"));

test("P015-T01 boundary rules forbid extension and ui from provider-adapter", () => {
  assert.ok(boundaries.RULES["apps/extension"].forbiddenDeps.includes("@moss/provider-adapter"));
  assert.ok(boundaries.RULES["packages/ui"].forbiddenDeps.includes("@moss/provider-adapter"));
});

test("P015-T02 live workspace graph has zero boundary violations", () => {
  assert.deepEqual(boundaries.checkBoundaries(), []);
});

test("P015-T03 negative fixture contains forbidden imports and is detected", () => {
  boundaries.assertNegativeFixtureRejected();
  const fixture = fs.readFileSync(
    path.join(root, "tests/fixtures/forbidden-imports/extension-imports-provider.js"),
    "utf8",
  );
  assert.match(fixture, /NEGATIVE FIXTURE/);
  assert.match(fixture, /node:net/);
  assert.match(fixture, /@moss\/provider-adapter/);
});

test("P015-T04 boundary checker script exits 0", () => {
  const result = spawnSync(process.execPath, [path.join(root, "scripts/check-boundaries.js")], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Boundary check passed/);
});

test("P015-T05 package export maps exist for shared packages", () => {
  for (const relative of [
    "packages/domain",
    "packages/contracts",
    "packages/ui",
    "packages/provider-adapter",
  ]) {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, relative, "package.json"), "utf8"));
    assert.ok(pkg.exports, relative);
    assert.ok(pkg.exports["."], relative);
  }
});

test("P015-T06 boundaries doc lists ownership table", () => {
  const doc = fs.readFileSync(path.join(root, "docs/engineering/workspace-boundaries.md"), "utf8");
  assert.match(doc, /apps\/extension/);
  assert.match(doc, /packages\/ui/);
  assert.match(doc, /Must not depend on/);
  assert.match(doc, /provider-adapter/);
});
