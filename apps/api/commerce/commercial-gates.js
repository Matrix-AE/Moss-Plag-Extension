"use strict";

/**
 * Commercial and encrypted-transport enable gates (Prompt 071).
 * Production stays off unless rights and encrypted transport evidence are present.
 * BYO, pooling, and rotation are never workarounds for missing commercial rights.
 */

const COMMERCIAL_GATE_VERSION = 1;

const DEFAULT_OWNERS = Object.freeze({
  product: "product-owner",
  legalPrivacy: "legal-privacy-reviewer",
  security: "security-reviewer",
  operations: "operations-lead",
});

const REQUIRED_SIGN_ROLES = Object.freeze(["product", "legalPrivacy", "security", "operations"]);

function createCommercialGateConfig(overrides = {}) {
  const rightsEvidence = overrides.rightsEvidence ?? null;
  const encryptedTransportApproved = Boolean(overrides.encryptedTransportApproved);
  const hasRights = Boolean(rightsEvidence);
  const productionEnabled =
    overrides.productionEnabled === true && hasRights && encryptedTransportApproved;

  return Object.freeze({
    version: COMMERCIAL_GATE_VERSION,
    decision: productionEnabled ? "enable" : "hold",
    productionEnabled,
    rightsEvidence,
    encryptedTransportApproved,
    encryptedUploadEndpoint: overrides.encryptedUploadEndpoint ?? null,
    encryptedReportScheme: overrides.encryptedReportScheme ?? "https",
    accountModel: "byo-moss-userid-after-purchase",
    providerPublicDailyLimitPerUser: 100,
    consumptionEvent: "provider-accepted-submission",
    resetSemantics:
      "customer-allowance-non-renewing; provider-day-limit-per-userid-unspecified-tz",
    data: Object.freeze({
      sourceTemporary: true,
      reportUrlsBearerSensitive: true,
      noLocalOnlyClaim: true,
    }),
    sla: Object.freeze({
      productSeparateFromProvider: true,
      publicProviderSlaFound: false,
      promiseOnlyWrittenTerms: true,
    }),
    brand: Object.freeze({
      noUnofficialAffiliation: true,
      useApprovedStringsOnly: true,
    }),
    termination: Object.freeze({
      triggersStopOrPivot: true,
      reviewWithinBusinessDays: 5,
    }),
    restrictions: Object.freeze({
      paidAutomationRequiresWrittenRights: true,
      byoIsNotCommercialWorkaround: true,
      poolingForbidden: true,
      rotationForbidden: true,
      rawTcpForbidden: true,
      clientSelectedHostPortForbidden: true,
      ambiguousRightsBlocksProduction: true,
    }),
    killSwitch: Object.freeze({
      defaultArmed: true,
      blocksNewJobsWhenTripped: true,
      preservesDraftsAndExistingLinks: true,
    }),
    owners: Object.freeze({ ...DEFAULT_OWNERS, ...(overrides.owners || {}) }),
    reviewBy: overrides.reviewBy ?? "2026-09-17",
    monitoringAlerts: Object.freeze([
      "production-enable-without-rights",
      "encrypted-transport-missing",
      "raw-tcp-egress-attempt",
      "provider-daily-limit-exhaustion",
      "kill-switch-tripped",
    ]),
  });
}

function evaluateEnablement(cfg) {
  const blockers = [];
  if (!cfg.rightsEvidence) blockers.push("rights-evidence");
  if (!cfg.encryptedTransportApproved) blockers.push("encrypted-transport");
  if (cfg.restrictions.poolingForbidden !== true) blockers.push("pooling-policy");
  if (cfg.restrictions.rotationForbidden !== true) blockers.push("rotation-policy");
  if (cfg.restrictions.rawTcpForbidden !== true) blockers.push("raw-tcp-policy");
  if (cfg.productionEnabled && blockers.length) {
    return { ok: false, blockers: [...blockers, "inconsistent-production-flag"] };
  }
  if (!cfg.productionEnabled) {
    return { ok: false, blockers: blockers.length ? blockers : ["production-held"] };
  }
  return { ok: true, blockers: [] };
}

function signEnableChecklist({
  product = false,
  legalPrivacy = false,
  security = false,
  operations = false,
  evidenceRefs = [],
  now = () => new Date().toISOString(),
} = {}) {
  const votes = { product, legalPrivacy, security, operations };
  const missing = REQUIRED_SIGN_ROLES.filter((role) => !votes[role]);
  if (missing.length) {
    return { ok: false, missing, signatures: [] };
  }
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0) {
    return { ok: false, missing: ["evidence-refs"], signatures: [] };
  }
  const signedAt = now();
  return {
    ok: true,
    missing: [],
    evidenceRefs: [...evidenceRefs],
    signatures: REQUIRED_SIGN_ROLES.map((role) =>
      Object.freeze({ role, owner: DEFAULT_OWNERS[role], signedAt }),
    ),
  };
}

function drillOperationalControls({ scenario }) {
  const base = {
    productionEnabled: false,
    preserveDrafts: true,
    preserveExistingLinks: true,
    killSwitchSet: true,
    blocksNewJobs: true,
  };
  switch (scenario) {
    case "provider-terms-revoked":
      return Object.freeze({ ...base, action: "stop", reason: "rights-revoked" });
    case "encrypted-route-unavailable":
      return Object.freeze({ ...base, action: "kill", reason: "tls-unavailable" });
    case "provider-overload":
      return Object.freeze({
        ...base,
        action: "pivot-or-disable",
        reason: "capacity-or-outage",
      });
    default:
      return Object.freeze({ ...base, action: "kill", reason: "unknown-scenario" });
  }
}

function exportGateSnapshot(cfg) {
  return Object.freeze({
    version: cfg.version,
    decision: cfg.decision,
    productionEnabled: cfg.productionEnabled,
    accountModel: cfg.accountModel,
    providerPublicDailyLimitPerUser: cfg.providerPublicDailyLimitPerUser,
    consumptionEvent: cfg.consumptionEvent,
    resetSemantics: cfg.resetSemantics,
    restrictions: cfg.restrictions,
    monitoringAlerts: cfg.monitoringAlerts,
    owners: cfg.owners,
    reviewBy: cfg.reviewBy,
    customerCopy: Object.freeze({
      noPooling: "Shared or rotated Moss accounts are never used.",
      byoNotWorkaround:
        "Bring-your-own Moss userid is the approved credential model, not a substitute for written commercial rights.",
      transport: "Uploads and report links use approved encrypted HTTPS routes only.",
      dailyLimitNote:
        "Moss publicly enforces 100 submissions per day per userid; timezone of reset is not invented here.",
    }),
  });
}

function selfTest() {
  const errors = [];
  const held = createCommercialGateConfig();
  if (held.productionEnabled) errors.push("default-on");
  const enabled = createCommercialGateConfig({
    rightsEvidence: "attested",
    encryptedTransportApproved: true,
    productionEnabled: true,
  });
  if (!evaluateEnablement(enabled).ok) errors.push("enable-fail");
  const signed = signEnableChecklist({
    product: true,
    legalPrivacy: true,
    security: true,
    operations: true,
    evidenceRefs: ["ADR-0005B"],
  });
  if (!signed.ok) errors.push("sign");
  return { ok: errors.length === 0, errors };
}

module.exports = {
  COMMERCIAL_GATE_VERSION,
  createCommercialGateConfig,
  evaluateEnablement,
  signEnableChecklist,
  drillOperationalControls,
  exportGateSnapshot,
  selfTest,
};
