"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const runtime = require(path.join(root, "scripts/check-node-version.js"));

test("P014-T01 pin files and engines declare Node 22+ and npm", () => {
  assert.equal(fs.readFileSync(path.join(root, ".nvmrc"), "utf8").trim(), "22");
  assert.equal(fs.readFileSync(path.join(root, ".node-version"), "utf8").trim(), "22.0.0");
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.packageManager, "npm@10.9.2");
  assert.equal(pkg.engines.node, ">=22");
  assert.equal(pkg.engines.npm, ">=10");
  assert.match(fs.readFileSync(path.join(root, ".npmrc"), "utf8"), /engine-strict=true/);
});

test("P014-T02 supported Node versions pass the runtime checker", () => {
  assert.equal(runtime.checkRuntime("v22.11.0", "npm/10.9.2 node/v22.11.0").ok, true);
  assert.equal(runtime.checkRuntime("v23.7.0", "npm/10.9.2 node/v23.7.0").ok, true);
});

test("P014-T03 unsupported Node versions fail clearly", () => {
  assert.throws(
    () => runtime.checkRuntime("v18.20.0", "npm/10.9.2 node/v18.20.0"),
    (error) => error.code === "unsupported-node" && /requires Node\.js >= 22/.test(error.message),
  );
  assert.throws(
    () => runtime.checkRuntime("v20.11.0", "npm/10.9.2 node/v20.11.0"),
    (error) => error.code === "unsupported-node",
  );
});

test("P014-T04 non-npm package managers are rejected", () => {
  assert.throws(
    () => runtime.checkRuntime("v22.11.0", "yarn/1.22.19 npm/? node/v22.11.0"),
    (error) => error.code === "unsupported-package-manager",
  );
  assert.throws(
    () => runtime.checkRuntime("v22.11.0", "pnpm/9.0.0 npm/? node/v22.11.0"),
    (error) => error.code === "unsupported-package-manager",
  );
});

test("P014-T05 lockfile policy ignores nested lockfiles", () => {
  const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  assert.match(ignore, /\*\*\/package-lock\.json/);
  assert.match(ignore, /!\/package-lock\.json/);
  assert.match(ignore, /yarn\.lock/);
  assert.match(ignore, /pnpm-lock\.yaml/);
});

test("P014-T06 live runtime check script exits successfully on this machine", () => {
  const result = spawnSync(process.execPath, [path.join(root, "scripts/check-node-version.js")], {
    encoding: "utf8",
    env: { ...process.env, npm_config_user_agent: "npm/10.9.2 node/" + process.version },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Runtime check passed/);
});
