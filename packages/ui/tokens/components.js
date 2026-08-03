"use strict";

/**
 * Component token mappings. Every value is a semantic path (e.g. "color.accent"),
 * never a raw hex or pixel literal. Specimens and extension CSS bind through these.
 *
 * Accent rule: at most one primary accent fill per view (button.primary.background).
 */

const COMPONENTS = Object.freeze({
  shell: Object.freeze({
    background: "color.surface",
    color: "color.text",
    gapCompact: "space.sm",
    gapComfortable: "space.lg",
    padCompact: "space.md",
    padComfortableX: "space.xl",
    padComfortableY: "space.2xl",
    popupWidth: "size.popupWidth",
    workspaceMax: "size.workspaceMax",
  }),
  card: Object.freeze({
    background: "color.surfaceMuted",
    color: "color.text",
    borderColor: "color.border",
    borderWidth: "border.hairline",
    radius: "radius.card",
    padY: "space.sm",
    padX: "space.sm",
    shadow: "shadow.none",
  }),
  button: Object.freeze({
    primary: Object.freeze({
      background: "color.accent",
      color: "color.accentText",
      radius: "radius.control",
      padY: "space.xs",
      padX: "space.sm",
      focusRing: "color.focus",
      focusWidth: "border.focus",
    }),
    secondary: Object.freeze({
      background: "color.surface",
      color: "color.text",
      borderColor: "color.border",
      borderWidth: "border.hairline",
      radius: "radius.control",
      padY: "space.xs",
      padX: "space.sm",
      focusRing: "color.focus",
      focusWidth: "border.focus",
    }),
  }),
  badge: Object.freeze({
    radius: "radius.pill",
    padY: "space.hair",
    padX: "space.xs",
    borderWidth: "border.hairline",
    defaultColor: "color.textMuted",
    defaultBorder: "color.border",
    info: "color.info",
    caution: "color.caution",
    danger: "color.danger",
    success: "color.success",
  }),
  rail: Object.freeze({
    color: "color.textMuted",
    currentColor: "color.text",
    gapX: "space.xs",
    gapY: "space.hair",
  }),
  text: Object.freeze({
    body: "color.text",
    muted: "color.textMuted",
    onAccent: "color.accentText",
  }),
  focus: Object.freeze({
    ring: "color.focus",
    width: "border.focus",
  }),
});

function flattenComponentPaths(node = COMPONENTS, prefix = "") {
  const paths = [];
  for (const [key, value] of Object.entries(node)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      paths.push(...flattenComponentPaths(value, next));
    } else if (typeof value === "string") {
      paths.push({ componentPath: next, semanticPath: value });
    }
  }
  return paths;
}

function listSemanticReferences() {
  return flattenComponentPaths().map((entry) => entry.semanticPath);
}

module.exports = {
  COMPONENTS,
  flattenComponentPaths,
  listSemanticReferences,
};
