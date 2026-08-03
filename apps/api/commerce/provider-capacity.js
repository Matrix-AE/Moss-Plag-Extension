"use strict";

/**
 * Provider capacity configuration (Prompt 072).
 * Converts approved/public provider terms into enforceable limits.
 * Never invents reset timezone or promises above written/public evidence.
 */

const CAPACITY_VERSION = 1;

function createProviderCapacityConfig(overrides = {}) {
  return Object.freeze({
    version: CAPACITY_VERSION,
    evidenceSource: "moss-service-research-public-materials",
    providerPublicDailyLimitPerUser: 100,
    resetTimezone: null,
    resetTimezonePolicy: "unspecified-do-not-invent",
    publicSlaFound: false,
    consumptionEvent: "provider-accepted-submission",
    customerAllowanceSemantics: "non-renewing-purchased-allowance",
    credentialQuota: Object.freeze({
      maxActivePerTenant: overrides.maxActiveCredentials ?? 1,
      replaceRequiresAudit: true,
    }),
    concurrency: Object.freeze({
      maxInFlightPerTenant: overrides.maxInFlightPerTenant ?? 2,
      maxInFlightGlobal: overrides.maxInFlightGlobal ?? 20,
    }),
    bounds: Object.freeze({
      maxFilesPerSubmission: overrides.maxFiles ?? 100,
      maxGroupsPerSubmission: overrides.maxGroups ?? 50,
      maxBytesPerSubmission: overrides.maxBytes ?? 32 * 1024 * 1024,
    }),
    timeouts: Object.freeze({
      submitMs: overrides.submitMs ?? 120_000,
      resultPollMs: overrides.resultPollMs ?? 300_000,
      idleJobMs: overrides.idleJobMs ?? 600_000,
    }),
    maintenance: Object.freeze({
      windowUtcHint: null,
      copy: "Provider capacity is best-effort; maintenance windows are announced when known.",
    }),
    escalation: Object.freeze({
      opsOwner: "operations-lead",
      onExhaustion: "disable-new-submissions",
      onOutage: "trip-kill-switch-preserve-drafts",
      onContractChange: "reopen-commercial-gates",
    }),
    forecasts: Object.freeze({
      launchPeakJobsPerHour: overrides.launchPeakJobsPerHour ?? 40,
      growthHeadroomFactor: 1.5,
      notes: "Forecasts are operational planning only; not customer SLA.",
    }),
    promises: Object.freeze({
      availabilityPercent: null,
      providerRetentionDays: null,
      supportSlaHours: null,
      greaterThanPublicEvidence: false,
    }),
  });
}

function validateAgainstCapacity(cfg, { files, groups, bytes, inFlightTenant, inFlightGlobal }) {
  const violations = [];
  if (files > cfg.bounds.maxFilesPerSubmission) violations.push("max-files");
  if (groups > cfg.bounds.maxGroupsPerSubmission) violations.push("max-groups");
  if (bytes > cfg.bounds.maxBytesPerSubmission) violations.push("max-bytes");
  if (inFlightTenant >= cfg.concurrency.maxInFlightPerTenant) violations.push("tenant-concurrency");
  if (inFlightGlobal >= cfg.concurrency.maxInFlightGlobal) violations.push("global-concurrency");
  return { ok: violations.length === 0, violations };
}

function stressScenarios(cfg) {
  const highUse = validateAgainstCapacity(cfg, {
    files: cfg.bounds.maxFilesPerSubmission,
    groups: cfg.bounds.maxGroupsPerSubmission,
    bytes: cfg.bounds.maxBytesPerSubmission,
    inFlightTenant: cfg.concurrency.maxInFlightPerTenant - 1,
    inFlightGlobal: cfg.concurrency.maxInFlightGlobal - 1,
  });
  return Object.freeze({
    highUse: Object.freeze({ ok: highUse.ok, mode: "conservative-high-use" }),
    providerOutage: Object.freeze({
      ok: true,
      degradedMode: cfg.escalation.onExhaustion,
      killSwitch: cfg.escalation.onOutage,
    }),
  });
}

function operationalCapacityPlan(cfg) {
  return Object.freeze({
    version: cfg.version,
    scenarios: Object.freeze([
      "launch-peak",
      "outage",
      "exhaustion",
      "growth",
      "contract-change",
      "termination",
    ]),
    launchPeakJobsPerHour: cfg.forecasts.launchPeakJobsPerHour,
    dailyProviderCeilingPerUserid: cfg.providerPublicDailyLimitPerUser,
    actions: Object.freeze({
      outage: cfg.escalation.onOutage,
      exhaustion: cfg.escalation.onExhaustion,
      contractChange: cfg.escalation.onContractChange,
      termination: "stop-or-pivot-adr",
    }),
  });
}

function reconcileWithEvidence(cfg, evidence = {}) {
  const mismatches = [];
  if (evidence.publicDailyLimit != null && evidence.publicDailyLimit !== cfg.providerPublicDailyLimitPerUser) {
    mismatches.push("daily-limit");
  }
  if (evidence.resetTimezoneClaimed && cfg.resetTimezone == null) {
    // OK — we refuse invented TZ
  }
  if (evidence.slaPercent != null && cfg.promises.availabilityPercent == null) {
    mismatches.push("sla-overclaim");
  }
  return { ok: mismatches.length === 0, mismatches };
}

module.exports = {
  CAPACITY_VERSION,
  createProviderCapacityConfig,
  validateAgainstCapacity,
  stressScenarios,
  operationalCapacityPlan,
  reconcileWithEvidence,
};
