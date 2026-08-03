"use strict";

const fs = require("node:fs");
const path = require("node:path");

const NODE_MODULES = "node_modules/";

function packageNameFromKey(key) {
  const index = key.lastIndexOf(NODE_MODULES);
  return index === -1 ? key : key.slice(index + NODE_MODULES.length);
}

function readManifest(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function licenseOf(manifest, { optional = false } = {}) {
  if (!manifest) {
    // Platform-specific optional binaries are absent on the current OS; their terms are checked on
    // the platform that actually installs them.
    return optional ? "NOT-INSTALLED" : "UNKNOWN";
  }
  if (typeof manifest.license === "string" && manifest.license.trim()) {
    return manifest.license.trim();
  }
  if (manifest.license && typeof manifest.license.type === "string") {
    return manifest.license.type;
  }
  if (manifest.private) {
    return "UNLICENSED";
  }
  return "UNKNOWN";
}

function buildSbom({ root, timestamp = new Date().toISOString(), commit = "unknown" }) {
  const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  const rootPkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const components = [];

  for (const [key, entry] of Object.entries(lock.packages || {})) {
    if (key === "" || entry.link) {
      continue;
    }
    const isWorkspace = !key.includes(NODE_MODULES);
    const manifest = readManifest(path.join(root, key, "package.json"));
    const name = isWorkspace ? manifest?.name || key : packageNameFromKey(key);
    const version = entry.version || manifest?.version || "0.0.0";
    const properties = [
      { name: "moss:origin", value: isWorkspace ? "workspace" : "registry" },
      { name: "moss:path", value: key },
      { name: "moss:dev", value: String(Boolean(entry.dev)) },
      { name: "moss:optional", value: String(Boolean(entry.optional)) },
    ];
    if (entry.integrity) {
      properties.push({ name: "moss:integrity", value: entry.integrity });
    }
    components.push({
      type: isWorkspace ? "application" : "library",
      "bom-ref": `${name}@${version}`,
      name,
      version,
      scope: entry.optional ? "optional" : "required",
      purl: `pkg:npm/${name}@${version}`,
      licenses: [{ license: { id: licenseOf(manifest, { optional: Boolean(entry.optional) }) } }],
      properties,
    });
  }

  components.sort((a, b) => a["bom-ref"].localeCompare(b["bom-ref"]));

  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: {
      timestamp,
      component: {
        type: "application",
        name: rootPkg.name,
        version: rootPkg.version,
        "bom-ref": `${rootPkg.name}@${rootPkg.version}`,
      },
      properties: [{ name: "moss:commit", value: commit }],
      tools: [{ vendor: "Matrix-AE", name: "scripts/release/sbom.js", version: "1" }],
    },
    components,
  };
}

module.exports = { buildSbom, licenseOf };
