"use strict";

/**
 * Durable job status and polling contract (Prompt 065).
 * Backend job state is authoritative across MV3 suspension and browser restart.
 */

const STATUS_VERSION = 1;

const VISIBLE_STATUSES = Object.freeze([
  "uploading",
  "validating",
  "queued",
  "submitting",
  "waiting",
  "awaiting-report",
  "succeeded",
  "failed",
  "cancel-requested",
  "canceled",
]);

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);

function createJobStatusStore({ now = () => Date.now() } = {}) {
  const jobs = new Map();

  function upsert(row) {
    const prev = jobs.get(row.jobId) || {};
    const next = {
      ...prev,
      ...row,
      updatedAt: now(),
      forgotten: row.forgotten ?? prev.forgotten ?? false,
      queryAccepted: row.queryAccepted ?? prev.queryAccepted ?? false,
    };
    jobs.set(row.jobId, next);
    return { ok: true, job: next };
  }

  function getProjection(jobId, { ownerUserId } = {}) {
    const job = jobs.get(jobId);
    if (!job) return { ok: false, error: "not-found", stopPolling: true };
    if (ownerUserId && job.ownerUserId !== ownerUserId) {
      return { ok: false, error: "unauthorized", stopPolling: true };
    }
    if (job.forgotten) {
      return {
        ok: true,
        jobId,
        status: job.status,
        stage: "forgotten",
        forgotten: true,
        stopPolling: true,
        reportUrl: undefined,
        title: undefined,
      };
    }
    const status = normalizeStatus(job.status);
    return {
      ok: true,
      jobId,
      status,
      stage: job.stage || status,
      stopPolling: TERMINAL.has(status) || status === "cancel-requested" && job.terminalCancel,
      queryAccepted: !!job.queryAccepted,
      authExpiresAt: job.authExpiresAt || null,
      updatedAt: job.updatedAt,
    };
  }

  function requestCancel(jobId, { ownerUserId } = {}) {
    const job = jobs.get(jobId);
    if (!job) return { ok: false, error: "not-found" };
    if (ownerUserId && job.ownerUserId !== ownerUserId) return { ok: false, error: "unauthorized" };
    if (TERMINAL.has(normalizeStatus(job.status))) {
      return { ok: false, error: "already-terminal", stoppedAcceptedQuery: false };
    }
    const queryAccepted = !!job.queryAccepted || job.status === "awaiting-report" || job.status === "submitting";
    job.status = "cancel-requested";
    job.stage = "cancel-requested";
    job.updatedAt = now();
    if (queryAccepted) {
      return {
        ok: true,
        status: "cancel-requested",
        stoppedAcceptedQuery: false,
        message: "Cancel requested; an already-accepted provider query may still complete.",
      };
    }
    job.status = "canceled";
    job.stage = "canceled";
    job.terminalCancel = true;
    return {
      ok: true,
      status: "canceled",
      stoppedAcceptedQuery: false,
      message: "Canceled before provider query acceptance.",
    };
  }

  function markForgotten(jobId, { ownerUserId } = {}) {
    const job = jobs.get(jobId);
    if (!job) return { ok: false, error: "not-found" };
    if (ownerUserId && job.ownerUserId !== ownerUserId) return { ok: false, error: "unauthorized" };
    job.forgotten = true;
    job.updatedAt = now();
    return { ok: true };
  }

  function rotateAuth(jobId, { ownerUserId, expiresAt } = {}) {
    const job = jobs.get(jobId);
    if (!job) return { ok: false, error: "not-found" };
    if (ownerUserId && job.ownerUserId !== ownerUserId) return { ok: false, error: "unauthorized" };
    job.authExpiresAt = expiresAt || now() + 3600_000;
    return { ok: true, authExpiresAt: job.authExpiresAt };
  }

  return { upsert, getProjection, requestCancel, markForgotten, rotateAuth, VISIBLE_STATUSES };
}

function normalizeStatus(status) {
  if (status === "awaiting-report") return "waiting";
  return status;
}

function restoreJobIds({ storage }) {
  const ids = storage?.jobIds;
  if (!Array.isArray(ids)) return [];
  return ids.filter((id) => typeof id === "string" && id.length > 0);
}

function createStatusPoller({
  jobIds,
  ownerUserId,
  fetchStatus,
  onUpdate = () => {},
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  baseBackoffMs = 500,
  maxBackoffMs = 30_000,
} = {}) {
  const active = new Set(jobIds || []);
  let attempt = 0;
  let stopped = false;

  async function tick() {
    if (stopped || active.size === 0) return { ok: true, active: 0 };
    const still = [];
    for (const jobId of active) {
      const proj = await fetchStatus(jobId, { ownerUserId });
      onUpdate(proj);
      if (!proj || proj.ok === false || proj.stopPolling || TERMINAL.has(normalizeStatus(proj.status)) || proj.forgotten) {
        continue;
      }
      still.push(jobId);
    }
    active.clear();
    for (const id of still) active.add(id);
    if (active.size === 0) {
      stopped = true;
      return { ok: true, active: 0, stopped: true };
    }
    const delay = Math.min(maxBackoffMs, baseBackoffMs * 2 ** attempt);
    attempt += 1;
    await sleep(delay);
    return { ok: true, active: active.size, delay };
  }

  function stop() {
    stopped = true;
    active.clear();
  }

  return { tick, stop, getActive: () => [...active] };
}

function buildCompletionNotification(projection) {
  if (!projection?.ok || projection.status !== "succeeded") return null;
  return {
    title: "Similarity check finished",
    message: "Open the workflow to review your report link.",
  };
}

function surfacesAgree(popupView, workspaceView) {
  if (!popupView || !workspaceView) return false;
  return (
    popupView.jobId === workspaceView.jobId &&
    normalizeStatus(popupView.status) === normalizeStatus(workspaceView.status)
  );
}

function validateDurableStatusModule() {
  const errors = [];
  const store = createJobStatusStore();
  store.upsert({ jobId: "j1", ownerUserId: "u", status: "uploading", stage: "upload" });
  const stages = ["validating", "queued", "submitting", "waiting", "succeeded"];
  for (const s of stages) {
    store.upsert({ jobId: "j1", ownerUserId: "u", status: s === "waiting" ? "awaiting-report" : s, stage: s });
  }
  const proj = store.getProjection("j1", { ownerUserId: "u" });
  if (proj.status !== "succeeded" || !proj.stopPolling) errors.push("terminal");

  store.upsert({ jobId: "j2", ownerUserId: "u", status: "queued", stage: "queued" });
  const early = store.requestCancel("j2", { ownerUserId: "u" });
  if (early.status !== "canceled") errors.push("early-cancel");

  store.upsert({ jobId: "j3", ownerUserId: "u", status: "awaiting-report", stage: "waiting", queryAccepted: true });
  const late = store.requestCancel("j3", { ownerUserId: "u" });
  if (late.stoppedAcceptedQuery !== false || !/may still complete/i.test(late.message)) errors.push("late-cancel");

  const note = buildCompletionNotification({ ok: true, status: "succeeded", title: "Secret Lab", reportUrl: "https://x" });
  if (!note || /Secret|https/.test(note.title + note.message)) errors.push("notify");

  if (!surfacesAgree({ jobId: "j1", status: "waiting" }, { jobId: "j1", status: "awaiting-report" })) {
    errors.push("agree");
  }

  const ids = restoreJobIds({ storage: { jobIds: ["a", "b"] } });
  if (ids.length !== 2) errors.push("restore");

  return { ok: errors.length === 0, errors, version: STATUS_VERSION };
}

module.exports = {
  STATUS_VERSION,
  VISIBLE_STATUSES,
  TERMINAL,
  createJobStatusStore,
  createStatusPoller,
  restoreJobIds,
  buildCompletionNotification,
  surfacesAgree,
  validateDurableStatusModule,
};
