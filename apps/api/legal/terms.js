"use strict";

/**
 * Versioned Terms of Service / EULA (Prompt 076).
 */

const TERMS_VERSION = "1.0.0";

function getTerms() {
  return Object.freeze({
    version: TERMS_VERSION,
    offerVersion: "2.0.0",
    priceUsd: 15,
    runsIncluded: 15,
    maxFilesPerRun: 2,
    deviceLimit: 2,
    sections: Object.freeze({
      license:
        "Personal, non-transferable license to the purchased core similarity-workflow features for up to 2 devices. Offer version 2.0.0 includes 15 hosted runs (max 2 files per run) during the hosted operability window.",
      acceptableUse:
        "Submit only code you are authorized to process. No unlawful, infringing, malware, or quota-evasion use. No shared account abuse.",
      ownership:
        "You retain ownership of submitted source. Product may process source solely to provide the service. Similarity output is a report link, not a legal verdict.",
      thirdParties:
        "Service depends on third-party provider (Moss/Similix path), payment processor, and hosting. Their terms and availability apply.",
      disclaimers:
        "Similarity is not a verdict. No guarantee of provider accuracy, uptime, confidentiality, provider-side deletion, or permanent report availability. Report URLs are bearer links.",
      refunds:
        "14 days if hosted runs remain unused; after first consumption, refunds follow published support policy only.",
      support:
        "Best-effort product support for the purchased major version; provider support is separate.",
      suspension:
        "Accounts may be suspended for abuse, fraud, or terms violations; unused entitlement handling follows support policy.",
      shutdown:
        "On hosted shutdown, new hosted checks disable; metadata history and documented export/pivot notice are provided — not unlimited lifetime hosting.",
    }),
    guarantees: Object.freeze({
      providerAccuracy: false,
      uptime: false,
      providerConfidentiality: false,
      providerDeletion: false,
      permanentReports: false,
      browserCopyRevocation: false,
    }),
  });
}

function mustPresentBeforePurchase() {
  return true;
}

function mustPresentBeforeSubmission() {
  return true;
}

function recordAcceptance({ userId, termsVersion, at = new Date().toISOString() }) {
  if (!userId) return { ok: false, error: "missing-user" };
  if (termsVersion !== TERMS_VERSION) return { ok: false, error: "terms-version" };
  return {
    ok: true,
    evidence: Object.freeze({
      userId,
      termsVersion,
      acceptedAt: at,
      document: "terms-of-service",
    }),
  };
}

module.exports = {
  TERMS_VERSION,
  getTerms,
  mustPresentBeforePurchase,
  mustPresentBeforeSubmission,
  recordAcceptance,
};
