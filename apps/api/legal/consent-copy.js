"use strict";

/**
 * Versioned consent and data-rights copy (Prompt 078).
 */

const CONSENT_COPY_VERSION = "1.1.0";

function getConsentCopy() {
  return Object.freeze({
    version: CONSENT_COPY_VERSION,
    ageGate: "18+",
    localeReady: true,
    defaults: Object.freeze({
      ownershipSelected: false,
      sensitiveLinkSelected: false,
      ageSelected: false,
    }),
    layers: Object.freeze({
      short:
        "Your files leave this device for encrypted product upload and external similarity processing. Report links are bearer secrets.",
      detailed:
        "Adults 18+ only. Backend and provider process source temporarily. Browser/clipboard copies of report URLs are outside our control. Legal retention exceptions may apply to payment records. Institutional/minor datasets are outside this personal MVP.",
    }),
    links: Object.freeze({
      terms: "/legal/terms",
      privacy: "/legal/privacy",
      dataRights: "/legal/data-rights",
    }),
    dataRights: Object.freeze({
      export: "Request an account/entitlement/job-metadata export (no source bytes).",
      delete: "Request account deletion subject to payment/tax legal holds.",
      forgetLink: "Forget removes product-stored report URLs only — not provider or browser copies.",
    }),
  });
}

function evaluateConsentGate({ ownership, sensitiveLink, ageConfirmed, policyVersion }) {
  const blockers = [];
  if (ownership !== true) blockers.push("ownership");
  if (sensitiveLink !== true) blockers.push("sensitive-link");
  if (ageConfirmed !== true) blockers.push("age");
  if (policyVersion !== CONSENT_COPY_VERSION) blockers.push("policy-version");
  return { ok: blockers.length === 0, blockers };
}

function resetTriggers() {
  return Object.freeze([
    "files-changed",
    "groups-changed",
    "language-changed",
    "provider-changed",
    "settings-changed",
    "policy-version-changed",
  ]);
}

function migrateConsentVersion({ from, to }) {
  return {
    requiresReconsent: from !== to,
    from,
    to,
  };
}

function recordConsentEvidence({
  userId,
  policyVersion,
  ownership,
  sensitiveLink,
  ageConfirmed,
  at = new Date().toISOString(),
}) {
  const gate = evaluateConsentGate({ ownership, sensitiveLink, ageConfirmed, policyVersion });
  if (!gate.ok) return { ok: false, error: "incomplete", blockers: gate.blockers };
  return {
    ok: true,
    storesSource: false,
    evidence: Object.freeze({
      userId,
      policyVersion,
      ownership: true,
      sensitiveLink: true,
      ageConfirmed: true,
      recordedAt: at,
    }),
  };
}

function surfaces() {
  return Object.freeze(["preview", "checkout", "review", "settings"]);
}

function renderConsentHtml() {
  const copy = getConsentCopy();
  return `<form data-consent-version="${copy.version}">
<p>${copy.layers.short}</p>
<label><input type="checkbox" name="ownership" /> I have authority to submit these files.</label>
<label><input type="checkbox" name="sensitiveLink" /> I understand report links are bearer secrets.</label>
<label><input type="checkbox" name="age" /> I confirm I am 18 or older.</label>
<a href="${copy.links.terms}">Terms</a>
<a href="${copy.links.privacy}">Privacy</a>
</form>`;
}

module.exports = {
  CONSENT_COPY_VERSION,
  getConsentCopy,
  evaluateConsentGate,
  resetTriggers,
  migrateConsentVersion,
  recordConsentEvidence,
  surfaces,
  renderConsentHtml,
};
