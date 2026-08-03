"use strict";

const ALLOWED_LICENSES = [
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC0-1.0",
  "ISC",
  "MIT",
  "MIT-0",
  "Unlicense",
];

// Reciprocal and source-available terms that would infect a distributed extension bundle.
const DENIED_PATTERNS = [/^A?GPL/i, /^LGPL/i, /^SSPL/i, /^BUSL/i, /^CC-BY-NC/i, /^Elastic/i];

function tokenize(expression) {
  return expression
    .replace(/[()]/g, " ")
    .split(/\s+(?:OR|AND)\s+|\s+/i)
    .map((token) => token.trim())
    .filter((token) => token && !/^(OR|AND|WITH)$/i.test(token));
}

function classify(expression) {
  const tokens = tokenize(expression || "");
  if (!tokens.length) {
    return "unknown";
  }
  if (tokens.some((token) => DENIED_PATTERNS.some((pattern) => pattern.test(token)))) {
    return "denied";
  }
  if (tokens.some((token) => ALLOWED_LICENSES.includes(token))) {
    return "allowed";
  }
  return "unknown";
}

function scanLicenses(sbom) {
  const violations = [];
  for (const component of sbom.components) {
    const origin = component.properties?.find((p) => p.name === "moss:origin")?.value;
    const license = component.licenses?.[0]?.license?.id || "UNKNOWN";
    if (origin === "workspace") {
      // Internal private workspaces are never distributed as npm packages.
      if (license !== "UNLICENSED" && classify(license) === "denied") {
        violations.push({ name: component.name, version: component.version, license, code: "denied-license" });
      }
      continue;
    }
    const verdict = classify(license);
    if (verdict !== "allowed") {
      violations.push({
        name: component.name,
        version: component.version,
        license,
        code: verdict === "denied" ? "denied-license" : "unknown-license",
      });
    }
  }
  return { ok: violations.length === 0, violations };
}

module.exports = { ALLOWED_LICENSES, DENIED_PATTERNS, classify, scanLicenses };
