"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const requiredWorkspaces = [
  "apps/extension",
  "apps/api",
  "apps/worker-submit",
  "apps/worker-cleanup",
  "packages/domain",
  "packages/contracts",
  "packages/ui",
  "packages/provider-adapter",
];

for (const relative of requiredWorkspaces) {
  const manifest = path.join(root, relative, "package.json");
  assert.ok(fs.existsSync(manifest), `missing workspace package.json: ${relative}`);
}

assert.deepEqual(pkg.workspaces, ["apps/*", "packages/*"]);
assert.ok(pkg.scripts.test, "root test script required");
assert.ok(pkg.scripts.build, "root build script required");
assert.ok(pkg.scripts.typecheck, "root typecheck script required");
assert.ok(pkg.scripts.lint, "root lint script required");

const extensionPkg = JSON.parse(
  fs.readFileSync(path.join(root, "apps/extension/package.json"), "utf8"),
);
assert.equal(extensionPkg.dependencies["@moss/provider-adapter"], undefined);
assert.ok(extensionPkg.dependencies["@moss/ui"]);
assert.ok(extensionPkg.dependencies["@moss/domain"]);

const uiSource = fs.readFileSync(path.join(root, "packages/ui/index.js"), "utf8");
assert.doesNotMatch(uiSource, /\brequire\(["']node:(net|fs|tls)["']\)/);
assert.doesNotMatch(uiSource, /@moss\/provider-adapter/);

console.log("Workspace graph check passed:", requiredWorkspaces.length, "workspaces");
