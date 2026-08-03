"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

test("P016-T01 base config enables strict family flags", () => {
  const base = JSON.parse(fs.readFileSync(path.join(root, "tsconfig.base.json"), "utf8"));
  assert.equal(base.compilerOptions.strict, true);
  assert.equal(base.compilerOptions.noUncheckedIndexedAccess, true);
  assert.equal(base.compilerOptions.exactOptionalPropertyTypes, true);
  assert.equal(base.compilerOptions.declaration, true);
  assert.equal(base.compilerOptions.incremental, true);
});

test("P016-T02 browser and node presets diverge correctly", () => {
  const browser = JSON.parse(fs.readFileSync(path.join(root, "tsconfig.browser.json"), "utf8"));
  const node = JSON.parse(fs.readFileSync(path.join(root, "tsconfig.node.json"), "utf8"));
  assert.ok(browser.compilerOptions.lib.includes("DOM"));
  assert.equal(browser.compilerOptions.moduleResolution, "Bundler");
  assert.equal(node.compilerOptions.moduleResolution, "NodeNext");
  assert.ok(node.compilerOptions.types.includes("node"));
});

test("P016-T03 shared packages extend the correct presets", () => {
  const domain = JSON.parse(fs.readFileSync(path.join(root, "packages/domain/tsconfig.json"), "utf8"));
  const ui = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/tsconfig.json"), "utf8"));
  assert.match(domain.extends, /tsconfig\.node\.json$/);
  assert.match(ui.extends, /tsconfig\.browser\.json$/);
});

test("P016-T04 solution tsconfig references packages", () => {
  const solution = JSON.parse(fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"));
  const paths = solution.references.map((item) => item.path).sort();
  assert.deepEqual(paths, [
    "./packages/contracts",
    "./packages/domain",
    "./packages/provider-adapter",
    "./packages/ui",
  ]);
});

test("P016-T05 root typecheck build succeeds", () => {
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsc", "-b", "--pretty", "false"],
    { cwd: root, encoding: "utf8", shell: true },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("P016-T06 typed sources exist in each shared package", () => {
  for (const file of [
    "packages/domain/types.ts",
    "packages/contracts/version.ts",
    "packages/ui/escapeText.ts",
    "packages/provider-adapter/transport.ts",
  ]) {
    assert.ok(fs.existsSync(path.join(root, file)), file);
  }
});
