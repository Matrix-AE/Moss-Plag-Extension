"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

test("P013-T01 root package declares workspaces and quality scripts", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.deepEqual(pkg.workspaces, ["apps/*", "packages/*"]);
  for (const script of ["test", "build", "typecheck", "lint"]) {
    assert.ok(pkg.scripts[script], script);
  }
});

test("P013-T02 required app and package manifests exist", () => {
  for (const relative of [
    "apps/extension",
    "apps/api",
    "apps/worker-submit",
    "apps/worker-cleanup",
    "packages/domain",
    "packages/contracts",
    "packages/ui",
    "packages/provider-adapter",
    "infra",
  ]) {
    assert.ok(fs.existsSync(path.join(root, relative)), relative);
  }
});

test("P013-T03 extension cannot depend on provider-adapter", () => {
  const extensionPkg = JSON.parse(
    fs.readFileSync(path.join(root, "apps/extension/package.json"), "utf8"),
  );
  assert.equal(extensionPkg.dependencies["@moss/provider-adapter"], undefined);
  assert.ok(extensionPkg.dependencies["@moss/domain"]);
  assert.ok(extensionPkg.dependencies["@moss/ui"]);
});

test("P013-T04 provider adapter enforces encrypted transport and numeric userid", () => {
  const adapter = require(path.join(root, "packages/provider-adapter/index.js"));
  assert.equal(
    adapter.assertEncryptedTransport({ transport: "encrypted-allowlisted", host: "provider.example" }),
    true,
  );
  assert.throws(
    () => adapter.assertEncryptedTransport({ transport: "raw-tcp", host: "moss.stanford.edu", port: 7690 }),
    (error) => error.code === "transport-forbidden",
  );
  assert.throws(
    () =>
      adapter.assertEncryptedTransport({
        transport: "encrypted-allowlisted",
        host: "moss.stanford.edu",
        port: 7690,
        allowRawTcp: true,
      }),
    (error) => error.code === "raw-tcp-forbidden",
  );
  assert.equal(adapter.assertNumericUserId("123456"), true);
  assert.throws(() => adapter.assertNumericUserId("abc"), (error) => error.code === "userid-format");
});

test("P013-T05 workspace checker passes", () => {
  const result = spawnSync(process.execPath, [path.join(root, "scripts/check-workspaces.js")], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Workspace graph check passed/);
});

test("P013-T06 monorepo doc links and boundary rules exist", () => {
  const doc = fs.readFileSync(path.join(root, "docs/engineering/monorepo.md"), "utf8");
  assert.match(doc, /must \*\*not\*\* depend on `@moss\/provider-adapter`/);
  assert.match(doc, /provider-adapter\/vendor\//);
  assert.match(doc, /BYO/);
});
