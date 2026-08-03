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

// File-level reciprocal terms are acceptable for build tooling that is never distributed.
const DEV_ONLY_LICENSES = ["MPL-2.0", "EPL-2.0", "CDDL-1.0"];

// Reciprocal and source-available terms that would infect a distributed extension bundle.
const DENIED_PATTERNS = [/^A?GPL/i, /^LGPL/i, /^SSPL/i, /^BUSL/i, /^CC-BY-NC/i, /^Elastic/i];

function tokenize(expression) {
  return expression
    .replace(/[()]/g, " ")
    .split(/\s+(?:OR|AND)\s+|\s+/i)
    .map((token) => token.trim())
    .filter((token) => token && !/^(OR|AND|WITH)$/i.test(token));
}

function classify(expression, { devOnly = false } = {}) {
  const tokens = tokenize(expression || "");
  if (!tokens.length) {
    return "unknown";
  }
  if (tokens.some((token) => DENIED_PATTERNS.some((pattern) => pattern.test(token)))) {
    return "denied";
  }
  const allowed = devOnly ? [...ALLOWED_LICENSES, ...DEV_ONLY_LICENSES] : ALLOWED_LICENSES;
  if (tokens.some((token) => allowed.includes(token))) {
    return "allowed";
  }
  return "unknown";
}

function propertyOf(component, name) {
  return component.properties?.find((property) => property.name === name)?.value;
}

function scanLicenses(sbom) {
  const violations = [];
  const unresolved = [];
  for (const component of sbom.components) {
    const origin = propertyOf(component, "moss:origin");
    const devOnly = propertyOf(component, "moss:dev") === "true";
    const optional = propertyOf(component, "moss:optional") === "true";
    const license = component.licenses?.[0]?.license?.id || "UNKNOWN";

    if (origin === "workspace") {
      // Internal private workspaces are never distributed as npm packages.
      if (license !== "UNLICENSED" && classify(license) === "denied") {
        violations.push({ name: component.name, version: component.version, license, code: "denied-license" });
      }
      continue;
    }

    if (license === "NOT-INSTALLED" && optional) {
      // Enforced on the platform that installs the binary; recorded so the gap stays visible.
      unresolved.push({ name: component.name, version: component.version, code: "optional-not-installed" });
      continue;
    }

    const verdict = classify(license, { devOnly });
    if (verdict !== "allowed") {
      violations.push({
        name: component.name,
        version: component.version,
        license,
        code: verdict === "denied" ? "denied-license" : "unknown-license",
      });
    }
  }
  return { ok: violations.length === 0, violations, unresolved };
}

module.exports = { ALLOWED_LICENSES, DENIED_PATTERNS, DEV_ONLY_LICENSES, classify, scanLicenses };
