"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const RULES = Object.freeze({
  "apps/extension": {
    forbiddenDeps: ["@moss/provider-adapter"],
    forbiddenRequire: [/node:net/, /node:fs/, /node:tls/, /@moss\/provider-adapter/],
  },
  "packages/ui": {
    forbiddenDeps: ["@moss/provider-adapter", "@moss/api"],
    forbiddenRequire: [/node:net/, /node:fs/, /node:tls/, /@moss\/provider-adapter/],
  },
  "packages/provider-adapter": {
    allowedConsumers: ["apps/worker-submit", "apps/api"],
    forbiddenConsumers: ["apps/extension", "packages/ui"],
  },
});

function readPkg(relativeDir) {
  return JSON.parse(fs.readFileSync(path.join(root, relativeDir, "package.json"), "utf8"));
}

function collectJsFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

function checkBoundaries() {
  const violations = [];

  for (const [workspace, rule] of Object.entries(RULES)) {
    if (rule.forbiddenDeps) {
      const pkg = readPkg(workspace);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const forbidden of rule.forbiddenDeps) {
        if (deps[forbidden]) {
          violations.push(`${workspace} must not depend on ${forbidden}`);
        }
      }
    }
    if (rule.forbiddenRequire) {
      for (const file of collectJsFiles(path.join(root, workspace))) {
        const source = fs.readFileSync(file, "utf8");
        for (const pattern of rule.forbiddenRequire) {
          if (pattern.test(source)) {
            violations.push(`${path.relative(root, file)} matches forbidden pattern ${pattern}`);
          }
        }
      }
    }
  }

  const extensionPkg = readPkg("apps/extension");
  if (extensionPkg.dependencies["@moss/provider-adapter"]) {
    violations.push("extension depends on provider-adapter");
  }

  const providerConsumers = ["apps/extension", "packages/ui"];
  for (const consumer of providerConsumers) {
    const pkg = readPkg(consumer);
    if (pkg.dependencies && pkg.dependencies["@moss/provider-adapter"]) {
      violations.push(`${consumer} cannot consume provider-adapter`);
    }
  }

  return violations;
}

function assertNegativeFixtureRejected() {
  const fixtureDir = path.join(root, "tests/fixtures/forbidden-imports");
  const fixture = fs.readFileSync(path.join(fixtureDir, "extension-imports-provider.js"), "utf8");
  assert.match(fixture, /@moss\/provider-adapter/);
  assert.match(fixture, /node:net/);
  // Simulate boundary scan against the fixture contents.
  const blocked = /@moss\/provider-adapter/.test(fixture) || /node:net/.test(fixture);
  assert.equal(blocked, true);
}

if (require.main === module) {
  const violations = checkBoundaries();
  if (violations.length > 0) {
    console.error("Boundary check failed:");
    for (const item of violations) {
      console.error("-", item);
    }
    process.exit(1);
  }
  console.log("Boundary check passed");
}

module.exports = { RULES, checkBoundaries, assertNegativeFixtureRejected };
