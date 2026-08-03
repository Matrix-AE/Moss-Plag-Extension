"use strict";

/**
 * Persist and expose result metadata safely (Prompt 066).
 * Encrypt bearer report URLs; owner-scoped projections; URL-only forget vs terminal history delete.
 */

const crypto = require("node:crypto");

const RESULTS_VERSION = 1;
const URL_ALLOW = Object.freeze([
  /^https:\/\/mock\.local\/.+/i,
  /^https:\/\/([a-z0-9.-]+\.)?moss\.stanford\.edu\/.+/i,
]);
const DEFAULT_ESTIMATE_MS = 14 * 24 * 60 * 60 * 1000;

function createResultStore({
  encryptionKey,
  now = () => Date.now(),
  estimateMs = DEFAULT_ESTIMATE_MS,
} = {}) {
  if (!Buffer.isBuffer(encryptionKey) || encryptionKey.length < 32) {
    throw new Error("encryption-key-required");
  }
  const rows = new Map();
  const audits = [];

  function saveResult({
    jobId,
    ownerUserId,
    reportUrl,
    language,
    mode,
    entitlementOk,
    status = "succeeded",
  }) {
    if (!entitlementOk) return { ok: false, error: "entitlement" };
    if (!jobId || !ownerUserId) return { ok: false, error: "invalid" };
    const validated = validateReportUrl(reportUrl);
    if (!validated.ok) return validated;

    const encryptedUrl = encrypt(reportUrl, encryptionKey);
    const estimate = {
      availableUntil: now() + estimateMs,
      note: "Estimate only; provider may remove the report earlier or later.",
    };
    const row = {
      jobId,
      ownerUserId,
      encryptedUrl,
      urlForgotten: false,
      language: language || null,
      mode: mode || null,
      status,
      estimate,
      createdAt: now(),
      updatedAt: now(),
    };
    rows.set(jobId, row);
    audit({ action: "save", jobId, ownerUserId });
    return { ok: true, jobId, estimate, plaintextUrl: undefined };
  }

  function getResult(jobId, { ownerUserId } = {}) {
    const row = rows.get(jobId);
    if (!row) return { ok: false, error: "not-found" };
    if (row.ownerUserId !== ownerUserId) {
      audit({ action: "idor-denied", jobId, ownerUserId });
      return { ok: false, error: "idor" };
    }
    return {
      ok: true,
      projection: {
        jobId,
        language: row.language,
        mode: row.mode,
        status: row.status,
        reportUrlAvailable: !row.urlForgotten && !!row.encryptedUrl,
        availabilityEstimate: row.estimate,
        historyRetained: true,
        reportUrl: undefined,
      },
    };
  }

  function revealUrl(jobId, { ownerUserId } = {}) {
    const row = rows.get(jobId);
    if (!row) return { ok: false, error: "not-found" };
    if (row.ownerUserId !== ownerUserId) return { ok: false, error: "idor" };
    if (row.urlForgotten || !row.encryptedUrl) return { ok: false, error: "forgotten" };
    const url = decrypt(row.encryptedUrl, encryptionKey);
    audit({ action: "reveal-url", jobId, ownerUserId });
    return { ok: true, reportUrl: url };
  }

  function forgetUrl(jobId, { ownerUserId } = {}) {
    const row = rows.get(jobId);
    if (!row) return { ok: false, error: "not-found" };
    if (row.ownerUserId !== ownerUserId) return { ok: false, error: "idor" };
    row.encryptedUrl = null;
    row.urlForgotten = true;
    row.updatedAt = now();
    audit({ action: "forget-url", jobId, ownerUserId });
    return {
      ok: true,
      claimsProviderRevocation: false,
      claimsBrowserRevocation: false,
      claimsClipboardRevocation: false,
      message: "Product link forgotten; provider, browser history, and clipboard copies are not revoked.",
    };
  }

  function deleteHistory(jobId, { ownerUserId } = {}) {
    const row = rows.get(jobId);
    if (!row) return { ok: false, error: "not-found" };
    if (row.ownerUserId !== ownerUserId) return { ok: false, error: "idor" };
    if (!isTerminal(row.status)) {
      return { ok: false, error: "active-job" };
    }
    rows.delete(jobId);
    audit({ action: "delete-history", jobId, ownerUserId });
    return {
      ok: true,
      claimsProviderRevocation: false,
      message: "History deleted from the product; provider copies are not revoked.",
    };
  }

  function listHistory({ ownerUserId, limit = 50 } = {}) {
    return [...rows.values()]
      .filter((r) => r.ownerUserId === ownerUserId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit)
      .map((r) => ({
        jobId: r.jobId,
        language: r.language,
        mode: r.mode,
        status: r.status,
        reportUrlAvailable: !r.urlForgotten && !!r.encryptedUrl,
        availabilityEstimate: r.estimate,
      }));
  }

  function listAudits(jobId) {
    return audits.filter((a) => a.jobId === jobId);
  }

  function audit(entry) {
    audits.push({ at: now(), ...entry });
  }

  return {
    saveResult,
    getResult,
    revealUrl,
    forgetUrl,
    deleteHistory,
    listHistory,
    listAudits,
    RESULTS_VERSION,
  };
}

function validateReportUrl(url) {
  const text = String(url || "").trim();
  if (!/^https:\/\//i.test(text)) return { ok: false, error: "invalid-url" };
  try {
    const u = new URL(text);
    if (u.username || u.password) return { ok: false, error: "invalid-url" };
    if (!URL_ALLOW.some((re) => re.test(text))) return { ok: false, error: "invalid-url" };
  } catch {
    return { ok: false, error: "invalid-url" };
  }
  return { ok: true };
}

function isTerminal(status) {
  return status === "succeeded" || status === "failed" || status === "canceled";
}

function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decrypt(blob, key) {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

function validateResultMetadataModule() {
  const errors = [];
  const store = createResultStore({ encryptionKey: Buffer.alloc(32, 2) });
  const saved = store.saveResult({
    jobId: "v1",
    ownerUserId: "u",
    reportUrl: "https://mock.local/results/1",
    entitlementOk: true,
    language: "python",
    mode: "pair",
  });
  if (!saved.ok || saved.plaintextUrl) errors.push("save");
  if (store.getResult("v1", { ownerUserId: "x" }).ok) errors.push("idor");
  const forget = store.forgetUrl("v1", { ownerUserId: "u" });
  if (!forget.ok || forget.claimsProviderRevocation) errors.push("forget");
  if (store.getResult("v1", { ownerUserId: "u" }).projection.reportUrlAvailable) errors.push("forgotten-flag");

  store.saveResult({
    jobId: "v2",
    ownerUserId: "u",
    reportUrl: "https://mock.local/results/2",
    entitlementOk: true,
    status: "submitting",
  });
  if (store.deleteHistory("v2", { ownerUserId: "u" }).error !== "active-job") errors.push("active");

  store.saveResult({
    jobId: "v3",
    ownerUserId: "u",
    reportUrl: "https://mock.local/results/3",
    entitlementOk: true,
    status: "succeeded",
  });
  if (!store.deleteHistory("v3", { ownerUserId: "u" }).ok) errors.push("delete");
  if (validateReportUrl("http://evil/x").ok) errors.push("http");
  if (!validateReportUrl("https://moss.stanford.edu/results/a").ok) errors.push("moss");

  return { ok: errors.length === 0, errors, version: RESULTS_VERSION };
}

module.exports = {
  RESULTS_VERSION,
  URL_ALLOW,
  createResultStore,
  validateReportUrl,
  validateResultMetadataModule,
};
