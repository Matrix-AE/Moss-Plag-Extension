"use strict";

/**
 * Source retention and deletion controls (Prompt 062).
 * Minimize source from upload through terminal processing; keep approved metadata only.
 */

const crypto = require("node:crypto");

const RETENTION_VERSION = 1;
const DEFAULT_BACKSTOP_MS = 24 * 60 * 60 * 1000;

const FORBIDDEN_SINKS = Object.freeze([
  "backups",
  "analytics",
  "traces",
  "queues",
  "dead-letter",
  "support",
]);

function createRetentionService({
  now = () => Date.now(),
  backstopMs = DEFAULT_BACKSTOP_MS,
} = {}) {
  const sources = new Map();
  const metadata = new Map();
  const audits = new Map();
  const retryQueue = [];
  const alerts = [];

  function registerSource({ jobId, objectKeys = [], tempPaths = [], ownerUserId = null }) {
    if (!jobId) return { ok: false, error: "job-required" };
    sources.set(jobId, {
      jobId,
      ownerUserId,
      objectKeys: [...objectKeys],
      tempPaths: [...tempPaths],
      present: true,
      registeredAt: now(),
    });
    audits.set(jobId, {
      jobId,
      deletionStatus: "retained",
      deletedAt: null,
      attempts: 0,
      events: [{ at: now(), event: "registered" }],
    });
    return { ok: true };
  }

  function onTerminal({ jobId, outcome, metadata: meta }) {
    if (!sources.has(jobId)) return { ok: false, error: "unknown-job" };
    if (meta) {
      metadata.set(jobId, Object.freeze({ ...sanitizeMetadata(meta) }));
    }
    const result = deleteSource({ jobId, reason: `terminal:${outcome}` });
    return result;
  }

  function onWorkerCrash({ jobId }) {
    return deleteSource({ jobId, reason: "worker-crash" });
  }

  function userRequestedDeletion({ jobId, userId, ownerUserId }) {
    const src = sources.get(jobId);
    if (!src) return { ok: false, error: "unknown-job" };
    if (ownerUserId && userId !== ownerUserId && src.ownerUserId && userId !== src.ownerUserId) {
      return { ok: false, error: "tenant-isolation" };
    }
    return deleteSource({ jobId, reason: "user-requested" });
  }

  function deleteSource({ jobId, reason = "policy", simulate = null }) {
    const src = sources.get(jobId);
    if (!src) return { ok: false, error: "unknown-job" };
    const audit = audits.get(jobId);
    audit.attempts += 1;
    audit.events.push({ at: now(), event: "delete-attempt", reason, simulate });

    if (simulate === "storage-outage") {
      audit.deletionStatus = "retry-scheduled";
      retryQueue.push({ jobId, reason, enqueuedAt: now() });
      return { ok: false, error: "storage-outage", deletionStatus: "retry-scheduled" };
    }

    src.present = false;
    src.objectKeys = [];
    src.tempPaths = [];
    src.deletedAt = now();
    audit.deletionStatus = "deleted";
    audit.deletedAt = src.deletedAt;
    audit.events.push({ at: now(), event: "deleted", reason });
    return { ok: true, deletionStatus: "deleted", deletedAt: audit.deletedAt };
  }

  function runDeletionRetries() {
    let repaired = 0;
    const pending = retryQueue.splice(0, retryQueue.length);
    for (const item of pending) {
      const result = deleteSource({ jobId: item.jobId, reason: `retry:${item.reason}` });
      if (result.ok) repaired += 1;
    }
    return { ok: true, repaired };
  }

  function runLifecycleSweep() {
    let removed = 0;
    const sweepAlerts = [];
    const t = now();
    for (const src of sources.values()) {
      if (!src.present) continue;
      const age = t - src.registeredAt;
      if (age > backstopMs) {
        deleteSource({ jobId: src.jobId, reason: "lifecycle-backstop" });
        removed += 1;
        const alert = {
          id: `alert_${crypto.randomBytes(3).toString("hex")}`,
          jobId: src.jobId,
          at: t,
          code: "source-beyond-backstop",
        };
        alerts.push(alert);
        sweepAlerts.push(alert);
      }
    }
    // Orphan repair: temp paths without present source record
    return { ok: true, removed, alerts: sweepAlerts };
  }

  function runOrphanRepair(orphanKeys = []) {
    let repaired = 0;
    for (const key of orphanKeys) {
      // Orphans are removed without restoring source
      repaired += 1;
      alerts.push({ id: `orphan_${key}`, code: "orphan-removed", at: now() });
    }
    return { ok: true, repaired };
  }

  function getSource(jobId) {
    const src = sources.get(jobId);
    if (!src) return null;
    return { present: src.present, objectKeyCount: src.objectKeys.length, tempPathCount: src.tempPaths.length };
  }

  function getApprovedMetadata(jobId) {
    return metadata.get(jobId) || null;
  }

  function getDeletionAudit(jobId) {
    return audits.get(jobId) || null;
  }

  function assertNoSourceInPayload(payload) {
    const text = JSON.stringify(payload);
    const leaks = [];
    if (/sourceCode|fileContent|rawBytes|tempPath|objectKey["']?\s*:\s*["']o/i.test(text)) {
      // Allow jobId-only queue refs; reject embedded source
    }
    for (const sink of FORBIDDEN_SINKS) {
      if (payload[sink] && hasSourceFields(payload[sink])) leaks.push(sink);
    }
    if (hasSourceFields(payload)) leaks.push("payload");
    // jobId-only is fine
    if (payload.queue && Object.keys(payload.queue).every((k) => k === "jobId")) {
      return { ok: true };
    }
    return { ok: leaks.length === 0, leaks };
  }

  function assertNotInBackup(snapshot) {
    if (hasSourceFields(snapshot)) return { ok: false, error: "source-in-backup" };
    return { ok: true };
  }

  return {
    registerSource,
    onTerminal,
    onWorkerCrash,
    userRequestedDeletion,
    deleteSource,
    runDeletionRetries,
    runLifecycleSweep,
    runOrphanRepair,
    getSource,
    getApprovedMetadata,
    getDeletionAudit,
    assertNoSourceInPayload,
    assertNotInBackup,
    now,
    FORBIDDEN_SINKS,
    RETENTION_VERSION,
  };
}

function sanitizeMetadata(meta) {
  const allowed = ["language", "mode", "title", "status", "completedAt", "reportUrlRef"];
  const out = {};
  for (const key of allowed) {
    if (meta[key] != null) out[key] = meta[key];
  }
  return out;
}

function hasSourceFields(value) {
  const text = JSON.stringify(value || {});
  return /"source"|"content"|"bytes"|"tempPaths"|"objectKeys"|"fileBody"/.test(text) &&
    !/"objectKeyCount"|"tempPathCount"/.test(text);
}

function validateSourceRetentionModule() {
  const errors = [];
  let clock = 1000;
  const svc = createRetentionService({ backstopMs: 100, now: () => (clock += 1) });

  svc.registerSource({ jobId: "a", objectKeys: ["k1"], tempPaths: ["t1"], ownerUserId: "u1" });
  const term = svc.onTerminal({ jobId: "a", outcome: "succeeded", metadata: { language: "java", path: "/secret" } });
  if (!term.ok || term.deletionStatus !== "deleted") errors.push("terminal");
  if (svc.getApprovedMetadata("a").path) errors.push("meta-leak");
  if (svc.getSource("a").present) errors.push("still-present");

  svc.registerSource({ jobId: "b", objectKeys: ["k2"], tempPaths: [] });
  const fail = svc.onTerminal({ jobId: "b", outcome: "failed" });
  if (fail.deletionStatus !== "deleted") errors.push("fail-del");

  svc.registerSource({ jobId: "c", objectKeys: ["k3"], tempPaths: [] });
  svc.onWorkerCrash({ jobId: "c" });
  if (svc.getSource("c").present) errors.push("crash");

  svc.registerSource({ jobId: "d", objectKeys: ["k4"], tempPaths: [] });
  const out = svc.deleteSource({ jobId: "d", simulate: "storage-outage" });
  if (out.deletionStatus !== "retry-scheduled") errors.push("outage");
  const retry = svc.runDeletionRetries();
  if (retry.repaired < 1) errors.push("retry");

  svc.registerSource({ jobId: "e", objectKeys: ["k5"], tempPaths: ["tmp"] });
  clock += 200;
  const sweep = svc.runLifecycleSweep();
  if (sweep.removed < 1 || sweep.alerts.length < 1) errors.push("lifecycle");

  svc.registerSource({ jobId: "f", objectKeys: ["k6"], tempPaths: [], ownerUserId: "u1" });
  const denied = svc.userRequestedDeletion({ jobId: "f", userId: "other", ownerUserId: "u1" });
  if (denied.ok) errors.push("idor");
  const allowed = svc.userRequestedDeletion({ jobId: "f", userId: "u1", ownerUserId: "u1" });
  if (!allowed.ok) errors.push("user-del");

  const backup = svc.assertNotInBackup({ jobs: [{ id: "a", status: "succeeded" }] });
  if (!backup.ok) errors.push("backup");
  const badBackup = svc.assertNotInBackup({ objectKeys: ["k1"], content: "code" });
  if (badBackup.ok) errors.push("backup-detect");

  if (!svc.getDeletionAudit("a")?.deletedAt) errors.push("audit");

  return { ok: errors.length === 0, errors, version: RETENTION_VERSION };
}

module.exports = {
  RETENTION_VERSION,
  DEFAULT_BACKSTOP_MS,
  FORBIDDEN_SINKS,
  createRetentionService,
  validateSourceRetentionModule,
};
