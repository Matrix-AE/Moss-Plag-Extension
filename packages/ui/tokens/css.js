"use strict";

const { TOKEN_VERSION } = require("./primitives");
const { SEMANTIC, COLOR_ROLES, asCssValue } = require("./semantic");

function kebab(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\./g, "-")
    .toLowerCase();
}

function flattenLeaf(obj, prefix, out) {
  for (const [key, value] of Object.entries(obj)) {
    const next = prefix ? `${prefix}-${kebab(key)}` : kebab(key);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenLeaf(value, next, out);
    } else if (typeof value === "number" || typeof value === "string") {
      out.push([next, asCssValue(value)]);
    }
  }
  return out;
}

function themeCustomProperties(theme) {
  const tokens = SEMANTIC[theme];
  const entries = [];
  for (const role of COLOR_ROLES) {
    entries.push([`color-${kebab(role)}`, tokens.color[role]]);
    entries.push([kebab(role), tokens.color[role]]);
  }
  flattenLeaf(tokens.space, "space", entries);
  flattenLeaf(tokens.radius, "radius", entries);
  flattenLeaf(tokens.size, "size", entries);
  flattenLeaf(tokens.border, "border", entries);
  flattenLeaf(tokens.shadow, "shadow", entries);
  flattenLeaf(tokens.layer, "layer", entries);
  return entries;
}

function propertiesBlock(theme, indent = "  ") {
  const lines = [`${indent}color-scheme: ${theme};`];
  for (const [name, value] of themeCustomProperties(theme)) {
    lines.push(`${indent}--${name}: ${value};`);
  }
  return lines.join("\n");
}

/**
 * Emit the versioned CSS custom-property sheet for both themes.
 * Light is the default on :root; dark follows prefers-color-scheme
 * and can be forced with [data-theme="dark"].
 */
function toCss() {
  const header = [
    `/* @moss/ui design tokens v${TOKEN_VERSION} — generated from packages/ui/tokens; do not edit by hand */`,
    `/* Components consume semantic variables only; never hardcode hex in UI CSS. */`,
  ].join("\n");

  const light = `:root,\n[data-theme="light"] {\n${propertiesBlock("light")}\n}`;
  const darkMedia = `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n${propertiesBlock(
    "dark",
    "    ",
  )}\n  }\n}`;
  const darkForced = `[data-theme="dark"] {\n${propertiesBlock("dark")}\n}`;
  return `${header}\n\n${light}\n\n${darkMedia}\n\n${darkForced}\n`;
}

function cssVariableName(semanticPath) {
  const parts = semanticPath.split(".");
  if (parts[0] === "color" && parts.length === 2) {
    return {
      long: `--color-${kebab(parts[1])}`,
      short: `--${kebab(parts[1])}`,
    };
  }
  return { long: `--${parts.map(kebab).join("-")}`, short: null };
}

module.exports = {
  kebab,
  themeCustomProperties,
  toCss,
  cssVariableName,
};
