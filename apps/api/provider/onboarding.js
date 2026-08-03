"use strict";

/**
 * Provider onboarding, fallback, and kill switches (Prompt 074).
 * BYO numeric Moss userid: masked connect/replace/delete, disable mode, adapter selection.
 * No automated registration, password requests, shared rotation, or silent processor switches.
 */

const crypto = require("node:crypto");

const ONBOARDING_VERSION = 1;
const ALLOWED_ADAPTERS = Object.freeze(["mock", "commercial-encrypted"]);

function maskId(id) {
  const s = String(id);
  if (s.length <= 2) return "**";
  return `${"*".repeat(Math.max(2, s.length - 2))}${s.slice(-2)}`;
}

function isNumericId(value) {
  return typeof value === "string" && /^[0-9]{1,12}$/.test(value);
}

function createProviderOnboarding({
  consentVersion = "1.0.0",
  now = () => Date.now(),
} = {}) {
  const credentials = new Map();
  const audits = [];
  let killSwitch = null;
  let activeAdapter = "mock";

  const automation = Object.freeze({
    registrationForbidden: true,
    passwordRequestForbidden: true,
    sharedRotationForbidden: true,
  });

  function audit(entry) {
    audits.push({ ...entry, at: now() });
  }

  function connect({ tenantId, mossUserId, actor }) {
    if (!tenantId || !isNumericId(mossUserId)) return { ok: false, error: "invalid-input" };
    const id = `pcred_${crypto.randomBytes(6).toString("hex")}`;
    const encryptedRef = crypto.createHash("sha256").update(`${tenantId}:${mossUserId}:${id}`).digest("hex");
    const record = {
      id,
      tenantId,
      mossUserId,
      display: maskId(mossUserId),
      encryptedRef,
      createdAt: now(),
      revoked: false,
    };
    credentials.set(id, record);
    audit({ action: "connect", tenantId, credentialId: id, actor });
    return { ok: true, id, display: record.display, encryptedRef };
  }

  function replace({ tenantId, credentialId, mossUserId, actor }) {
    const existing = credentials.get(credentialId);
    if (!existing || existing.tenantId !== tenantId || existing.revoked) {
      return { ok: false, error: "not-found" };
    }
    existing.revoked = true;
    audit({ action: "revoke-for-replace", tenantId, credentialId, actor });
    return connect({ tenantId, mossUserId, actor });
  }

  function deleteCredential({ tenantId, credentialId, actor }) {
    const existing = credentials.get(credentialId);
    if (!existing || existing.tenantId !== tenantId) return { ok: false, error: "not-found" };
    existing.revoked = true;
    existing.mossUserId = null;
    audit({ action: "delete", tenantId, credentialId, actor });
    return { ok: true };
  }

  function getMasked({ tenantId, credentialId }) {
    const record = credentials.get(credentialId);
    if (!record || record.tenantId !== tenantId || record.revoked) {
      return { ok: false, error: "not-found" };
    }
    return { ok: true, display: record.display, id: record.id };
  }

  function tripKillSwitch({ reason, actor }) {
    killSwitch = { reason, actor, at: now() };
    audit({ action: "kill-switch-trip", tenantId: "*", credentialId: null, actor, reason });
    return { ok: true, killSwitch };
  }

  function clearKillSwitch({ actor }) {
    killSwitch = null;
    audit({ action: "kill-switch-clear", tenantId: "*", credentialId: null, actor });
    return { ok: true };
  }

  function capabilities() {
    const disabled = Boolean(killSwitch);
    return Object.freeze({
      version: ONBOARDING_VERSION,
      mode: disabled ? "disabled" : "active",
      submissionEnabled: !disabled,
      adapter: activeAdapter,
      consentVersion,
      killSwitch: killSwitch ? { reason: killSwitch.reason, at: killSwitch.at } : null,
    });
  }

  function maintenanceCopy() {
    if (!killSwitch) return "Provider submission is available.";
    return "Provider submission is temporarily unavailable (maintenance or disabled). Drafts and existing report links are preserved. New jobs are blocked until operations re-enable the provider.";
  }

  function beginSubmission({ tenantId }) {
    if (!tenantId) return { ok: false, error: "missing-tenant" };
    if (killSwitch) return { ok: false, error: "provider-disabled" };
    return { ok: true, adapter: activeAdapter };
  }

  function selectAdapter({ requested, silent = false }) {
    if (!ALLOWED_ADAPTERS.includes(requested)) return { ok: false, error: "unknown-adapter" };
    if (silent && requested !== activeAdapter) {
      return { ok: false, error: "silent-switch-forbidden" };
    }
    const previous = activeAdapter;
    activeAdapter = requested;
    audit({
      action: "adapter-select",
      tenantId: "*",
      credentialId: null,
      from: previous,
      to: requested,
    });
    return { ok: true, adapter: activeAdapter, previous };
  }

  function handleStaleClient({ clientConsentVersion, hasDraft }) {
    if (clientConsentVersion !== consentVersion) {
      return {
        ok: false,
        error: "consent-upgrade-required",
        requiredVersion: consentVersion,
        preserveDrafts: Boolean(hasDraft),
      };
    }
    return { ok: true };
  }

  function requireDisclosureForProviderChange({ fromAdapter, toAdapter }) {
    const material = fromAdapter !== toAdapter;
    return {
      requiresNewConsent: material,
      silent: false,
      disclosure: material
        ? "Provider processing path changed. Review updated disclosure and re-consent before submitting."
        : null,
    };
  }

  function listInFlightProtection() {
    return Object.freeze({
      preserveDrafts: true,
      preserveExistingLinks: true,
      blocksNewWork: Boolean(killSwitch),
      supportPathOpen: true,
    });
  }

  return {
    automation,
    connect,
    replace,
    deleteCredential,
    getMasked,
    tripKillSwitch,
    clearKillSwitch,
    capabilities,
    maintenanceCopy,
    beginSubmission,
    selectAdapter,
    handleStaleClient,
    requireDisclosureForProviderChange,
    listInFlightProtection,
    audits: () => [...audits],
  };
}

module.exports = {
  ONBOARDING_VERSION,
  ALLOWED_ADAPTERS,
  createProviderOnboarding,
  maskId,
  isNumericId,
};
