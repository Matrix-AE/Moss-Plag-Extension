"use strict";

/**
 * In-memory pair-check job service for the local loopback API.
 * Composes vault + results metadata + live/mock MOSS submit.
 */

const crypto = require("node:crypto");
const { createCredentialVault } = require("../credentials/vault");
const { createResultStore } = require("../results/metadata");

const PAIR_SERVICE_VERSION = 1;
const MAX_PAIR_FILES = 2;
const MAX_BATCH_FILES = 50;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

function createPairService({
  now = () => Date.now(),
  submitPair,
  masterKey = crypto.randomBytes(32),
  encryptionKey = crypto.randomBytes(32),
} = {}) {
  if (typeof submitPair !== "function") {
    throw new Error("submitPair-required");
  }

  const vault = createCredentialVault({ masterKey, now });
  const results = createResultStore({ encryptionKey, now });
  const jobs = new Map();
  const idempotency = new Map();

  function createJob({ ownerUserId, idempotencyKey, language, mode = "pair", settings = {} }) {
    if (!ownerUserId) return { ok: false, error: "owner-required", status: 400 };
    if (mode !== "pair" && mode !== "batch") {
      return { ok: false, error: "unsupported-mode", status: 400 };
    }
    if (!language) return { ok: false, error: "language-required", status: 400 };
    if (idempotencyKey && idempotency.has(idempotencyKey)) {
      const existingId = idempotency.get(idempotencyKey);
      const existing = jobs.get(existingId);
      return { ok: true, job: publicJob(existing), reused: true };
    }
    const jobId = `job_${crypto.randomBytes(8).toString("hex")}`;
    const job = {
      jobId,
      ownerUserId,
      language,
      mode,
      settings: {
        commonMatchThreshold: settings.commonMatchThreshold ?? 10,
        resultCount: settings.resultCount ?? 250,
        reportLabel: String(settings.reportLabel || (mode === "batch" ? "batch-check" : "pair-check")).slice(
          0,
          80,
        ),
      },
      status: "draft",
      phase: "validate",
      files: [],
      directoryMode: 0,
      credentialId: null,
      reportUrlRef: null,
      failureCode: null,
      failureMessage: null,
      providerStage: "created",
      submitted: false,
      createdAt: now(),
      updatedAt: now(),
    };
    jobs.set(jobId, job);
    if (idempotencyKey) idempotency.set(idempotencyKey, jobId);
    return { ok: true, job: publicJob(job), reused: false };
  }

  function attachCredential({ jobId, ownerUserId, mossUserId }) {
    const job = requireOwner(jobId, ownerUserId);
    if (!job.ok) return job;
    if (!/^[0-9]{3,}$/.test(String(mossUserId || ""))) {
      return { ok: false, error: "invalid-userid", status: 400 };
    }
    const stored = vault.store({
      tenantId: ownerUserId,
      mossUserId: String(mossUserId),
      actor: "extension-handoff",
    });
    if (!stored.ok) return { ok: false, error: stored.error || "vault", status: 400 };
    job.value.credentialId = stored.id;
    job.value.updatedAt = now();
    return { ok: true, job: publicJob(job.value), display: stored.display };
  }

  function uploadFiles({ jobId, ownerUserId, files }) {
    const job = requireOwner(jobId, ownerUserId);
    if (!job.ok) return job;
    if (!["draft", "ready", "uploading"].includes(job.value.status)) {
      return { ok: false, error: "invalid-status", status: 409 };
    }
    const list = Array.isArray(files) ? files : [];
    const maxFiles = job.value.mode === "batch" ? MAX_BATCH_FILES : MAX_PAIR_FILES;
    const minFiles = 2;
    if (list.length < minFiles || list.length > maxFiles) {
      return {
        ok: false,
        error: job.value.mode === "batch" ? "batch-file-count" : "pair-requires-two-files",
        status: 400,
      };
    }
    const normalized = [];
    for (let i = 0; i < list.length; i += 1) {
      const file = list[i];
      const name = sanitizeName(file.displayName || file.name);
      const bytes = toBuffer(file.bytes || file.content || file.data);
      if (!name || !bytes || bytes.length === 0) {
        return { ok: false, error: "empty-file", status: 400 };
      }
      if (bytes.length > MAX_FILE_BYTES) {
        return { ok: false, error: "oversized", status: 400 };
      }
      const submissionId = Number(file.submissionId);
      normalized.push({
        displayName: name,
        bytes,
        submissionId:
          Number.isInteger(submissionId) && submissionId >= 1 ? submissionId : i + 1,
      });
    }
    if (job.value.mode === "pair" && normalized.length !== MAX_PAIR_FILES) {
      return { ok: false, error: "pair-requires-two-files", status: 400 };
    }
    const distinctIds = new Set(normalized.map((f) => f.submissionId));
    if (distinctIds.size < 2) {
      return { ok: false, error: "insufficient-submissions", status: 400 };
    }
    const directoryMode = normalized.some(
      (f, _i, arr) => arr.filter((other) => other.submissionId === f.submissionId).length > 1,
    )
      ? 1
      : 0;
    job.value.files = normalized;
    job.value.directoryMode = directoryMode;
    job.value.status = "ready";
    job.value.phase = "upload";
    job.value.updatedAt = now();
    return { ok: true, job: publicJob(job.value), fileCount: normalized.length };
  }

  async function finalize({ jobId, ownerUserId }) {
    const job = requireOwner(jobId, ownerUserId);
    if (!job.ok) return job;
    const row = job.value;
    if (!row.credentialId) return { ok: false, error: "credential-required", status: 400 };
    const minFiles = 2;
    const maxFiles = row.mode === "batch" ? MAX_BATCH_FILES : MAX_PAIR_FILES;
    if (!row.files || row.files.length < minFiles || row.files.length > maxFiles) {
      return { ok: false, error: "files-required", status: 400 };
    }
    if (["succeeded", "failed", "cancelled", "ambiguous"].includes(row.status)) {
      return { ok: true, job: publicJob(row), alreadyTerminal: true };
    }

    row.status = "queued";
    row.phase = "queue";
    row.updatedAt = now();

    // Fire-and-forget submission; status polled via GET.
    void runSubmission(row);

    return { ok: true, job: publicJob(row) };
  }

  async function runSubmission(row) {
    row.status = "submitting";
    row.phase = "submit";
    row.providerStage = "starting";
    row.updatedAt = now();

    const lease = {
      valid: true,
      tenantId: row.ownerUserId,
      jobId: row.jobId,
    };
    const decrypted = vault.decryptForSubmission({
      credentialId: row.credentialId,
      tenantId: row.ownerUserId,
      workerIdentity: "submission-worker",
      jobLease: lease,
    });
    if (!decrypted.ok) {
      row.status = "failed";
      row.phase = "failure";
      row.failureCode = "credential";
      row.failureMessage = "Could not unlock Moss credentials for submission.";
      row.updatedAt = now();
      return;
    }

    row.status = "waiting";
    row.phase = "wait";
    row.providerStage = "waiting-for-provider";
    row.submitted = true;
    row.updatedAt = now();

    let outcome;
    try {
      outcome = await submitPair({
        mossUserId: decrypted.mossUserId,
        language: row.language,
        mode: row.mode,
        directoryMode: row.directoryMode || 0,
        files: row.files.map((f) => ({
          displayName: f.displayName,
          bytes: f.bytes,
          submissionId: f.submissionId,
        })),
        settings: row.settings,
        comment: row.settings.reportLabel,
        onStage: (stage) => {
          row.providerStage = String(stage).slice(0, 64);
          row.updatedAt = now();
          // Deliberately exclude credentials, source names, and report URLs.
          console.log(`[moss-pair-api] job=${row.jobId} provider-stage=${row.providerStage}`);
        },
      });
    } catch (error) {
      outcome = {
        ok: false,
        code: "generic-failure",
        message: error.message || "submit failed",
        quotaAction: "hold",
      };
    }

    // Drop plaintext file buffers after attempt.
    row.files = row.files.map((f) => ({
      displayName: f.displayName,
      bytes: null,
      size: f.bytes ? f.bytes.length : 0,
      submissionId: f.submissionId,
    }));

    if (!outcome.ok) {
      const hold = outcome.quotaAction === "hold" || outcome.quotaAction === "consume";
      row.status = hold || row.submitted ? "ambiguous" : "failed";
      row.phase = row.status === "ambiguous" ? "timeout" : "failure";
      row.failureCode = outcome.code || "generic-failure";
      row.failureMessage = outcome.message || "Submission failed.";
      row.providerStage = `failed-${String(outcome.phase || outcome.code || "unknown").slice(0, 48)}`;
      row.updatedAt = now();
      return;
    }

    const saved = results.saveResult({
      jobId: row.jobId,
      ownerUserId: row.ownerUserId,
      reportUrl: outcome.reportUrl,
      language: row.language,
      mode: row.mode,
      entitlementOk: true,
      status: "succeeded",
    });
    if (!saved.ok) {
      row.status = "ambiguous";
      row.phase = "timeout";
      row.failureCode = "invalid-url";
      row.failureMessage = "Provider returned a result that could not be stored safely.";
      row.updatedAt = now();
      return;
    }

    row.status = "succeeded";
    row.phase = "success";
    row.providerStage = "completed";
    row.reportUrlRef = `ref_${row.jobId}`;
    row.availabilityEstimate = saved.estimate;
    row.updatedAt = now();
  }

  function getJob({ jobId, ownerUserId }) {
    const job = requireOwner(jobId, ownerUserId);
    if (!job.ok) return job;
    const projection = results.getResult(jobId, { ownerUserId });
    return {
      ok: true,
      job: {
        ...publicJob(job.value),
        reportUrlAvailable: projection.ok ? projection.projection.reportUrlAvailable : false,
        availabilityEstimate: projection.ok
          ? projection.projection.availabilityEstimate
          : job.value.availabilityEstimate || null,
      },
    };
  }

  function revealResult({ jobId, ownerUserId }) {
    const job = requireOwner(jobId, ownerUserId);
    if (!job.ok) return job;
    if (job.value.status !== "succeeded") {
      return { ok: false, error: "not-ready", status: 409 };
    }
    const revealed = results.revealUrl(jobId, { ownerUserId });
    if (!revealed.ok) return { ok: false, error: revealed.error, status: 404 };
    return { ok: true, reportUrl: revealed.reportUrl, reportUrlRef: job.value.reportUrlRef };
  }

  function forgetResult({ jobId, ownerUserId }) {
    const job = requireOwner(jobId, ownerUserId);
    if (!job.ok) return job;
    const forgotten = results.forgetUrl(jobId, { ownerUserId });
    if (!forgotten.ok) return { ok: false, error: forgotten.error, status: 404 };
    return { ok: true, ...forgotten };
  }

  function requireOwner(jobId, ownerUserId) {
    const row = jobs.get(jobId);
    if (!row) return { ok: false, error: "not-found", status: 404 };
    if (row.ownerUserId !== ownerUserId) return { ok: false, error: "idor", status: 403 };
    return { ok: true, value: row };
  }

  function publicJob(row) {
    return {
      jobId: row.jobId,
      ownerUserId: row.ownerUserId,
      language: row.language,
      mode: row.mode,
      status: row.status,
      phase: row.phase,
      reportUrlRef: row.reportUrlRef,
      failureCode: row.failureCode,
      failureMessage: row.failureMessage,
      providerStage: row.providerStage,
      submitted: row.submitted,
      fileCount: Array.isArray(row.files) ? row.files.length : 0,
      hasCredential: Boolean(row.credentialId),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  return {
    PAIR_SERVICE_VERSION,
    createJob,
    attachCredential,
    uploadFiles,
    finalize,
    getJob,
    revealResult,
    forgetResult,
  };
}

function sanitizeName(name) {
  return String(name || "file")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "_")
    .slice(0, 128);
}

function toBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") {
    // Accept base64 (preferred) or utf8 fallback when content looks plain.
    if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.length % 4 === 0) {
      try {
        return Buffer.from(value, "base64");
      } catch {
        /* fall through */
      }
    }
    return Buffer.from(value, "utf8");
  }
  return null;
}

module.exports = {
  PAIR_SERVICE_VERSION,
  MAX_FILES: MAX_PAIR_FILES,
  MAX_PAIR_FILES,
  MAX_BATCH_FILES,
  MAX_FILE_BYTES,
  createPairService,
};
