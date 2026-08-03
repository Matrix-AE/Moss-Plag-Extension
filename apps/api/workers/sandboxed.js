"use strict";

/**
 * Sandboxed intake and submission workers (Prompt 061).
 * Intake: no provider credential/egress. Submission: immutable manifests only; never executes source.
 */

const crypto = require("node:crypto");

const WORKERS_VERSION = 1;
const DEFAULT_DEADLINE_MS = 30_000;
const BACKSTOP_MS = 24 * 60 * 60 * 1000;

const INTAKE_PRIVILEGES = Object.freeze({
  root: false,
  providerEgress: false,
  credentialAccess: false,
  executeSource: false,
  network: Object.freeze(["storage-internal"]),
  maxMemoryMb: 256,
  maxDiskMb: 512,
});

const SUBMISSION_PRIVILEGES = Object.freeze({
  root: false,
  providerEgress: true,
  credentialAccess: true,
  executeSource: false,
  network: Object.freeze(["provider-approved", "storage-internal"]),
  maxMemoryMb: 256,
  maxDiskMb: 512,
});

function createWorkerRuntime({
  now = () => Date.now(),
  deadlineMs = DEFAULT_DEADLINE_MS,
  backstopMs = BACKSTOP_MS,
} = {}) {
  const workers = new Map();
  const artifacts = new Map();
  const resultStore = new Map();
  const audit = [];

  function leaseIntake({ jobId, manifest, sourceArtifacts }) {
    if (!jobId || !manifest) return { ok: false, error: "invalid-lease" };
    const id = `iw_${crypto.randomBytes(4).toString("hex")}`;
    const artifactKeys = (sourceArtifacts || []).map((a) => a.key);
    for (const key of artifactKeys) {
      artifacts.set(key, { key, jobId, present: true, createdAt: now() });
    }
    const worker = {
      id,
      kind: "intake",
      jobId,
      manifest: cloneManifest(manifest),
      artifactKeys,
      privileges: INTAKE_PRIVILEGES,
      leasedAt: now(),
      deadlineAt: now() + deadlineMs,
      canceled: false,
      alive: true,
      stages: [],
    };
    workers.set(id, worker);
    return { ok: true, worker: publicWorker(worker) };
  }

  function leaseSubmission({ jobId, manifest, credentialRef, sourceArtifacts }) {
    if (!jobId || !manifest) return { ok: false, error: "invalid-lease" };
    if (!credentialRef) return { ok: false, error: "credential-ref-required" };
    if (!isImmutableManifest(manifest)) return { ok: false, error: "manifest-not-immutable" };

    const id = `sw_${crypto.randomBytes(4).toString("hex")}`;
    const artifactKeys = (sourceArtifacts || []).map((a) => a.key);
    for (const key of artifactKeys) {
      artifacts.set(key, { key, jobId, present: true, createdAt: now() });
    }
    const worker = {
      id,
      kind: "submission",
      jobId,
      manifest,
      credentialRef,
      artifactKeys,
      privileges: SUBMISSION_PRIVILEGES,
      leasedAt: now(),
      deadlineAt: now() + deadlineMs,
      canceled: false,
      alive: true,
      stages: [],
      sourceExecuted: false,
    };
    workers.set(id, worker);
    return { ok: true, worker: publicWorker(worker) };
  }

  function runIntake(workerId, opts = {}) {
    const worker = workers.get(workerId);
    if (!worker || worker.kind !== "intake") return { ok: false, error: "unknown-worker" };
    if (opts.injectCredential) {
      // Intake must ignore/deny credential injection
      emit(worker, "credential-denied", { reason: "intake-no-credential" });
    }
    return finishWithSimulation(worker, opts, () => {
      emit(worker, "validate-manifest", { hash: worker.manifest.hash });
      emit(worker, "scan-entries", { count: worker.manifest.files?.length || 0 });
      emit(worker, "intake-complete", { ok: true });
      return {
        ok: true,
        validatedManifestHash: worker.manifest.hash,
      };
    });
  }

  function runSubmission(workerId, opts = {}) {
    const worker = workers.get(workerId);
    if (!worker || worker.kind !== "submission") return { ok: false, error: "unknown-worker" };
    if (worker.privileges.executeSource) {
      return failAndClean(worker, "execute-forbidden");
    }
    return finishWithSimulation(worker, opts, () => {
      emit(worker, "load-credential-ref", { ref: worker.credentialRef });
      emit(worker, "connect-provider", { egress: "provider-approved" });
      emit(worker, "upload-manifest", { hash: worker.manifest.hash });
      emit(worker, "await-result", {});
      const url = opts.resultUrl || "https://mock.local/results/ok";
      if (!/^https:\/\/(mock\.local|[a-z0-9.-]+\.moss\.stanford\.edu)\//i.test(url)) {
        return { ok: false, error: "invalid-result-url" };
      }
      const reportUrlRef = `ref_${crypto.createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
      const meta = Object.freeze({
        reportUrlRef,
        scheme: "https",
        hostClass: url.includes("mock.local") ? "mock" : "moss",
        storedAt: now(),
      });
      resultStore.set(worker.jobId, meta);
      emit(worker, "store-result-meta", { reportUrlRef });
      return { ok: true, resultMeta: meta, sourceExecuted: false };
    });
  }

  function cancel(workerId) {
    const worker = workers.get(workerId);
    if (!worker) return { ok: false, error: "unknown-worker" };
    worker.canceled = true;
    emit(worker, "cancel-requested", {});
    return { ok: true };
  }

  function simulateCrash(workerId) {
    const worker = workers.get(workerId);
    if (!worker) return { ok: false, error: "unknown-worker" };
    worker.alive = false;
    emit(worker, "crash", { signal: "SIGKILL" });
    const cleaned = cleanupArtifacts(worker, { force: true });
    return {
      ok: true,
      artifactsCleaned: cleaned,
      sourceBeyondBackstop: hasSourceBeyondBackstop(worker),
      stages: redactStages(worker.stages),
    };
  }

  function finishWithSimulation(worker, opts, successFn) {
    if (!worker.alive) return failAndClean(worker, "worker-dead");
    if (worker.canceled || opts.simulate === "cancel") {
      worker.canceled = true;
      return failAndClean(worker, "canceled");
    }
    if (opts.simulate === "timeout" || now() > worker.deadlineAt) {
      return failAndClean(worker, "deadline-exceeded");
    }
    if (opts.simulate === "memory-pressure" || opts.simulate === "disk-pressure") {
      return failAndClean(worker, "resource-limit");
    }
    if (opts.simulate === "egress-denied") {
      return failAndClean(worker, "egress-denied");
    }
    if (opts.simulate === "cleanup-failure") {
      const result = successFn();
      const cleaned = false;
      emit(worker, "cleanup-failed", { scheduledBackstop: true });
      audit.push({ at: now(), workerId: worker.id, event: "cleanup-failed" });
      return {
        ...result,
        artifactsCleaned: cleaned,
        stages: redactStages(worker.stages),
        cleanupScheduled: true,
      };
    }

    const result = successFn();
    if (!result.ok) return failAndClean(worker, result.error || "worker-failed");
    const cleaned = cleanupArtifacts(worker);
    return {
      ...result,
      artifactsCleaned: cleaned,
      stages: redactStages(worker.stages),
      sourceExecuted: worker.sourceExecuted === true,
    };
  }

  function failAndClean(worker, error) {
    emit(worker, "failed", { error });
    const cleaned = cleanupArtifacts(worker, { force: true });
    return {
      ok: false,
      error,
      artifactsCleaned: cleaned,
      stages: redactStages(worker.stages),
      sourceBeyondBackstop: hasSourceBeyondBackstop(worker),
      sourceExecuted: false,
    };
  }

  function cleanupArtifacts(worker, { force = false } = {}) {
    let allGone = true;
    for (const key of worker.artifactKeys) {
      const art = artifacts.get(key);
      if (art) {
        art.present = false;
        art.deletedAt = now();
        art.forced = force;
      } else {
        allGone = false;
      }
    }
    emit(worker, "cleanup", { keys: worker.artifactKeys.length, ok: allGone });
    return allGone;
  }

  function hasSourceBeyondBackstop(worker) {
    for (const key of worker.artifactKeys) {
      const art = artifacts.get(key);
      if (art?.present && now() - art.createdAt > backstopMs) return true;
    }
    return false;
  }

  function emit(worker, stage, detail) {
    worker.stages.push({
      stage,
      at: now(),
      detail: redactDetail(detail),
    });
    audit.push({ workerId: worker.id, kind: worker.kind, stage, at: now() });
  }

  function getResultMeta(jobId) {
    return resultStore.get(jobId) || null;
  }

  function listLingeringArtifacts() {
    return [...artifacts.values()].filter((a) => a.present);
  }

  return {
    leaseIntake,
    leaseSubmission,
    runIntake,
    runSubmission,
    cancel,
    simulateCrash,
    getResultMeta,
    listLingeringArtifacts,
    WORKERS_VERSION,
  };
}

function isImmutableManifest(manifest) {
  if (!manifest || typeof manifest !== "object") return false;
  if (!Object.isFrozen(manifest)) return false;
  if (Array.isArray(manifest.files) && !Object.isFrozen(manifest.files)) return false;
  return true;
}

function cloneManifest(manifest) {
  return JSON.parse(JSON.stringify(manifest));
}

function publicWorker(worker) {
  return {
    id: worker.id,
    kind: worker.kind,
    jobId: worker.jobId,
    privileges: worker.privileges,
    deadlineAt: worker.deadlineAt,
  };
}

function redactDetail(detail) {
  const text = JSON.stringify(detail || {});
  return JSON.parse(
    text
      .replace(/userid\s+\d+/gi, "userid [redacted]")
      .replace(/https?:\/\/[^"\s]+/gi, "[url-redacted]")
      .replace(/obj_[a-z0-9_]+/gi, "[object-redacted]")
      .replace(/[A-Za-z0-9_.-]+\.(py|java|c|cpp|js|ts)/gi, "[file-redacted]"),
  );
}

function redactStages(stages) {
  return stages.map((s) => ({
    stage: s.stage,
    at: s.at,
    detail: redactDetail(s.detail),
  }));
}

function validateSandboxedWorkersModule() {
  const errors = [];
  const runtime = createWorkerRuntime({ deadlineMs: 50 });

  const intake = runtime.leaseIntake({
    jobId: "v_job",
    manifest: { hash: "h", files: [{ id: "1", displayName: "a.py", bytes: 1 }] },
    sourceArtifacts: [{ key: "obj_v", bytes: 1 }],
  });
  if (!intake.ok || intake.worker.privileges.providerEgress) errors.push("intake-priv");
  const okIntake = runtime.runIntake(intake.worker.id);
  if (!okIntake.ok || !okIntake.artifactsCleaned) errors.push("intake-run");

  const mut = runtime.leaseSubmission({
    jobId: "v_job2",
    manifest: { hash: "h2", files: [] },
    credentialRef: "c1",
    sourceArtifacts: [],
  });
  if (mut.ok || mut.error !== "manifest-not-immutable") errors.push("immut");

  const frozen = Object.freeze({ hash: "h3", files: Object.freeze([{ id: "1", displayName: "a.py", bytes: 1 }]) });
  const sub = runtime.leaseSubmission({
    jobId: "v_job3",
    manifest: frozen,
    credentialRef: "c1",
    sourceArtifacts: [{ key: "obj_v3", bytes: 1 }],
  });
  if (!sub.ok || sub.worker.privileges.executeSource) errors.push("sub-priv");
  const done = runtime.runSubmission(sub.worker.id, { resultUrl: "https://mock.local/results/1" });
  if (!done.ok || done.resultMeta.reportUrl || !done.artifactsCleaned) errors.push("sub-run");

  const crashLease = runtime.leaseIntake({
    jobId: "v_crash",
    manifest: { hash: "hc", files: [{ id: "9", displayName: "z.py", bytes: 1 }] },
    sourceArtifacts: [{ key: "obj_crash", bytes: 1 }],
  });
  const crashed = runtime.simulateCrash(crashLease.worker.id);
  if (!crashed.artifactsCleaned || crashed.sourceBeyondBackstop) errors.push("crash");

  if (INTAKE_PRIVILEGES.root || SUBMISSION_PRIVILEGES.root) errors.push("root");
  if (runtime.listLingeringArtifacts().length !== 0) errors.push("linger");

  return { ok: errors.length === 0, errors, version: WORKERS_VERSION };
}

module.exports = {
  WORKERS_VERSION,
  BACKSTOP_MS,
  INTAKE_PRIVILEGES,
  SUBMISSION_PRIVILEGES,
  createWorkerRuntime,
  validateSandboxedWorkersModule,
};
