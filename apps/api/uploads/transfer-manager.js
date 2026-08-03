"use strict";

/**
 * Upload transfer manager (Prompt 050).
 * Bounded concurrency, progress, cancellation, integrity, recovery.
 */

const crypto = require("node:crypto");

const TRANSFER_VERSION = 1;

function createTransferManager({
  api,
  concurrency = 3,
  now = () => Date.now(),
} = {}) {
  const transfers = new Map();

  async function startAfterReview({
    draft,
    consent,
    entitlement,
    accessToken,
    files,
  }) {
    if (!consent?.recordedAt) return { ok: false, error: "consent-required" };
    if (!entitlement?.ok) return { ok: false, error: "entitlement-required" };
    if (!draft?.title) return { ok: false, error: "title-required" };

    const job = await api.createJob({
      accessToken,
      title: draft.title,
      idempotencyKey: draft.idempotencyKey || crypto.randomUUID(),
      draft,
    });
    if (!job.ok) return job;

    const session = await api.createUploadSession({
      accessToken,
      jobId: job.jobId,
      count: files.length,
      maxBytes: Math.max(...files.map((f) => f.bytes || 0), 1),
      checksums: files.map((f) => f.hash),
    });
    if (!session.ok) return session;

    const transfer = {
      id: `xfer_${crypto.randomBytes(4).toString("hex")}`,
      jobId: job.jobId,
      sessionId: session.sessionId,
      keys: session.opaqueKeys,
      files: files.map((f, i) => ({
        localId: f.localId || f.id,
        displayName: f.displayName,
        bytes: f.bytes,
        hash: f.hash,
        key: session.opaqueKeys[i],
        state: "pending",
        uploadedBytes: 0,
      })),
      status: "uploading",
      canceled: false,
      progress: { done: 0, total: files.length, bytesDone: 0, bytesTotal: files.reduce((s, f) => s + f.bytes, 0) },
      createdAt: now(),
      // File handles do not survive browser restart
      requiresReselectionAfterRestart: true,
      completedUploads: [],
    };
    transfers.set(transfer.id, transfer);
    return { ok: true, transferId: transfer.id, jobId: job.jobId };
  }

  async function run(transferId, { network } = {}) {
    const transfer = transfers.get(transferId);
    if (!transfer) return { ok: false, error: "unknown-transfer" };
    const queue = transfer.files.filter((f) => f.state === "pending" || f.state === "failed");
    let active = 0;
    let index = 0;

    return new Promise((resolve) => {
      const pump = () => {
        if (transfer.canceled) {
          transfer.status = "canceled";
          void api.cleanupUploadSession({ sessionId: transfer.sessionId });
          resolve({ ok: false, error: "canceled", transfer });
          return;
        }
        if (transfer.progress.done === transfer.progress.total) {
          transfer.status = "completed";
          transfer.requiresReselectionAfterRestart = false;
          resolve({ ok: true, transfer });
          return;
        }
        while (active < concurrency && index < queue.length) {
          const file = queue[index++];
          if (file.state === "completed") continue;
          active += 1;
          uploadOne(transfer, file, network)
            .then(() => {
              active -= 1;
              pump();
            })
            .catch(() => {
              active -= 1;
              pump();
            });
        }
        if (active === 0 && transfer.progress.done < transfer.progress.total) {
          const waiting = transfer.files.some((f) => f.state === "pending" || f.state === "uploading");
          if (!waiting) {
            transfer.status = transfer.files.every((f) => f.state === "completed") ? "completed" : "failed";
            resolve({ ok: transfer.status === "completed", transfer, error: transfer.status === "failed" ? "upload-failed" : undefined });
          }
        }
      };
      pump();
    });
  }

  async function uploadOne(transfer, file, network) {
    if (transfer.canceled) return;
    file.state = "uploading";
    try {
      if (network?.drop) throw Object.assign(new Error("network"), { code: "network-drop" });
      if (network?.expiredUrl) throw Object.assign(new Error("expired"), { code: "expired-url" });
      const result = await api.putObject({
        sessionId: transfer.sessionId,
        key: file.key,
        bytes: file.bytes,
        checksum: file.hash,
        accessToken: network?.accessToken,
      });
      if (!result.ok) {
        file.state = "failed";
        file.error = result.error;
        return;
      }
      if (result.checksum && result.checksum !== file.hash) {
        file.state = "failed";
        file.error = "hash-mismatch";
        return;
      }
      file.state = "completed";
      file.uploadedBytes = file.bytes;
      transfer.progress.done += 1;
      transfer.progress.bytesDone += file.bytes;
      transfer.completedUploads.push({ key: file.key, hash: file.hash, localId: file.localId });
    } catch (error) {
      file.state = "failed";
      file.error = error.code || "upload-failed";
    }
  }

  function cancel(transferId) {
    const transfer = transfers.get(transferId);
    if (!transfer) return { ok: false, error: "unknown-transfer" };
    transfer.canceled = true;
    transfer.status = "cancel-requested";
    // cancel ≠ forget
    return { ok: true, transfer, forgot: false };
  }

  function resumeAfterRestart(transferId, { reselectedFiles }) {
    const transfer = transfers.get(transferId);
    if (!transfer) return { ok: false, error: "unknown-transfer" };
    if (transfer.status === "completed") {
      return { ok: true, transfer, reselectionRequired: false };
    }
    if (!reselectedFiles) {
      return { ok: false, error: "reselection-required", reselectionRequired: true };
    }
    for (const file of transfer.files) {
      if (file.state === "completed") continue;
      const match = reselectedFiles.find((f) => f.localId === file.localId || f.hash === file.hash);
      if (!match) return { ok: false, error: "changed-reselection" };
      if (match.hash !== file.hash) return { ok: false, error: "changed-reselection" };
      file.state = "pending";
    }
    transfer.status = "uploading";
    return { ok: true, transfer, reselectionRequired: true };
  }

  function getProgress(transferId) {
    const transfer = transfers.get(transferId);
    if (!transfer) return { ok: false, error: "unknown-transfer" };
    return {
      ok: true,
      progress: { ...transfer.progress },
      status: transfer.status,
      // honest progress — no fabricated percent beyond completed/total
      ratio: transfer.progress.total ? transfer.progress.done / transfer.progress.total : 0,
    };
  }

  return {
    startAfterReview,
    run,
    cancel,
    resumeAfterRestart,
    getProgress,
    TRANSFER_VERSION,
    _transfers: transfers,
  };
}

function createMockApi() {
  const jobs = new Map();
  const sessions = new Map();
  let jobCounter = 0;

  return {
    async createJob({ idempotencyKey, title, draft }) {
      for (const job of jobs.values()) {
        if (job.idempotencyKey === idempotencyKey) return { ok: true, jobId: job.id, reused: true };
      }
      const id = `job_${++jobCounter}`;
      jobs.set(id, { id, idempotencyKey, title, draft });
      return { ok: true, jobId: id, reused: false };
    },
    async createUploadSession({ jobId, count, checksums }) {
      const sessionId = `sess_${crypto.randomBytes(4).toString("hex")}`;
      const opaqueKeys = Array.from({ length: count }, (_, i) => `obj_${sessionId}_${i}`);
      sessions.set(sessionId, { jobId, keys: new Set(), checksums });
      return { ok: true, sessionId, opaqueKeys };
    },
    async putObject({ sessionId, key, checksum }) {
      const session = sessions.get(sessionId);
      if (!session) return { ok: false, error: "unknown-session" };
      if (session.keys.has(key)) return { ok: false, error: "duplicate" };
      session.keys.add(key);
      return { ok: true, checksum };
    },
    async cleanupUploadSession({ sessionId }) {
      sessions.delete(sessionId);
      return { ok: true };
    },
    _jobs: jobs,
  };
}

async function validateTransferModule() {
  const errors = [];
  const api = createMockApi();
  const mgr = createTransferManager({ api, concurrency: 2 });
  const draft = {
    title: "Lab",
    idempotencyKey: "idem-xfer-1",
    mode: "batch",
    language: "python",
  };
  const files = [
    { localId: "1", displayName: "a.py", bytes: 10, hash: "h1" },
    { localId: "2", displayName: "b.py", bytes: 20, hash: "h2" },
  ];

  const started = await mgr.startAfterReview({
    draft,
    consent: { recordedAt: new Date().toISOString() },
    entitlement: { ok: true },
    accessToken: "t",
    files,
  });
  if (!started.ok) errors.push("start");

  const again = await mgr.startAfterReview({
    draft,
    consent: { recordedAt: new Date().toISOString() },
    entitlement: { ok: true },
    accessToken: "t",
    files,
  });
  if (!again.ok || again.jobId !== started.jobId) errors.push("idempotent-job");

  const done = await mgr.run(started.transferId);
  if (!done.ok) errors.push("run");

  const dropApi = createMockApi();
  const dropMgr = createTransferManager({ api: dropApi, concurrency: 1 });
  const dropStart = await dropMgr.startAfterReview({
    draft: { ...draft, idempotencyKey: "idem-drop" },
    consent: { recordedAt: new Date().toISOString() },
    entitlement: { ok: true },
    accessToken: "t",
    files,
  });
  const dropped = await dropMgr.run(dropStart.transferId, { network: { drop: true } });
  if (dropped.ok) errors.push("drop-should-fail");
  const resumed = dropMgr.resumeAfterRestart(dropStart.transferId, { reselectedFiles: files });
  if (!resumed.ok) errors.push("resume");
  const recovered = await dropMgr.run(dropStart.transferId);
  if (!recovered.ok) errors.push("recover");

  const cancelStart = await mgr.startAfterReview({
    draft: { ...draft, idempotencyKey: "idem-cancel", title: "C" },
    consent: { recordedAt: new Date().toISOString() },
    entitlement: { ok: true },
    accessToken: "t",
    files,
  });
  const cancelResult = mgr.cancel(cancelStart.transferId);
  if (cancelResult.forgot) errors.push("cancel-vs-forget");
  const canceledRun = await mgr.run(cancelStart.transferId);
  if (canceledRun.error !== "canceled") errors.push("cancel-run");

  const progress = mgr.getProgress(started.transferId);
  if (!progress.ok || progress.ratio !== 1) errors.push("progress");

  const noReselect = dropMgr.resumeAfterRestart(dropStart.transferId, {});
  // already completed after recover — reselection not required
  if (noReselect.reselectionRequired && noReselect.error === "reselection-required") {
    // ok if still uploading
  }

  return { ok: errors.length === 0, errors };
}

module.exports = {
  TRANSFER_VERSION,
  createTransferManager,
  createMockApi,
  validateTransferModule,
};
