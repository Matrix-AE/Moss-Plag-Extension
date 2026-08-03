"use strict";

const { COLOR, SPACE, SIZE, RADIUS, BORDER, SHADOW, LAYER, DENSITY, px } = require("./primitives");

/**
 * Semantic tokens map intent → primitives. Themes swap which primitive backs a role;
 * the role name stays stable so components never branch on theme.
 *
 * Naming: {category}.{role} in JS; --{category}-{role} in CSS (kebab-case).
 */

function colorRoles(theme) {
  const c = COLOR[theme];
  if (theme === "light") {
    return Object.freeze({
      surface: c.white,
      surfaceMuted: c.gray50,
      surfaceElevated: c.white,
      border: c.gray200,
      text: c.gray950,
      textMuted: c.gray700,
      accent: c.blue600,
      accentText: c.white,
      focus: c.blue700,
      info: c.blue800,
      caution: c.amber800,
      danger: c.red700,
      success: c.green800,
    });
  }
  return Object.freeze({
    surface: c.gray950,
    surfaceMuted: c.gray900,
    surfaceElevated: c.gray900,
    border: c.gray700,
    text: c.gray50,
    textMuted: c.gray300,
    accent: c.blue300,
    accentText: c.ink,
    focus: c.blue200,
    info: c.blue100,
    caution: c.amber300,
    danger: c.red300,
    success: c.green300,
  });
}

const SPACE_SEMANTIC = Object.freeze({
  none: SPACE[0],
  hair: SPACE["0.5"],
  xs: SPACE[1],
  sm: SPACE["1.5"],
  md: SPACE[2],
  lg: SPACE["2.5"],
  xl: SPACE[3],
  "2xl": SPACE[4],
  "3xl": SPACE[5],
  "4xl": SPACE[6],
});

const RADIUS_SEMANTIC = Object.freeze({
  none: RADIUS.none,
  control: RADIUS.sm,
  card: RADIUS.md,
  panel: RADIUS.lg,
  soft: RADIUS.xl,
  pill: RADIUS.pill,
});

const SIZE_SEMANTIC = Object.freeze({
  controlSm: SIZE.controlSm,
  controlMd: SIZE.controlMd,
  controlLg: SIZE.controlLg,
  iconSm: SIZE.iconSm,
  iconMd: SIZE.iconMd,
  iconLg: SIZE.iconLg,
  popupWidth: SIZE.popupWidth,
  workspaceMax: SIZE.workspaceMax,
});

const BORDER_SEMANTIC = Object.freeze({
  hairline: BORDER.hairline,
  focus: BORDER.focus,
});

const SHADOW_SEMANTIC = Object.freeze({
  none: SHADOW.none,
  elev1: SHADOW.elev1,
});

const LAYER_SEMANTIC = Object.freeze({
  base: LAYER.base,
  raised: LAYER.raised,
  overlay: LAYER.overlay,
  modal: LAYER.modal,
  toast: LAYER.toast,
});

const DENSITY_SEMANTIC = Object.freeze({
  compact: DENSITY.compact,
  comfortable: DENSITY.comfortable,
});

const SHARED = Object.freeze({
  space: SPACE_SEMANTIC,
  radius: RADIUS_SEMANTIC,
  size: SIZE_SEMANTIC,
  border: BORDER_SEMANTIC,
  shadow: SHADOW_SEMANTIC,
  layer: LAYER_SEMANTIC,
  density: DENSITY_SEMANTIC,
});

function themeTokens(theme) {
  return Object.freeze({
    color: colorRoles(theme),
    ...SHARED,
  });
}

const SEMANTIC = Object.freeze({
  light: themeTokens("light"),
  dark: themeTokens("dark"),
});

const COLOR_ROLES = Object.freeze(Object.keys(SEMANTIC.light.color));

function resolve(theme, path) {
  const parts = path.split(".");
  let cursor = SEMANTIC[theme];
  for (const part of parts) {
    if (cursor == null || typeof cursor !== "object") {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

function asCssValue(value) {
  if (typeof value === "number") {
    return px(value);
  }
  return String(value);
}

module.exports = {
  SEMANTIC,
  SHARED,
  COLOR_ROLES,
  colorRoles,
  themeTokens,
  resolve,
  asCssValue,
};
