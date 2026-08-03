"use strict";

/**
 * Safe comparison settings (Prompt 044).
 * Defaults first; advanced panel is bounded and capability-gated.
 */

const SETTINGS_VERSION = 1;

const DEFAULTS = Object.freeze({
  resultCount: 250,
  commonMatchThreshold: 10,
  reportLabel: "",
  experimental: false,
  directoryMode: "derived",
});

const BOUNDS = Object.freeze({
  resultCount: { min: 1, max: 1000 },
  commonMatchThreshold: { min: 1, max: 1000 },
  reportLabelMax: 80,
});

function createSettings(capabilities = {}) {
  const available = {
    resultCount: capabilities.resultCount !== false,
    commonMatchThreshold: capabilities.commonMatchThreshold !== false,
    reportLabel: capabilities.reportLabel !== false,
    experimental: false,
  };
  return {
    ok: true,
    settings: { ...DEFAULTS },
    available,
    bounds: BOUNDS,
  };
}

function deriveDirectoryMode(draft) {
  // Directory mode is derived from grouping — never a free-form protocol command.
  const multiFile = (draft.groups || []).some((g) => (g.files || []).length > 1);
  return multiFile ? "project" : "flat";
}

function updateSetting(settings, key, value, { capabilities = {} } = {}) {
  const next = { ...settings };
  const created = createSettings(capabilities);
  if (key === "experimental") {
    return { ok: false, error: "experimental-disabled", settings };
  }
  if (key === "directoryMode") {
    return { ok: false, error: "directory-mode-derived", settings };
  }
  if (!created.available[key]) {
    return { ok: false, error: "capability-unavailable", settings };
  }
  if (key === "resultCount" || key === "commonMatchThreshold") {
    const n = Number(value);
    const bound = BOUNDS[key];
    if (!Number.isInteger(n) || n < bound.min || n > bound.max) {
      return { ok: false, error: "out-of-range", settings };
    }
    next[key] = n;
    return { ok: true, settings: next };
  }
  if (key === "reportLabel") {
    const sanitized = sanitizeLabel(value);
    if (sanitized.error) return { ok: false, error: sanitized.error, settings };
    next.reportLabel = sanitized.value;
    return { ok: true, settings: next };
  }
  return { ok: false, error: "unknown-setting", settings };
}

function sanitizeLabel(value) {
  if (value == null) return { value: "" };
  let text = String(value);
  if (/[\u0000-\u001f\u007f]/.test(text)) return { error: "control-chars" };
  if (/[;`|$<>]/.test(text)) return { error: "unsafe-chars" };
  text = text.trim().slice(0, BOUNDS.reportLabelMax);
  return { value: text };
}

function resetSettings(capabilities) {
  return createSettings(capabilities);
}

function serializeSettings(draft) {
  const settings = { ...(draft.settings || DEFAULTS) };
  const directoryMode = deriveDirectoryMode(draft);
  const payload = {
    schemaVersion: SETTINGS_VERSION,
    resultCount: settings.resultCount ?? DEFAULTS.resultCount,
    commonMatchThreshold: settings.commonMatchThreshold ?? DEFAULTS.commonMatchThreshold,
    reportLabel: sanitizeLabel(settings.reportLabel || "").value || undefined,
    experimental: false,
    directoryMode,
  };
  // Deterministic key order
  return JSON.stringify(payload, Object.keys(payload).sort());
}

function validateSettings(settings, capabilities = {}) {
  const errors = [];
  if (!settings) return { ok: false, errors: ["missing"] };
  if (settings.experimental) errors.push("experimental-forbidden");
  if (settings.directoryMode && settings.directoryMode !== "derived" && settings.directoryMode !== "project" && settings.directoryMode !== "flat") {
    errors.push("bad-directory-mode");
  }
  for (const key of ["resultCount", "commonMatchThreshold"]) {
    const bound = BOUNDS[key];
    const n = settings[key];
    if (n != null && (!Number.isInteger(n) || n < bound.min || n > bound.max)) {
      errors.push(`${key}-out-of-range`);
    }
  }
  if (settings.reportLabel) {
    const s = sanitizeLabel(settings.reportLabel);
    if (s.error) errors.push(s.error);
  }
  const created = createSettings(capabilities);
  if (settings.resultCount != null && !created.available.resultCount) errors.push("resultCount-unavailable");
  return { ok: errors.length === 0, errors };
}

function buildSettingsPanelHtml(settings, { capabilities = {} } = {}) {
  const created = createSettings(capabilities);
  return {
    html: `<section class="settings-panel" aria-labelledby="settings-heading"><h2 id="settings-heading">Comparison settings</h2><p class="type-helper">Safe defaults work untouched. Advanced values stay within approved ranges. Directory mode is derived from grouping. Experimental mode is disabled.</p>
<label>Result count <input type="number" name="resultCount" min="${BOUNDS.resultCount.min}" max="${BOUNDS.resultCount.max}" value="${settings.resultCount}" ${created.available.resultCount ? "" : "disabled"} /></label>
<label>Common-match threshold <input type="number" name="commonMatchThreshold" min="${BOUNDS.commonMatchThreshold.min}" max="${BOUNDS.commonMatchThreshold.max}" value="${settings.commonMatchThreshold}" /></label>
<label>Report label <input type="text" name="reportLabel" maxlength="${BOUNDS.reportLabelMax}" value="${escape(settings.reportLabel || "")}" /></label>
<button type="button" data-action="reset-settings">Reset to defaults</button>
</section>`,
  };
}

function validateSettingsModule() {
  const errors = [];
  const { settings } = createSettings();
  if (settings.resultCount !== 250) errors.push("defaults");
  if (updateSetting(settings, "resultCount", 0).ok) errors.push("min");
  if (updateSetting(settings, "resultCount", 1001).ok) errors.push("max");
  if (!updateSetting(settings, "resultCount", 1).ok) errors.push("min-ok");
  if (updateSetting(settings, "reportLabel", "bad;label").ok) errors.push("text");
  if (updateSetting(settings, "reportLabel", "ok\u0000").ok) errors.push("control");
  if (updateSetting(settings, "experimental", true).ok) errors.push("experimental");
  if (updateSetting(settings, "directoryMode", "x").ok) errors.push("dir");
  const reset = resetSettings();
  if (reset.settings.resultCount !== DEFAULTS.resultCount) errors.push("reset");
  const draft = {
    groups: [
      { files: [{ displayName: "a.py" }, { displayName: "b.py" }] },
      { files: [{ displayName: "c.py" }] },
    ],
    settings,
  };
  const snap1 = serializeSettings(draft);
  const snap2 = serializeSettings(draft);
  if (snap1 !== snap2) errors.push("serialize");
  if (!snap1.includes('"directoryMode":"project"')) errors.push("derived");
  if (!validateSettings(settings).ok) errors.push("validate");
  if (!buildSettingsPanelHtml(settings).html.includes("Experimental mode is disabled")) errors.push("html");
  return { ok: errors.length === 0, errors };
}

function escape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

module.exports = {
  SETTINGS_VERSION,
  DEFAULTS,
  BOUNDS,
  createSettings,
  deriveDirectoryMode,
  updateSetting,
  sanitizeLabel,
  resetSettings,
  serializeSettings,
  validateSettings,
  buildSettingsPanelHtml,
  validateSettingsModule,
};
