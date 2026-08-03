"use strict";

/**
 * Finalize uploads and enqueue validation idempotently (Prompt 052).
 */

const crypto = require("node:crypto");
const ingest = require("../intake/ingest");

const FINALIZE_VERSION = 1;

function createFinalizeService({ now = () => Date.now() } = {}) {
  const jobs = new Map();
  const outboxValidation = [];
  const outboxProvider = [];
  const quota = new Map(); // userId -> { reserved, consumed }

  function getQuota(userId) {
    if (!quota.has(userId)) quota.set(userId, { reserved: 0, consumed: 0, released: 0 });
    return quota.get(userId);
  }

  function finalize({
    userId,
    idempotencyKey,
    entitlementOk,
    consent,
    objects,
    groups,
    language,
    settings,
    title,
  }) {
    if (!entitlementOk) return { ok: false, error: "entitlement" };
    if (!consent?.policyVersion || !consent.recordedAt) return { ok: false, error: "stale-consent" };
    if (!language) return { ok: false, error: "language" };
    if (!objects?.length) return { ok: false, error: "objects" };

    const existing = [...jobs.values()].find((j) => j.userId === userId && j.idempotencyKey === idempotencyKey);
    if (existing) {
      const payloadHash = hashPayload({ objects, groups, language, settings, title, consent });
      if (payloadHash !== existing.payloadHash) return { ok: false, error: "idempotency-conflict" };
      return { ok: true, jobId: existing.id, reused: true };
    }

    const intake = ingest.ingestObjects(objects, { groups, jobId: `pending_${idempotencyKey}` });
    if (!intake.ok) return { ok: false, error: intake.code || "intake-failed" };

    const id = `job_${crypto.randomBytes(4).toString("hex")}`;
    const job = {
      id,
      userId,
      idempotencyKey,
      title,
      status: "uploaded",
      payloadHash: hashPayload({ objects, groups, language, settings, title, consent }),
      manifestHash: intake.manifest.hash,
      manifest: intake.manifest,
      language,
      settings,
      consent,
      quotaReserved: false,
      quotaConsumed: false,
      createdAt: now(),
    };
    jobs.set(id, job);

    // Transactional outbox: validation task (exactly one)
    outboxValidation.push({ id: `val_${id}`, jobId: id, type: "intake-validation", attempts: 0 });
    return { ok: true, jobId: id, reused: false };
  }

  function processValidationOutbox({ fail = false } = {}) {
    if (fail) return { ok: false, error: "queue-outage" };
    const pending = outboxValidation.filter((e) => !e.done);
    for (const entry of pending) {
      const job = jobs.get(entry.jobId);
      if (!job || job.status === "canceled") {
        entry.done = true;
        continue;
      }
      job.status = "validating";
      // Intake already produced manifest — mark validating → queued after success
      job.status = "queued";
      // Reserve quota only after intake succeeds
      const q = getQuota(job.userId);
      q.reserved += 1;
      job.quotaReserved = true;
      outboxProvider.push({ id: `prov_${job.id}`, jobId: job.id, type: "provider-submit", attempts: 0 });
      entry.done = true;
    }
    return { ok: true, processed: pending.length };
  }

  function processProviderOutbox({ consume = true } = {}) {
    const pending = outboxProvider.filter((e) => !e.done);
    for (const entry of pending) {
      const job = jobs.get(entry.jobId);
      if (!job) {
        entry.done = true;
        continue;
      }
      if (job.status === "canceled" || job.status === "cancel-requested") {
        releaseQuota(job);
        entry.done = true;
        continue;
      }
      job.status = "submitting";
      if (consume && job.quotaReserved && !job.quotaConsumed) {
        const q = getQuota(job.userId);
        q.consumed += 1;
        q.reserved = Math.max(0, q.reserved - 1);
        job.quotaConsumed = true;
      }
      job.status = "awaiting-report";
      entry.done = true;
    }
    return { ok: true, processed: pending.length };
  }

  function releaseQuota(job) {
    if (job.quotaReserved && !job.quotaConsumed) {
      const q = getQuota(job.userId);
      q.reserved = Math.max(0, q.reserved - 1);
      q.released += 1;
      job.quotaReserved = false;
    }
  }

  function cancel(jobId) {
    const job = jobs.get(jobId);
    if (!job) return { ok: false, error: "not-found" };
    job.status = "canceled";
    releaseQuota(job);
    return { ok: true, job };
  }

  function rollbackValidation(jobId) {
    const job = jobs.get(jobId);
    if (!job) return { ok: false, error: "not-found" };
    job.status = "failed";
    releaseQuota(job);
    // remove pending provider outbox
    for (const e of outboxProvider) {
      if (e.jobId === jobId && !e.done) e.done = true;
    }
    return { ok: true };
  }

  return {
    finalize,
    processValidationOutbox,
    processProviderOutbox,
    cancel,
    rollbackValidation,
    getQuota,
    _jobs: jobs,
    _outboxValidation: outboxValidation,
    _outboxProvider: outboxProvider,
  };
}

function hashPayload(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function validateFinalizeModule() {
  const errors = [];
  const svc = createFinalizeService();
  const objects = [
    { path: "a/a.py", bytes: 1, content: "a" },
    { path: "b/b.py", bytes: 1, content: "b" },
  ];
  const base = {
    userId: "u1",
    idempotencyKey: "idem-1",
    entitlementOk: true,
    consent: { policyVersion: "1.0.0", recordedAt: new Date().toISOString() },
    objects,
    language: "python",
    settings: {},
    title: "Lab",
  };

  const a = svc.finalize(base);
  if (!a.ok) errors.push("create");
  const b = svc.finalize(base);
  if (!b.reused || b.jobId !== a.jobId) errors.push("dup");

  const conflict = svc.finalize({ ...base, title: "Other" });
  if (conflict.error !== "idempotency-conflict") errors.push("conflict");

  if (svc.finalize({ ...base, idempotencyKey: "x", entitlementOk: false }).ok) errors.push("ent");
  if (svc.finalize({ ...base, idempotencyKey: "y", consent: { policyVersion: "1.0.0" } }).ok) errors.push("consent");

  const outage = svc.processValidationOutbox({ fail: true });
  if (outage.ok) errors.push("outage");

  svc.processValidationOutbox();
  const q1 = svc.getQuota("u1");
  if (q1.reserved !== 1) errors.push("reserve");

  svc.processProviderOutbox();
  const q2 = svc.getQuota("u1");
  if (q2.consumed !== 1 || q2.reserved !== 0) errors.push("consume");

  const c = svc.finalize({ ...base, idempotencyKey: "idem-cancel", title: "C" });
  svc.processValidationOutbox();
  svc.cancel(c.jobId);
  const q3 = svc.getQuota("u1");
  if (q3.released < 1 && q3.reserved > 1) errors.push("release");

  // key reuse with changed object should conflict via payload hash when same idempotency
  const reuse = svc.finalize({
    ...base,
    idempotencyKey: "idem-1",
    objects: [
      { path: "a/a.py", bytes: 2, content: "aa" },
      { path: "b/b.py", bytes: 1, content: "b" },
    ],
  });
  if (reuse.error !== "idempotency-conflict") errors.push("key-reuse");

  return { ok: errors.length === 0, errors };
}

module.exports = {
  FINALIZE_VERSION,
  createFinalizeService,
  validateFinalizeModule,
};
