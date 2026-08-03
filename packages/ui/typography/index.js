"use strict";

/**
 * Typography system for compact extension surfaces (Prompt 028).
 * Fonts are local system stacks only — no remote @font-face, no CDN.
 */

const TYPO_VERSION = 1;

/** Local-only stacks. Never load remote webfonts in the extension. */
const FONT_STACKS = Object.freeze({
  ui: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, "Cascadia Code", "Segoe UI Mono", Consolas, "Liberation Mono", Menlo, monospace',
});

/**
 * Content roles used across popup/workspace/settings.
 * Display sizes stay modest — oversized marketing type is banned on extension surfaces.
 */
const TYPE_ROLES = Object.freeze({
  title: Object.freeze({
    font: "ui",
    sizePx: 16,
    weight: 600,
    lineHeight: 1.35,
    letterSpacing: "0",
    truncate: "end",
    maxLines: 2,
  }),
  subtitle: Object.freeze({
    font: "ui",
    sizePx: 14,
    weight: 600,
    lineHeight: 1.4,
    letterSpacing: "0",
    truncate: "end",
    maxLines: 2,
  }),
  body: Object.freeze({
    font: "ui",
    sizePx: 14,
    weight: 400,
    lineHeight: 1.5,
    letterSpacing: "0",
    truncate: null,
    maxLines: null,
  }),
  helper: Object.freeze({
    font: "ui",
    sizePx: 12,
    weight: 400,
    lineHeight: 1.45,
    letterSpacing: "0",
    truncate: null,
    maxLines: null,
  }),
  label: Object.freeze({
    font: "ui",
    sizePx: 12,
    weight: 600,
    lineHeight: 1.3,
    letterSpacing: "0.01em",
    truncate: "end",
    maxLines: 1,
  }),
  caption: Object.freeze({
    font: "ui",
    sizePx: 11,
    weight: 400,
    lineHeight: 1.35,
    letterSpacing: "0.01em",
    truncate: "end",
    maxLines: 1,
  }),
  code: Object.freeze({
    font: "mono",
    sizePx: 12,
    weight: 400,
    lineHeight: 1.45,
    letterSpacing: "0",
    truncate: "middle",
    maxLines: 1,
  }),
  numeric: Object.freeze({
    font: "ui",
    sizePx: 13,
    weight: 500,
    lineHeight: 1.3,
    letterSpacing: "0",
    truncate: null,
    maxLines: 1,
    fontVariantNumeric: "tabular-nums",
  }),
  warning: Object.freeze({
    font: "ui",
    sizePx: 13,
    weight: 500,
    lineHeight: 1.45,
    letterSpacing: "0",
    truncate: null,
    maxLines: null,
  }),
  action: Object.freeze({
    font: "ui",
    sizePx: 14,
    weight: 600,
    lineHeight: 1.2,
    letterSpacing: "0",
    truncate: "end",
    maxLines: 1,
  }),
});

const MAX_DISPLAY_SIZE_PX = 18;

const FORBIDDEN_FONT_PATTERNS = Object.freeze([
  /fonts\.googleapis/i,
  /fonts\.gstatic/i,
  /use\.typekit/i,
  /cdn\.fonts/i,
  /@import\s+url\s*\(/i,
  /src:\s*url\(\s*["']https?:/i,
]);

function roleCss(roleName) {
  const role = TYPE_ROLES[roleName];
  if (!role) {
    throw new Error(`Unknown type role: ${roleName}`);
  }
  const stack = FONT_STACKS[role.font];
  const rules = {
    "font-family": stack,
    "font-size": `${role.sizePx}px`,
    "font-weight": String(role.weight),
    "line-height": String(role.lineHeight),
    "letter-spacing": role.letterSpacing,
  };
  if (role.fontVariantNumeric) {
    rules["font-variant-numeric"] = role.fontVariantNumeric;
  }
  if (role.truncate === "end" && role.maxLines === 1) {
    rules.overflow = "hidden";
    rules["text-overflow"] = "ellipsis";
    rules["white-space"] = "nowrap";
  } else if (role.truncate === "end" && role.maxLines > 1) {
    rules.overflow = "hidden";
    rules.display = "-webkit-box";
    rules["-webkit-line-clamp"] = String(role.maxLines);
    rules["-webkit-box-orient"] = "vertical";
  } else if (role.truncate === "middle") {
    rules.overflow = "hidden";
    rules["text-overflow"] = "ellipsis";
    rules["white-space"] = "nowrap";
    rules.direction = "rtl";
    rules["text-align"] = "left";
  }
  return rules;
}

function toTypographyCss() {
  const lines = [
    `/* @moss/ui typography v${TYPO_VERSION} — local system stacks only */`,
    `:root {`,
    `  --font-ui: ${FONT_STACKS.ui};`,
    `  --font-mono: ${FONT_STACKS.mono};`,
    `}`,
  ];
  for (const name of Object.keys(TYPE_ROLES)) {
    const rules = roleCss(name);
    lines.push(`.type-${name} {`);
    for (const [prop, value] of Object.entries(rules)) {
      lines.push(`  ${prop}: ${value};`);
    }
    lines.push(`}`);
  }
  return `${lines.join("\n")}\n`;
}

function validateTypography() {
  const errors = [];
  for (const [name, role] of Object.entries(TYPE_ROLES)) {
    if (!FONT_STACKS[role.font]) {
      errors.push(`${name}: unknown font stack ${role.font}`);
    }
    if (role.sizePx > MAX_DISPLAY_SIZE_PX) {
      errors.push(`${name}: size ${role.sizePx}px exceeds max display ${MAX_DISPLAY_SIZE_PX}px`);
    }
    if (role.sizePx < 11) {
      errors.push(`${name}: size ${role.sizePx}px below minimum readable 11px`);
    }
    if (role.lineHeight < 1.2) {
      errors.push(`${name}: line-height too tight`);
    }
  }
  const css = toTypographyCss();
  for (const pattern of FORBIDDEN_FONT_PATTERNS) {
    if (pattern.test(css)) {
      errors.push(`typography CSS matches forbidden remote font pattern ${pattern}`);
    }
  }
  // Stress strings must remain defined for specimen clipping checks.
  if (Object.keys(TYPE_ROLES).length < 8) {
    errors.push("expected at least 8 content roles");
  }
  return { ok: errors.length === 0, errors };
}

/** Localization stress samples used by specimens and clipping tests. */
const STRESS_STRINGS = Object.freeze({
  title: "Vergleichsauftrag für Programmierabgaben prüfen und fortsetzen",
  filename: "estudiante_proyecto_final_versión_2_revisión_última.cpp",
  helper: "Los archivos aún no se han cargado. Revise los grupos antes de continuar.",
  numeric: "1,234 / 40",
  action: "Continuar al pago",
});

module.exports = {
  TYPO_VERSION,
  FONT_STACKS,
  TYPE_ROLES,
  MAX_DISPLAY_SIZE_PX,
  FORBIDDEN_FONT_PATTERNS,
  STRESS_STRINGS,
  roleCss,
  toTypographyCss,
  validateTypography,
};
