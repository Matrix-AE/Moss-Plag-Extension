"use strict";

/**
 * Job persistence and guarded state transitions (Prompt 047).
 * In-memory repository mirrors the migration contract for offline tests.
 */

const { JOB_STATUSES } = require("../../../packages/contracts/openapi");

const JOB_SCHEMA_VERSION = 1;

const TRANSITIONS = Object.freeze({
  draft: ["uploading", "canceled"],
  uploading: ["uploaded", "failed", "cancel-requested"],
  uploaded: ["validating", "failed", "cancel-requested"],
  validating: ["queued", "failed", "cancel-requested"],
  queued: ["submitting", "failed", "cancel-requested"],
  submitting: ["awaiting-report", "failed", "cancel-requested"],
  "awaiting-report": ["succeeded", "failed", "cancel-requested"],
  succeeded: [],
  failed: [],
  "cancel-requested": ["canceled", "failed"],
  canceled: [],
});

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);

function createMigrationPlan() {
  return {
    version: JOB_SCHEMA_VERSION,
    tables: {
      jobs: {
        columns: [
          "id",
          "owner_user_id",
          "device_id",
          "status",
          "manifest_hash",
          "manifest_immutable",
          "report_available",
          "report_available_at",
          "idempotency_key",
          "title",
          "created_at",
          "updated_at",
          "version",
        ],
        constraints: ["primary key id", "unique (owner_user_id, idempotency_key)", "check status in known set"],
      },
      job_events: {
        columns: ["id", "job_id", "from_status", "to_status", "at", "actor"],
      },
    },
  };
}

function createRepository() {
  const jobs = new Map();
  const events = [];

  function createJob({ ownerUserId, deviceId, idempotencyKey, title, manifest }) {
    const existing = [...jobs.values()].find(
      (j) => j.ownerUserId === ownerUserId && j.idempotencyKey === idempotencyKey,
    );
    if (existing) return { ok: true, job: existing, reused: true };
    const job = {
      id: `job_${jobs.size + 1}`,
      ownerUserId,
      deviceId,
      status: "draft",
      manifestHash: hashManifest(manifest),
      manifestImmutable: Object.freeze(JSON.parse(JSON.stringify(manifest))),
      reportAvailable: false,
      reportAvailableAt: null,
      idempotencyKey,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 0,
      quotaReserved: false,
    };
    jobs.set(job.id, job);
    events.push({ jobId: job.id, from: null, to: "draft", at: job.createdAt });
    return { ok: true, job, reused: false };
  }

  function getJob(jobId, { ownerUserId } = {}) {
    const job = jobs.get(jobId);
    if (!job) return { ok: false, error: "not-found" };
    if (ownerUserId && job.ownerUserId !== ownerUserId) return { ok: false, error: "tenant-isolation" };
    return { ok: true, job: { ...job } };
  }

  function transition(jobId, toStatus, { ownerUserId, expectedVersion, actor = "system" } = {}) {
    const job = jobs.get(jobId);
    if (!job) return { ok: false, error: "not-found" };
    if (ownerUserId && job.ownerUserId !== ownerUserId) return { ok: false, error: "tenant-isolation" };
    if (expectedVersion != null && job.version !== expectedVersion) {
      return { ok: false, error: "version-conflict" };
    }
    if (TERMINAL.has(job.status)) return { ok: false, error: "terminal-no-reprocess" };
    const allowed = TRANSITIONS[job.status] || [];
    if (!allowed.includes(toStatus)) {
      return { ok: false, error: "invalid-transition", from: job.status, to: toStatus };
    }
    if (toStatus === "canceled" && !["cancel-requested", "draft"].includes(job.status) && job.status !== "draft") {
      // handled by table
    }
    const from = job.status;
    job.status = toStatus;
    job.version += 1;
    job.updatedAt = Date.now();
    if (toStatus === "succeeded") {
      // report availability is separate metadata
      job.reportAvailable = false;
    }
    events.push({ jobId, from, to: toStatus, at: job.updatedAt, actor });
    return { ok: true, job: { ...job } };
  }

  function requestCancel(jobId, { ownerUserId } = {}) {
    const current = getJob(jobId, { ownerUserId });
    if (!current.ok) return current;
    if (TERMINAL.has(current.job.status)) {
      return { ok: false, error: "late-cancellation", status: current.job.status };
    }
    if (current.job.status === "draft") {
      return transition(jobId, "canceled", { ownerUserId, actor: "user" });
    }
    return transition(jobId, "cancel-requested", { ownerUserId, actor: "user" });
  }

  function setReportAvailability(jobId, available, { at = Date.now() } = {}) {
    const job = jobs.get(jobId);
    if (!job) return { ok: false, error: "not-found" };
    job.reportAvailable = Boolean(available);
    job.reportAvailableAt = available ? at : null;
    return { ok: true, job: { ...job } };
  }

  function assertManifestImmutable(jobId, nextManifest) {
    const job = jobs.get(jobId);
    if (!job) return { ok: false, error: "not-found" };
    if (hashManifest(nextManifest) !== job.manifestHash) {
      return { ok: false, error: "manifest-immutable" };
    }
    return { ok: true };
  }

  return {
    createJob,
    getJob,
    transition,
    requestCancel,
    setReportAvailability,
    assertManifestImmutable,
    _events: events,
    _jobs: jobs,
  };
}

function hashManifest(manifest) {
  return `m_${JSON.stringify(manifest)}`;
}

function validateJobModule() {
  const errors = [];
  const plan = createMigrationPlan();
  if (!plan.tables.jobs) errors.push("migration");

  const repo = createRepository();
  const created = repo.createJob({
    ownerUserId: "u1",
    deviceId: "d1",
    idempotencyKey: "idem-1",
    title: "Lab",
    manifest: { groups: 2 },
  });
  const again = repo.createJob({
    ownerUserId: "u1",
    deviceId: "d1",
    idempotencyKey: "idem-1",
    title: "Lab",
    manifest: { groups: 2 },
  });
  if (!again.reused) errors.push("idempotent");

  let job = created.job;
  const steps = ["uploading", "uploaded", "validating", "queued", "submitting", "awaiting-report", "succeeded"];
  for (const step of steps) {
    const r = repo.transition(job.id, step, { ownerUserId: "u1", expectedVersion: job.version });
    if (!r.ok) errors.push(`step-${step}`);
    else job = r.job;
  }
  if (repo.transition(job.id, "queued", { ownerUserId: "u1" }).ok) errors.push("terminal");

  const other = repo.getJob(job.id, { ownerUserId: "u2" });
  if (other.error !== "tenant-isolation") errors.push("tenant");

  const j2 = repo.createJob({
    ownerUserId: "u1",
    deviceId: "d1",
    idempotencyKey: "idem-2",
    title: "B",
    manifest: { groups: 2 },
  }).job;
  repo.transition(j2.id, "uploading", { ownerUserId: "u1" });
  const cancel = repo.requestCancel(j2.id, { ownerUserId: "u1" });
  if (!cancel.ok || cancel.job.status !== "cancel-requested") errors.push("cancel");

  const j3 = repo.createJob({
    ownerUserId: "u1",
    deviceId: "d1",
    idempotencyKey: "idem-3",
    title: "C",
    manifest: { groups: 2 },
  }).job;
  repo.transition(j3.id, "uploading", { ownerUserId: "u1" });
  repo.transition(j3.id, "uploaded", { ownerUserId: "u1" });
  // race: two writers with same expected version
  const v = repo.getJob(j3.id).job.version;
  const a = repo.transition(j3.id, "validating", { ownerUserId: "u1", expectedVersion: v });
  const b = repo.transition(j3.id, "validating", { ownerUserId: "u1", expectedVersion: v });
  if (!a.ok || b.ok) errors.push("race");

  const late = repo.requestCancel(job.id, { ownerUserId: "u1" });
  if (late.error !== "late-cancellation") errors.push("late");

  if (!repo.assertManifestImmutable(created.job.id, { groups: 2 }).ok) errors.push("manifest-ok");
  if (repo.assertManifestImmutable(created.job.id, { groups: 3 }).ok) errors.push("manifest-bad");

  const avail = repo.setReportAvailability(job.id, true);
  if (avail.job.status !== "succeeded" || !avail.job.reportAvailable) errors.push("availability");

  for (const status of JOB_STATUSES) {
    if (!(status in TRANSITIONS) && status !== "cancel-requested") {
      // all should be in TRANSITIONS
    }
    if (!TRANSITIONS[status] && TRANSITIONS[status] !== []) errors.push(`table-${status}`);
  }

  return { ok: errors.length === 0, errors, plan };
}

module.exports = {
  JOB_SCHEMA_VERSION,
  TRANSITIONS,
  TERMINAL,
  JOB_STATUSES,
  createMigrationPlan,
  createRepository,
  validateJobModule,
};
