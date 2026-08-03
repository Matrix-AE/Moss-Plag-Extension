"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { buildSbom } = require("./release/sbom.js");
const { scanLicenses } = require("./release/licenses.js");

const ALLOWED_REGISTRY = "https://registry.npmjs.org/";

function loadAdvisories(root) {
  const file = path.join(root, "release/advisories.json");
  if (!fs.existsSync(file)) {
    return { schemaVersion: 1, blocked: [] };
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function checkDependencies(options = {}) {
  const root = options.root || path.resolve(__dirname, "..");
  const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  const advisories = options.advisories || loadAdvisories(root);
  const violations = [];

  if (Number(lock.lockfileVersion) < 3) {
    violations.push({ code: "lockfile-version", message: `lockfileVersion ${lock.lockfileVersion} < 3` });
  }

  for (const [key, entry] of Object.entries(lock.packages || {})) {
    if (key === "" || entry.link || !key.includes("node_modules/")) {
      continue;
    }
    const name = key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length);
    if (!entry.resolved || !entry.resolved.startsWith(ALLOWED_REGISTRY)) {
      violations.push({ code: "untrusted-source", name, message: `${name} resolved from ${entry.resolved}` });
    }
    if (!entry.integrity) {
      violations.push({ code: "missing-integrity", name, message: `${name} has no integrity hash` });
    }
    const blocked = advisories.blocked?.find(
      (item) => item.name === name && (!item.versions || item.versions.includes(entry.version)),
    );
    if (blocked) {
      violations.push({
        code: "blocked-advisory",
        name,
        message: `${name}@${entry.version} blocked: ${blocked.reason}`,
      });
    }
  }

  const licenses = scanLicenses(buildSbom({ root }));
  for (const violation of licenses.violations) {
    violations.push({
      code: violation.code,
      name: violation.name,
      message: `${violation.name}@${violation.version} license ${violation.license}`,
    });
  }

  return { ok: violations.length === 0, violations };
}

if (require.main === module) {
  const result = checkDependencies();
  if (!result.ok) {
    for (const violation of result.violations) {
      console.error(`[${violation.code}] ${violation.message}`);
    }
    process.exit(1);
  }
  console.log("Dependency policy check passed");
}

module.exports = { ALLOWED_REGISTRY, checkDependencies };
