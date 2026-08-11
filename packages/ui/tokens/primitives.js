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
    gray50: "#edf3fa",
    gray200: "#c7d4e4",
    gray700: "#526176",
    gray950: "#0f172a",
    blue600: "#1d5dbc",
    blue700: "#174d9c",
    blue800: "#215f9f",
    amber800: "#81570f",
    red700: "#a3312c",
    green800: "#1f6a50",
  }),
  dark: Object.freeze({
    gray950: "#0b1220",
    gray900: "#111c2e",
    gray700: "#25324a",
    gray300: "#a7b2c3",
    gray50: "#f5f7fb",
    blue300: "#7eb0ff",
    blue200: "#adcaff",
    blue100: "#9cc9ff",
    amber300: "#e8b86d",
    red300: "#f0a29c",
    green300: "#8bd8b1",
    ink: "#07111f",
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
