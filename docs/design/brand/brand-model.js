"use strict";

/**
 * Executable art direction for Prompt 026.
 * Colors are verified with real WCAG contrast math so the mood board cannot drift
 * into inaccessible neon pairings.
 */

const NAMING_PLACEHOLDERS = Object.freeze([
  { placeholder: "Codeprint", rationale: "Suggests a code fingerprint without implying judgement." },
  { placeholder: "Sidebyside", rationale: "Describes comparison plainly; reads friendly and neutral." },
  { placeholder: "Overlap", rationale: "Names the observable phenomenon, not a verdict." },
]);

// Names that would imply institutional endorsement or an accusation.
const FORBIDDEN_NAME_PATTERNS = Object.freeze([
  /moss/i,
  /stanford/i,
  /official/i,
  /certified/i,
  /plagiar/i,
  /cheat/i,
  /caught/i,
  /busted/i,
  /detector/i,
  /police/i,
  /judge/i,
  /verdict/i,
]);

const MOOD = Object.freeze({
  keywords: ["fast", "candid", "modern", "workshop-like", "unfussy"],
  antiKeywords: ["institutional crest", "courtroom", "surveillance", "alarm siren", "casino neon"],
  statement:
    "Feels like a sharp developer tool a friend recommended: quick, plainspoken, and calm about a decision only a human can make.",
});

const SHAPE_LANGUAGE = Object.freeze({
  radius: "10–14px on cards and controls; 999px only for status pills",
  stroke: "1px hairline borders; no heavy outlines or drop-shadow stacks",
  illustration:
    "Abstract offset bars and aligned code rails; no magnifying glasses over people, no red stamps, no handcuffs, no gavel",
  motion: "≤ 180ms transitions on state changes only; no parallax, no confetti on results",
  texture: "Flat surfaces with one soft elevation shadow maximum",
});

const VOICE = Object.freeze({
  principles: [
    "Say what happened, then what the person can do.",
    "Name limits in the same breath as capabilities.",
    "Never imply a person did something wrong.",
  ],
  microcopy: [
    { surface: "popup", text: "No active check. Open the workspace to start." },
    { surface: "workspace", text: "Review these groups before anything leaves this device." },
    { surface: "workspace", text: "Similarity highlights code for human review." },
    { surface: "settings", text: "Connect your own provider account after purchase." },
    { surface: "checkout", text: "One-time purchase. Files have not been uploaded yet." },
    { surface: "results", text: "Treat this report link like a password." },
    { surface: "support", text: "Tell us what you expected and what you saw." },
    { surface: "store", text: "Group code submissions and get a similarity report link." },
  ],
});

// Forbidden in any shipped string: accusation, certainty, or endorsement claims.
const FORBIDDEN_COPY_PATTERNS = Object.freeze([
  /\bplagiarism detect/i,
  /\bcheating detect/i,
  /\bproves?\b.*\b(plagiarism|misconduct|cheating)\b/i,
  /\bguilty\b/i,
  /\bcaught\b/i,
  /\bstolen\b/i,
  /\bverdict\b/i,
  /\bofficial (stanford|moss)\b/i,
  /\bendorsed by\b/i,
  /\b100% (secure|private|accurate)\b/i,
  /\bsecure link\b/i,
  /\bprivate link\b/i,
]);

const PALETTE = Object.freeze({
  light: Object.freeze({
    surface: "#ffffff",
    surfaceMuted: "#edf3fa",
    border: "#c7d4e4",
    text: "#0f172a",
    textMuted: "#526176",
    accent: "#1d5dbc",
    accentText: "#ffffff",
    focus: "#174d9c",
    info: "#215f9f",
    caution: "#81570f",
    danger: "#a3312c",
    success: "#1f6a50",
  }),
  dark: Object.freeze({
    surface: "#0b1220",
    surfaceMuted: "#111c2e",
    border: "#25324a",
    text: "#f5f7fb",
    textMuted: "#a7b2c3",
    accent: "#7eb0ff",
    accentText: "#07111f",
    focus: "#adcaff",
    info: "#9cc9ff",
    caution: "#e8b86d",
    danger: "#f0a29c",
    success: "#8bd8b1",
  }),
});

// Status colors are meaning-bearing, never the only signal.
const STATUS_MEANING = Object.freeze({
  info: "progress and neutral state",
  caution: "needs a decision before continuing",
  danger: "blocked or failed; never an accusation about a person",
  success: "the workflow finished; not a similarity judgement",
});

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

function saturation(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) {
    return 0;
  }
  const lightness = (max + min) / 2;
  return lightness > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

/**
 * Neon here means a channel-blown vivid color (#39ff14, #f0f, #0ff, #ff0): one channel pinned at
 * full and another near zero. Those glow, vibrate against dark surfaces, and strand small text.
 * Pale tints such as #9db6ff share a high HSL saturation but are not neon, so lightness alone
 * cannot be the test.
 */
function isNeon(hex) {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return saturation(hex) >= 0.85 && max >= 250 && min <= 60;
}

const CONTRAST_TARGETS = Object.freeze([
  { name: "body text", fg: "text", bg: "surface", min: 4.5 },
  { name: "muted text", fg: "textMuted", bg: "surface", min: 4.5 },
  { name: "muted text on muted surface", fg: "textMuted", bg: "surfaceMuted", min: 4.5 },
  { name: "primary button label", fg: "accentText", bg: "accent", min: 4.5 },
  { name: "info status", fg: "info", bg: "surface", min: 4.5 },
  { name: "caution status", fg: "caution", bg: "surface", min: 4.5 },
  { name: "danger status", fg: "danger", bg: "surface", min: 4.5 },
  { name: "success status", fg: "success", bg: "surface", min: 4.5 },
  { name: "focus ring", fg: "focus", bg: "surface", min: 3 },
  { name: "border", fg: "border", bg: "surface", min: 1.4 },
]);

function checkContrast(theme) {
  const colors = PALETTE[theme];
  return CONTRAST_TARGETS.map((target) => {
    const ratio = contrastRatio(colors[target.fg], colors[target.bg]);
    return {
      theme,
      name: target.name,
      ratio: Math.round(ratio * 100) / 100,
      min: target.min,
      pass: ratio >= target.min,
    };
  });
}

function checkAllThemes() {
  const results = [...checkContrast("light"), ...checkContrast("dark")];
  return { ok: results.every((entry) => entry.pass), results };
}

function checkNeon() {
  const offenders = [];
  for (const [theme, colors] of Object.entries(PALETTE)) {
    for (const [name, hex] of Object.entries(colors)) {
      if (isNeon(hex)) {
        offenders.push({ theme, name, hex });
      }
    }
  }
  return { ok: offenders.length === 0, offenders };
}

function checkNaming(names = NAMING_PLACEHOLDERS.map((entry) => entry.placeholder)) {
  const offenders = names.filter((name) =>
    FORBIDDEN_NAME_PATTERNS.some((pattern) => pattern.test(name)),
  );
  return { ok: offenders.length === 0, offenders };
}

function checkCopy(strings = VOICE.microcopy.map((entry) => entry.text)) {
  const offenders = [];
  for (const text of strings) {
    for (const pattern of FORBIDDEN_COPY_PATTERNS) {
      if (pattern.test(text)) {
        offenders.push({ text, pattern: String(pattern) });
      }
    }
  }
  return { ok: offenders.length === 0, offenders };
}

const SURFACES = Object.freeze([
  "popup",
  "workspace",
  "settings",
  "checkout",
  "store",
  "support",
]);

function surfaceGuidance() {
  return {
    popup: { density: "compact", accentUse: "one primary button", themeAware: true },
    workspace: { density: "comfortable", accentUse: "primary CTA + active step", themeAware: true },
    settings: { density: "comfortable", accentUse: "one primary button", themeAware: true },
    checkout: { density: "comfortable", accentUse: "price emphasis + primary button", themeAware: true },
    store: { density: "marketing", accentUse: "hero mark + one CTA", themeAware: false },
    support: { density: "comfortable", accentUse: "submit button only", themeAware: true },
  };
}

const api = {
  NAMING_PLACEHOLDERS,
  FORBIDDEN_NAME_PATTERNS,
  FORBIDDEN_COPY_PATTERNS,
  MOOD,
  SHAPE_LANGUAGE,
  VOICE,
  PALETTE,
  STATUS_MEANING,
  CONTRAST_TARGETS,
  SURFACES,
  contrastRatio,
  relativeLuminance,
  saturation,
  isNeon,
  checkContrast,
  checkAllThemes,
  checkNeon,
  checkNaming,
  checkCopy,
  surfaceGuidance,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
}
if (typeof window !== "undefined") {
  window.MossBrand = api;
}
