"use strict";

const { COLOR, SPACE, RADIUS, SIZE, BORDER, SHADOW, LAYER, isAllowedSpace } = require("./primitives");
const { SEMANTIC, COLOR_ROLES, resolve } = require("./semantic");
const { COMPONENTS, flattenComponentPaths, listSemanticReferences } = require("./components");

const HEX = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i;

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex) {
  const channels = hexToRgb(hex).map((raw) => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

const CONTRAST_PAIRS = Object.freeze([
  { name: "body text", fg: "color.text", bg: "color.surface", min: 4.5 },
  { name: "muted text", fg: "color.textMuted", bg: "color.surface", min: 4.5 },
  { name: "muted on muted surface", fg: "color.textMuted", bg: "color.surfaceMuted", min: 4.5 },
  { name: "primary button", fg: "color.accentText", bg: "color.accent", min: 4.5 },
  { name: "info", fg: "color.info", bg: "color.surface", min: 4.5 },
  { name: "caution", fg: "color.caution", bg: "color.surface", min: 4.5 },
  { name: "danger", fg: "color.danger", bg: "color.surface", min: 4.5 },
  { name: "success", fg: "color.success", bg: "color.surface", min: 4.5 },
  { name: "focus ring", fg: "color.focus", bg: "color.surface", min: 3 },
  { name: "border", fg: "color.border", bg: "color.surface", min: 1.4 },
]);

function validateSchema() {
  const errors = [];

  for (const theme of ["light", "dark"]) {
    const roles = Object.keys(SEMANTIC[theme].color).sort();
    if (roles.join(",") !== [...COLOR_ROLES].sort().join(",")) {
      errors.push(`${theme} color roles diverge from COLOR_ROLES`);
    }
    for (const role of COLOR_ROLES) {
      const value = SEMANTIC[theme].color[role];
      if (!HEX.test(value)) {
        errors.push(`${theme}.color.${role} is not a hex color: ${value}`);
      }
    }
  }

  for (const [key, value] of Object.entries(SPACE)) {
    if (!isAllowedSpace(value)) {
      errors.push(`space.${key}=${value} is not on the 4px grid (8px system with half-steps)`);
    }
  }

  for (const theme of ["light", "dark"]) {
    for (const [name, hex] of Object.entries(COLOR[theme])) {
      if (!HEX.test(hex)) {
        errors.push(`primitive color.${theme}.${name} invalid: ${hex}`);
      }
    }
  }

  // Component mappings must resolve to semantic leaves in every theme.
  for (const { componentPath, semanticPath } of flattenComponentPaths()) {
    if (semanticPath.includes("#") || /^\d/.test(semanticPath)) {
      errors.push(`${componentPath} uses a literal instead of a semantic path: ${semanticPath}`);
    }
    for (const theme of ["light", "dark"]) {
      const resolved = resolve(theme, semanticPath);
      if (resolved === undefined) {
        errors.push(`${componentPath} → ${semanticPath} unresolved in ${theme}`);
      }
    }
  }

  // Accents stay purposeful: only button.primary.background may use color.accent as a fill.
  const accentFills = flattenComponentPaths().filter(
    (entry) =>
      entry.semanticPath === "color.accent" &&
      /background$/i.test(entry.componentPath),
  );
  if (accentFills.length !== 1 || accentFills[0].componentPath !== "button.primary.background") {
    errors.push(
      `accent fill must be exactly button.primary.background; found ${accentFills
        .map((e) => e.componentPath)
        .join(", ") || "none"}`,
    );
  }

  return { ok: errors.length === 0, errors };
}

function validateContrast() {
  const results = [];
  for (const theme of ["light", "dark"]) {
    for (const pair of CONTRAST_PAIRS) {
      const fg = resolve(theme, pair.fg);
      const bg = resolve(theme, pair.bg);
      const ratio = contrastRatio(fg, bg);
      results.push({
        theme,
        name: pair.name,
        ratio: Math.round(ratio * 100) / 100,
        min: pair.min,
        pass: ratio >= pair.min,
      });
    }
  }
  return { ok: results.every((r) => r.pass), results };
}

function flattenPrimitiveLeaves(node, prefix, out = []) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenPrimitiveLeaves(value, path, out);
    } else {
      out.push({ path, value });
    }
  }
  return out;
}

function collectSemanticPrimitiveRefs() {
  const refs = new Set();
  for (const theme of ["light", "dark"]) {
    const colors = SEMANTIC[theme].color;
    const primitives = COLOR[theme];
    for (const hex of Object.values(colors)) {
      for (const [name, value] of Object.entries(primitives)) {
        if (value === hex) {
          refs.add(`color.${theme}.${name}`);
        }
      }
    }
  }
  // Non-color primitives referenced through SHARED semantic maps.
  for (const [name, value] of Object.entries(SPACE)) {
    for (const sem of Object.values(SEMANTIC.light.space)) {
      if (sem === value) refs.add(`space.${name}`);
    }
  }
  for (const [name, value] of Object.entries(RADIUS)) {
    for (const sem of Object.values(SEMANTIC.light.radius)) {
      if (sem === value) refs.add(`radius.${name}`);
    }
  }
  for (const [name, value] of Object.entries(SIZE)) {
    for (const sem of Object.values(SEMANTIC.light.size)) {
      if (sem === value) refs.add(`size.${name}`);
    }
  }
  for (const [name, value] of Object.entries(BORDER)) {
    for (const sem of Object.values(SEMANTIC.light.border)) {
      if (sem === value) refs.add(`border.${name}`);
    }
  }
  for (const [name, value] of Object.entries(SHADOW)) {
    for (const sem of Object.values(SEMANTIC.light.shadow)) {
      if (sem === value) refs.add(`shadow.${name}`);
    }
  }
  for (const [name, value] of Object.entries(LAYER)) {
    for (const sem of Object.values(SEMANTIC.light.layer)) {
      if (sem === value) refs.add(`layer.${name}`);
    }
  }
  return refs;
}

function reportUnusedTokens() {
  const usedSemantic = new Set(listSemanticReferences());
  const allSemantic = new Set();

  function walk(node, prefix) {
    for (const [key, value] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        // density.* is JS composition — not required on every component.
        if (path === "density" || path.startsWith("density.")) {
          continue;
        }
        walk(value, path);
      } else {
        allSemantic.add(path);
      }
    }
  }
  walk(SEMANTIC.light, "");

  const unusedSemantic = [...allSemantic].filter((path) => !usedSemantic.has(path)).sort();

  const primitiveRefs = collectSemanticPrimitiveRefs();
  const allPrimitives = [
    ...flattenPrimitiveLeaves(COLOR.light, "color.light").map((e) => e.path),
    ...flattenPrimitiveLeaves(COLOR.dark, "color.dark").map((e) => e.path),
    ...Object.keys(SPACE).map((k) => `space.${k}`),
    ...Object.keys(RADIUS).map((k) => `radius.${k}`),
    ...Object.keys(SIZE).map((k) => `size.${k}`),
    ...Object.keys(BORDER).map((k) => `border.${k}`),
    ...Object.keys(SHADOW).map((k) => `shadow.${k}`),
    ...Object.keys(LAYER).map((k) => `layer.${k}`),
  ];
  const unusedPrimitives = allPrimitives.filter((path) => !primitiveRefs.has(path)).sort();

  return {
    unusedSemantic,
    unusedPrimitives,
    usedSemanticCount: usedSemantic.size,
    semanticCount: allSemantic.size,
    // Density and surfaceElevated may be reserved for later surfaces — report but don't fail
    // unless a color/space primitive that feeds brand roles is unused.
  };
}

function validate() {
  const schema = validateSchema();
  const contrast = validateContrast();
  const unused = reportUnusedTokens();
  // Fail on unused primitives that are brand colors — those must stay wired.
  const unusedBrandColors = unused.unusedPrimitives.filter((p) => p.startsWith("color."));
  const ok = schema.ok && contrast.ok && unusedBrandColors.length === 0;
  return { ok, schema, contrast, unused, unusedBrandColors };
}

module.exports = {
  HEX,
  contrastRatio,
  CONTRAST_PAIRS,
  validateSchema,
  validateContrast,
  reportUnusedTokens,
  validate,
  COMPONENTS,
};
