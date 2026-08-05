"use strict";

/**
 * Primitive tokens — raw values only. Components must never reference these directly;
 * they go through semantic tokens (see semantic.js).
 *
 * Color primitives mirror docs/design/brand/brand-model.js PALETTE so contrast work
 * done in Prompt 026 remains the source of truth for hues.
 */

const TOKEN_VERSION = 1;

const COLOR = Object.freeze({
  light: Object.freeze({
    white: "#ffffff",
    gray50: "#f2f4f8",
    gray200: "#d3d8e0",
    gray700: "#525a66",
    gray950: "#14161a",
    blue600: "#2f4fd8",
    blue700: "#0b47c7",
    blue800: "#1f5a8f",
    amber800: "#7a4a05",
    red700: "#96231f",
    green800: "#1c5f3a",
  }),
  dark: Object.freeze({
    gray950: "#15171c",
    gray900: "#1e2128",
    gray700: "#333945",
    gray300: "#aab2be",
    gray50: "#f1f3f6",
    blue300: "#9db6ff",
    blue200: "#b9ccff",
    blue100: "#96c4ee",
    amber300: "#e7b169",
    red300: "#f2a09a",
    green300: "#89d6a8",
    ink: "#10131c",
  }),
});

/**
 * 8-pixel spacing system. Major rhythm steps are multiples of 8.
 * Half-steps (4px) are allowed only for compact popup density and hairline padding.
 */
const SPACE = Object.freeze({
  0: 0,
  "0.5": 4,
  1: 8,
  "1.5": 12,
  2: 16,
  "2.5": 20,
  3: 24,
  4: 32,
  5: 40,
  6: 48,
});

const SIZE = Object.freeze({
  controlSm: 28,
  controlMd: 36,
  controlLg: 44,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  popupWidth: 380,
  workspaceMax: 880,
});

const RADIUS = Object.freeze({
  none: 0,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  pill: 999,
});

const BORDER = Object.freeze({
  hairline: 1,
  focus: 2,
});

const SHADOW = Object.freeze({
  none: "none",
  /** One soft elevation maximum — art direction forbids stacked shadows. */
  elev1: "0 1px 2px rgba(20, 22, 26, 0.08)",
});

const LAYER = Object.freeze({
  base: 0,
  raised: 1,
  overlay: 10,
  modal: 20,
  toast: 30,
});

const DENSITY = Object.freeze({
  compact: Object.freeze({
    padX: SPACE[2],
    padY: SPACE[2],
    gap: SPACE["1.5"],
    control: SIZE.controlSm,
  }),
  comfortable: Object.freeze({
    padX: SPACE[3],
    padY: SPACE[4],
    gap: SPACE["2.5"],
    control: SIZE.controlMd,
  }),
});

function px(n) {
  return `${n}px`;
}

function isMajorSpace(value) {
  return value === 0 || value % 8 === 0;
}

function isAllowedSpace(value) {
  return value === 0 || value % 4 === 0;
}

module.exports = {
  TOKEN_VERSION,
  COLOR,
  SPACE,
  SIZE,
  RADIUS,
  BORDER,
  SHADOW,
  LAYER,
  DENSITY,
  px,
  isMajorSpace,
  isAllowedSpace,
};
