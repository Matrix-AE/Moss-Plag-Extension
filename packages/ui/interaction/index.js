"use strict";

/**
 * Theme, motion, and interaction contracts (Prompt 029).
 * Polish comes from 180–240ms continuity — not ornamental delay.
 */

const INTERACTION_VERSION = 1;

const THEME_MODES = Object.freeze(["system", "light", "dark"]);

const MOTION = Object.freeze({
  duration: Object.freeze({
    instant: 0,
    fast: 120,
    base: 180,
    deliberate: 240,
    /** Anything above this is ornamental and rejected. */
    maxAllowed: 240,
  }),
  easing: Object.freeze({
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
    enter: "cubic-bezier(0, 0, 0.2, 1)",
  }),
  reducedMotion: Object.freeze({
    /** Substitutions when prefers-reduced-motion: reduce */
    durationMs: 0,
    replaceAnimationsWith: "instant-state-change",
    allowOpacityCrossfade: false,
    allowTransform: false,
  }),
});

const INTERACTION_STATES = Object.freeze({
  rest: Object.freeze({ opacity: 1, overlay: "transparent" }),
  hover: Object.freeze({ opacity: 1, overlay: "color-mix(in srgb, currentColor 6%, transparent)" }),
  pressed: Object.freeze({ opacity: 1, overlay: "color-mix(in srgb, currentColor 12%, transparent)" }),
  focus: Object.freeze({
    ringColor: "var(--focus)",
    ringWidth: "var(--border-focus)",
    ringOffset: "2px",
  }),
  disabled: Object.freeze({ opacity: 0.45, pointerEvents: "none" }),
  loading: Object.freeze({
    cursor: "progress",
    ariaBusy: true,
    showSpinner: true,
    /** Never animate status by color alone */
    requiresText: true,
  }),
});

const OVERLAYS = Object.freeze({
  scrim: "color-mix(in srgb, #14161a 45%, transparent)",
  toast: "var(--surface-elevated, var(--surface-muted))",
});

const SKELETON = Object.freeze({
  baseColor: "var(--surface-muted)",
  highlight: "color-mix(in srgb, var(--text-muted) 12%, transparent)",
  radius: "var(--radius-card)",
  /** Reduced motion: static block, no shimmer */
  reducedMotionStyle: "static",
});

const PROGRESS = Object.freeze({
  indeterminate: true,
  /** Never fabricate percentages for provider wait */
  allowDeterminatePercent: false,
  announcePolite: true,
  minVisibleMs: 180,
});

function resolveTheme(preference, systemPrefersDark) {
  if (!THEME_MODES.includes(preference)) {
    return { ok: false, error: `Unknown theme preference: ${preference}` };
  }
  if (preference === "system") {
    return { ok: true, resolved: systemPrefersDark ? "dark" : "light", source: "system" };
  }
  return { ok: true, resolved: preference, source: "user" };
}

function motionFor(reducedMotion) {
  if (reducedMotion) {
    return {
      durationMs: MOTION.reducedMotion.durationMs,
      easing: "linear",
      allowTransform: false,
      allowOpacityCrossfade: false,
      mode: "reduced",
    };
  }
  return {
    durationMs: MOTION.duration.base,
    easing: MOTION.easing.standard,
    allowTransform: true,
    allowOpacityCrossfade: true,
    mode: "full",
  };
}

function toInteractionCss() {
  const lines = [
    `/* @moss/ui interaction tokens v${INTERACTION_VERSION} */`,
    `:root {`,
    `  --motion-fast: ${MOTION.duration.fast}ms;`,
    `  --motion-base: ${MOTION.duration.base}ms;`,
    `  --motion-deliberate: ${MOTION.duration.deliberate}ms;`,
    `  --ease-standard: ${MOTION.easing.standard};`,
    `  --ease-enter: ${MOTION.easing.enter};`,
    `  --ease-exit: ${MOTION.easing.exit};`,
    `  --state-disabled-opacity: ${INTERACTION_STATES.disabled.opacity};`,
    `  --focus-ring-offset: ${INTERACTION_STATES.focus.ringOffset};`,
    `}`,
    `@media (prefers-reduced-motion: reduce) {`,
    `  :root {`,
    `    --motion-fast: 0ms;`,
    `    --motion-base: 0ms;`,
    `    --motion-deliberate: 0ms;`,
    `  }`,
    `  .skeleton { animation: none !important; }`,
    `}`,
    `.is-disabled { opacity: var(--state-disabled-opacity); pointer-events: none; }`,
    `.is-loading { cursor: progress; }`,
    `.focus-ring:focus-visible { outline: var(--border-focus) solid var(--focus); outline-offset: var(--focus-ring-offset); }`,
  ];
  return `${lines.join("\n")}\n`;
}

function validateInteraction() {
  const errors = [];
  for (const [name, ms] of Object.entries(MOTION.duration)) {
    if (name === "maxAllowed") continue;
    if (ms > MOTION.duration.maxAllowed) {
      errors.push(`${name} duration ${ms}ms exceeds ${MOTION.duration.maxAllowed}ms cap`);
    }
  }
  if (INTERACTION_STATES.loading.requiresText !== true) {
    errors.push("loading state must require text; animation alone is not a status signal");
  }
  if (PROGRESS.allowDeterminatePercent === true) {
    errors.push("fabricated determinate percents are forbidden for provider waits");
  }
  for (const mode of THEME_MODES) {
    if (!["system", "light", "dark"].includes(mode)) errors.push(`bad theme ${mode}`);
  }
  const css = toInteractionCss();
  if (!css.includes("prefers-reduced-motion")) {
    errors.push("CSS must respect prefers-reduced-motion");
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  INTERACTION_VERSION,
  THEME_MODES,
  MOTION,
  INTERACTION_STATES,
  OVERLAYS,
  SKELETON,
  PROGRESS,
  resolveTheme,
  motionFor,
  toInteractionCss,
  validateInteraction,
};
