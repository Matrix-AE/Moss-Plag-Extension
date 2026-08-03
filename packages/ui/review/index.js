"use strict";

/**
 * Review, consent, and confirmation (Prompt 045).
 * Final summary of what leaves the device; no upload before confirmation.
 */

const preflight = require("../preflight");
const settings = require("../settings");
const baseCode = require("../base-code");

const REVIEW_VERSION = 1;
const CONSENT_POLICY_VERSION = "1.0.0";

function buildReviewSummary(draft, { entitlement = null, retentionHours = 24 } = {}) {
  const groups = (draft.groups || []).map((g) => ({
    id: g.id,
    label: g.label,
    fileCount: (g.files || []).length,
    files: (g.files || []).map((f) => f.displayName),
    bytes: (g.files || []).reduce((s, f) => s + (f.bytes || f.size || 0), 0),
  }));
  const totalBytes = groups.reduce((s, g) => s + g.bytes, 0) +
    (draft.baseFiles || []).reduce((s, f) => s + (f.bytes || f.size || 0), 0);
  return {
    title: draft.title || "Untitled comparison",
    mode: draft.mode,
    language: draft.language,
    languageConfirmed: Boolean(draft.languageConfirmed),
    groups,
    baseCode: baseCode.markBaseInReview(draft),
    settings: draft.settings || settings.DEFAULTS,
    settingsSerialized: settings.serializeSettings(draft),
    totalBytes,
    numericAllowance: entitlement?.remaining ?? null,
    retentionHours,
    transport: "Encrypted upload to product infrastructure, then external similarity provider.",
    terminology: "similarity",
    affiliationClaim: false,
  };
}

function createConsentState() {
  return {
    ownership: false,
    sensitiveLink: false,
    policyVersion: null,
    recordedAt: null,
  };
}

function recordConsent(consent, { ownership, sensitiveLink, policyVersion = CONSENT_POLICY_VERSION }) {
  if (ownership !== true || sensitiveLink !== true) {
    return { ok: false, error: "consent-incomplete", consent };
  }
  if (!policyVersion) return { ok: false, error: "missing-policy-version", consent };
  return {
    ok: true,
    consent: {
      ownership: true,
      sensitiveLink: true,
      policyVersion,
      recordedAt: new Date().toISOString(),
    },
  };
}

function resetConsentAfterMaterialChange(prevDraft, nextDraft, consent) {
  const prev = JSON.stringify({
    groups: prevDraft.groups,
    language: prevDraft.language,
    baseFiles: prevDraft.baseFiles,
    settings: prevDraft.settings,
    title: prevDraft.title,
  });
  const next = JSON.stringify({
    groups: nextDraft.groups,
    language: nextDraft.language,
    baseFiles: nextDraft.baseFiles,
    settings: nextDraft.settings,
    title: nextDraft.title,
  });
  if (prev !== next) return createConsentState();
  return consent;
}

function canSubmit(draft, consent, { preflightReport, entitlement } = {}) {
  const blockers = [];
  const report = preflightReport || preflight.runPreflight(draft, { limits: preflight.DEFAULT_LIMITS });
  if (!report.canProceed) {
    blockers.push(...report.errors.map((e) => e.code));
  }
  if (report.warnings?.length && !draft.warningsAcknowledged) {
    blockers.push("warnings-unacked");
  }
  if (!consent?.ownership || !consent?.sensitiveLink) blockers.push("consent-required");
  if (!consent?.policyVersion) blockers.push("consent-version");
  if (consent?.ownership === true && consent?.sensitiveLink === true && !consent.recordedAt) {
    blockers.push("consent-not-recorded");
  }
  if (entitlement && entitlement.remaining != null && entitlement.remaining < 1) {
    blockers.push("quota-exhausted");
  }
  return { ok: blockers.length === 0, blockers, disabled: blockers.length > 0 };
}

function buildReviewHtml(draft, consent, options = {}) {
  const summary = buildReviewSummary(draft, options);
  const gate = canSubmit(draft, consent, options);
  const groupBlocks = summary.groups
    .map(
      (g) =>
        `<section data-group-id="${escape(g.id)}"><h3>${escape(g.label)}</h3><p>${g.fileCount} files · ${g.bytes} bytes</p><ul>${g.files.map((n) => `<li class="type-code">${escape(n)}</li>`).join("")}</ul></section>`,
    )
    .join("");
  return {
    html: `<div class="review-screen" role="main">
<h1>${escape(summary.title)}</h1>
<p class="type-helper">Source reaches product infrastructure and an external similarity provider. Result URLs can grant access to submitted code. No provider affiliation is claimed.</p>
<p>Language: ${escape(summary.language || "unset")} · Mode: ${escape(summary.mode)} · Bytes: ${summary.totalBytes} · Retention: ${summary.retentionHours}h</p>
<p>Numeric allowance: ${summary.numericAllowance == null ? "n/a" : summary.numericAllowance}</p>
<p>${escape(summary.transport)}</p>
${groupBlocks}
${baseCode.buildBasePanelHtml(draft).html}
<label><input type="checkbox" name="ownership" ${consent.ownership ? "checked" : ""} /> I confirm I have the right to submit these files.</label>
<label><input type="checkbox" name="sensitiveLink" ${consent.sensitiveLink ? "checked" : ""} /> I understand the report link is sensitive like a password.</label>
<button type="submit" ${gate.disabled ? "disabled" : ""} data-consent-version="${CONSENT_POLICY_VERSION}">Confirm and continue</button>
</div>`,
    summary,
    gate,
  };
}

function validateReviewModule() {
  const errors = [];
  const draft = {
    title: "Lab 1",
    mode: "batch",
    language: "python",
    languageConfirmed: true,
    groups: [
      { id: "g1", label: "A", files: [{ id: "f1", key: "k1", displayName: "a.py", bytes: 10 }] },
      { id: "g2", label: "B", files: [{ id: "f2", key: "k2", displayName: "b.py", bytes: 10 }] },
    ],
    baseFiles: [],
    settings: settings.DEFAULTS,
  };
  let consent = createConsentState();
  if (consent.ownership || consent.sensitiveLink) errors.push("prechecked");

  const summary = buildReviewSummary(draft, { entitlement: { remaining: 3 } });
  if (summary.affiliationClaim) errors.push("affiliation");
  if (summary.terminology !== "similarity") errors.push("term");
  if (summary.groups.length !== 2) errors.push("summary");

  if (canSubmit(draft, consent).ok) errors.push("ungated");

  const recorded = recordConsent(consent, { ownership: true, sensitiveLink: true });
  if (!recorded.ok) errors.push("record");
  consent = recorded.consent;

  const open = canSubmit(draft, consent, { entitlement: { remaining: 3 } });
  if (!open.ok) errors.push("should-submit");

  consent = resetConsentAfterMaterialChange(draft, { ...draft, language: "java" }, consent);
  if (consent.ownership) errors.push("reset");

  const html = buildReviewHtml(draft, createConsentState(), { entitlement: { remaining: 2 } });
  if (!html.html.includes("disabled")) errors.push("disabled-btn");
  if (!html.html.includes("similarity")) errors.push("html-term");
  if (html.html.includes("plagiarism verdict")) errors.push("verdict");

  const quota = canSubmit(draft, recorded.consent, { entitlement: { remaining: 0 } });
  if (!quota.blockers.includes("quota-exhausted")) errors.push("quota");

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
  REVIEW_VERSION,
  CONSENT_POLICY_VERSION,
  buildReviewSummary,
  createConsentState,
  recordConsent,
  resetConsentAfterMaterialChange,
  canSubmit,
  buildReviewHtml,
  validateReviewModule,
};
