"use strict";

/**
 * Lightweight inline SVG icon set (Prompt 028).
 * Critical actions must never be icon-only — every icon has an accessible name.
 */

const ICON_VERSION = 1;
const ICON_SIZES = Object.freeze({ sm: 16, md: 20, lg: 24 });

const ICONS = Object.freeze({
  check: Object.freeze({
    label: "Complete",
    path: "M4 12.5 8.5 17 20 5.5",
    stroke: true,
  }),
  warning: Object.freeze({
    label: "Needs attention",
    path: "M12 4 3 20h18L12 4zm0 6v4m0 3h.01",
    stroke: true,
  }),
  error: Object.freeze({
    label: "Failed",
    path: "M6 6l12 12M18 6 6 18",
    stroke: true,
  }),
  info: Object.freeze({
    label: "Information",
    path: "M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
    stroke: true,
  }),
  upload: Object.freeze({
    label: "Upload",
    path: "M12 16V6m0 0 4 4M12 6 8 10M4 18h16",
    stroke: true,
  }),
  folder: Object.freeze({
    label: "Folder",
    path: "M3 7h6l2 2h10v10H3V7z",
    stroke: true,
  }),
  file: Object.freeze({
    label: "File",
    path: "M7 3h7l5 5v13H7V3zm7 0v5h5",
    stroke: true,
  }),
  settings: Object.freeze({
    label: "Settings",
    path: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM4 12h2m12 0h2M6.5 6.5l1.5 1.5m8 8 1.5 1.5M6.5 17.5 8 16m8-8 1.5-1.5",
    stroke: true,
  }),
  external: Object.freeze({
    label: "Open external link",
    path: "M10 5h9v9m0-9L9 15M5 9v10h10",
    stroke: true,
  }),
  copy: Object.freeze({
    label: "Copy",
    path: "M8 8h10v12H8V8zm-3 3V4h10v3",
    stroke: true,
  }),
  close: Object.freeze({
    label: "Close",
    path: "M6 6l12 12M18 6 6 18",
    stroke: true,
  }),
  chevronRight: Object.freeze({
    label: "Next",
    path: "M9 6l6 6-6 6",
    stroke: true,
  }),
});

/** Actions that must include a visible text label — icons alone are forbidden. */
const CRITICAL_ACTIONS = Object.freeze([
  "submit",
  "pay",
  "delete",
  "discard",
  "cancel",
  "retry",
  "connect",
  "upload",
]);

function renderIcon(name, { size = "md", decorative = false } = {}) {
  const icon = ICONS[name];
  if (!icon) {
    throw new Error(`Unknown icon: ${name}`);
  }
  const px = ICON_SIZES[size] || ICON_SIZES.md;
  const aria = decorative
    ? 'aria-hidden="true" focusable="false"'
    : `role="img" aria-label="${icon.label}"`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ${aria}>`,
    `<path d="${icon.path}" />`,
    `</svg>`,
  ].join("");
}

function validateIcons() {
  const errors = [];
  for (const [name, icon] of Object.entries(ICONS)) {
    if (!icon.label || icon.label.length < 2) {
      errors.push(`${name}: accessible label required`);
    }
    if (!icon.path || icon.path.length < 4) {
      errors.push(`${name}: path required`);
    }
    if (/[\u{1F300}-\u{1FAFF}]/u.test(icon.path) || /emoji/i.test(icon.label) === false && false) {
      // placeholder — emoji glyphs are banned as icon sources
    }
  }
  // No emoji codepoints as icon definitions.
  const blob = JSON.stringify(ICONS);
  if (/[\u{1F300}-\u{1FAFF}]/u.test(blob)) {
    errors.push("emoji glyphs are forbidden in the icon set");
  }
  for (const size of Object.values(ICON_SIZES)) {
    if (![16, 20, 24].includes(size)) {
      errors.push(`unexpected icon size ${size}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

function assertLabeledAction(action, { hasIcon = false, hasTextLabel = false } = {}) {
  if (CRITICAL_ACTIONS.includes(action) && hasIcon && !hasTextLabel) {
    return {
      ok: false,
      error: `Critical action "${action}" cannot be icon-only; provide a visible text label.`,
    };
  }
  return { ok: true };
}

module.exports = {
  ICON_VERSION,
  ICON_SIZES,
  ICONS,
  CRITICAL_ACTIONS,
  renderIcon,
  validateIcons,
  assertLabeledAction,
};
