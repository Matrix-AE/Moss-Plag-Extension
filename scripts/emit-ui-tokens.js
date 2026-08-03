"use strict";

/**
 * Regenerates packages/ui/tokens/tokens.css from the token model.
 * Lives under scripts/ so packages/ui stays free of node:fs (browser boundary).
 */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const tokens = require(path.join(root, "packages/ui/tokens"));
const out = path.join(root, "packages/ui/tokens/tokens.css");

const css = tokens.toCss();
fs.writeFileSync(out, css, "utf8");

const result = tokens.validateTokens();
if (!result.ok) {
  console.error("Token validation failed", result.schema.errors, result.unusedBrandColors);
  process.exit(1);
}

console.log(
  `Wrote ${path.relative(root, out)} (${css.length} bytes); unused semantic: ${result.unused.unusedSemantic.length}`,
);
