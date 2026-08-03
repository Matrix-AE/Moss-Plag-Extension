"use strict";

/**
 * Run lifecycle driver for the popup Pair Check flow.
 *
 * The progress module owns the phase table; this module owns the parts that keep a started run
 * from hanging: a wall-clock deadline, recovery of a run whose surface was closed, entitlement
 * release rules, and the honest labelling of local demo results.
 */

const progress = require("../progress");
const errorRecovery = require("../error-recovery");

const RUN_LIFECYCLE_VERSION = 1;

/** Hard wall-clock budget. A run can never stay non-terminal for longer than this. */
const RUN_DEADLINE_MS = 90 * 1000;

/** Pace of the local simulation between phases. */
const DEMO_STEP_MS = 700;

const LOCAL_DEMO_LABEL = "Local demo result";

const LOCAL_DEMO_NOTICE =
  "Local demo result generated on this device: no files were uploaded and no provider query ran, " +
  "so this is not a MOSS similarity report.";

const TERMINAL_PHASES = Object.freeze(["success", "failure", "cancelled", "timeout"]);

/** Phases that mean the submission may already exist upstream. */
const SUBMITTED_PHASES = Object.freeze(["wait", "success"]);

const PHASE_JOB_STATUS = Object.freeze({
  validate: "ready",
  upload: "uploading",
  queue: "queued",
  submit: "submitting",
  wait: "waiting",
  success: "succeeded",
  failure: "failed",
  cancelled: "cancelled",
  timeout: "ambiguous",
});

const JOB_STATUS_PHASE = Object.freeze({
  draft: "validate",
  ready: "validate",
  uploading: "upload",
  queued: "queue",
  submitting: "submit",
  waiting: "wait",
  succeeded: "success",
  failed: "failure",
  cancelled: "cancelled",
  ambiguous: "timeout",
});

function isTerminalPhase(phase) {
  return TERMINAL_PHASES.includes(phase);
}

/** Opaque, non-URL reference so persisted state never stores a bearer link. */
function createDemoResultRef(seed = "") {
  let hash = 2166136261;
  const input = `moss-demo-result:${seed}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `demo-${(hash >>> 0).toString(36)}`;
}

/** Extension-relative path, ready for runtime.getURL. */
function demoReportPath(ref) {
  return `/report.html#ref=${encodeURIComponent(String(ref || ""))}`;
}

function createRunState({
  now = Date.now(),
  mode = "demo",
  comparison = "pair",
  language = null,
  jobId = null,
  idempotencyKey = null,
  deadlineMs = RUN_DEADLINE_MS,
} = {}) {
  const budget = Number.isFinite(deadlineMs) && deadlineMs > 0 ? deadlineMs : RUN_DEADLINE_MS;
  return {
    phase: "validate",
    mode,
    comparison,
    language,
    jobId,
    idempotencyKey,
    startedAt: now,
    updatedAt: now,
    deadlineAt: now + budget,
    deadlineMs: budget,
    submitted: false,
    resultRef: null,
    failureCode: null,
  };
}

function remainingMs(state, now = Date.now()) {
  if (!state || !Number.isFinite(state.deadlineAt)) return 0;
  return Math.max(0, state.deadlineAt - now);
}

function timeoutFailureCode(state) {
  // A submitted run may already be queued upstream, so automatic retry is unsafe.
  return state.submitted ? "uncertain-query" : "provider";
}

function expire(state, now) {
  return {
    ...state,
    phase: "timeout",
    updatedAt: now,
    failureCode: timeoutFailureCode(state),
  };
}

/**
 * Move a run forward one phase. The deadline is enforced before any transition, so a caller that
 * keeps ticking (or resumes after the popup was closed) still lands on a terminal phase.
 */
function advanceRunState(state, { now = Date.now(), event = "next", failureCode = null, resultRef = null } = {}) {
  if (!state || !progress.PHASES.includes(state.phase)) {
    return { ok: false, error: "invalid-run-state", state, changed: false, deadlineExceeded: false };
  }
  if (isTerminalPhase(state.phase)) {
    return { ok: true, state, changed: false, deadlineExceeded: false };
  }
  if (now >= state.deadlineAt) {
    return { ok: true, state: expire(state, now), changed: true, deadlineExceeded: true };
  }

  const step = progress.transition(state.phase, event);
  if (!step.ok) {
    return { ok: false, error: step.error, state, changed: false, deadlineExceeded: false };
  }

  const next = {
    ...state,
    phase: step.state,
    updatedAt: now,
    submitted: state.submitted || SUBMITTED_PHASES.includes(step.state),
  };
  if (step.state === "failure") {
    next.failureCode = failureCode || state.failureCode || "worker";
  }
  if (step.state === "success") {
    next.resultRef =
      resultRef || state.resultRef || createDemoResultRef(`${state.jobId || "job"}:${state.startedAt}`);
  }
  if (step.state === "validate") {
    // Retry restarts the budget deliberately; it never extends a run already in flight.
    next.startedAt = now;
    next.deadlineAt = now + state.deadlineMs;
    next.submitted = false;
    next.failureCode = null;
    next.resultRef = null;
  }
  return { ok: true, state: next, changed: true, deadlineExceeded: false };
}

/** Rebuild a run from the persisted active job after the popup or worker went away. */
function recoverRunState(job, { now = Date.now(), deadlineMs = RUN_DEADLINE_MS, mode = "demo" } = {}) {
  if (!job || typeof job !== "object" || typeof job.jobId !== "string") {
    return { ok: false, error: "no-active-job", state: null };
  }
  const phase = JOB_STATUS_PHASE[job.status];
  if (!phase) {
    return { ok: false, error: "unknown-status", state: null };
  }
  const anchor = Number.isFinite(job.updatedAt) ? job.updatedAt : now;
  const budget = Number.isFinite(deadlineMs) && deadlineMs > 0 ? deadlineMs : RUN_DEADLINE_MS;
  const state = {
    phase,
    mode,
    comparison: job.mode === "batch" ? "batch" : "pair",
    language: job.language || null,
    jobId: job.jobId,
    idempotencyKey: job.submissionIdempotencyKey || null,
    startedAt: anchor,
    updatedAt: anchor,
    // The budget is measured from the last recorded progress, not from reopen time.
    deadlineAt: anchor + budget,
    deadlineMs: budget,
    submitted: SUBMITTED_PHASES.includes(phase) || job.status === "ambiguous",
    resultRef: job.reportUrlRef || null,
    failureCode: null,
  };
  if (!isTerminalPhase(phase) && now >= state.deadlineAt) {
    return { ok: true, state: expire(state, now), recovered: true, deadlineExceeded: true };
  }
  if (phase === "timeout") {
    state.failureCode = timeoutFailureCode(state);
  }
  return { ok: true, state, recovered: true, deadlineExceeded: false };
}

function jobStatusForRun(state) {
  if (!state) return null;
  if (state.phase === "timeout" && !state.submitted) {
    // Nothing reached the provider, so "failed" is the honest durable status.
    return "failed";
  }
  return PHASE_JOB_STATUS[state.phase] || null;
}

/** Credit is only returned when the run ended without anything being submitted. */
function shouldReleaseRunCredit(state) {
  if (!state || !isTerminalPhase(state.phase)) return false;
  if (state.phase === "success") return false;
  return !state.submitted;
}

function describeRun(state, { reportUrl = null, etaMinutes = null } = {}) {
  if (!state || !progress.PHASES.includes(state.phase)) {
    return { ok: false, error: "invalid-run-state" };
  }
  const base = progress.viewModel(state.phase, {
    reportUrl,
    diagnosticId: state.jobId,
    etaMinutes,
  });
  const isDemo = state.mode === "demo";
  const failed = ["failure", "timeout"].includes(state.phase);
  return {
    ...base,
    isDemo,
    demoLabel: isDemo ? LOCAL_DEMO_LABEL : null,
    demoNotice: isDemo && state.phase === "success" ? LOCAL_DEMO_NOTICE : null,
    resultRef: state.phase === "success" ? state.resultRef : null,
    remainingMs: remainingMs(state, state.updatedAt),
    releasesRunCredit: shouldReleaseRunCredit(state),
    error: failed
      ? errorRecovery.resolveError({
          code: state.failureCode || "unknown",
          correlationId: state.jobId,
        })
      : null,
  };
}

function validateRunLifecycleModule() {
  const errors = [];

  let state = createRunState({ now: 0, jobId: "job-selfcheck" });
  for (let i = 0; i < 5; i += 1) {
    const step = advanceRunState(state, { now: (i + 1) * DEMO_STEP_MS });
    if (!step.ok) errors.push(step.error);
    state = step.state;
  }
  if (state.phase !== "success") errors.push("happy path must end in success");
  if (!state.resultRef) errors.push("success must carry a result ref");
  if (/^https?:\/\//i.test(state.resultRef || "")) errors.push("result ref must stay opaque");
  if (shouldReleaseRunCredit(state)) errors.push("success must not release credit");

  const stalled = advanceRunState(createRunState({ now: 0, deadlineMs: 10 }), { now: 11 });
  if (stalled.state.phase !== "timeout") errors.push("deadline must force a terminal phase");
  if (!shouldReleaseRunCredit(stalled.state)) errors.push("unsubmitted timeout must release credit");

  const view = describeRun(state, { reportUrl: "chrome-extension://demo/report.html#ref=x" });
  if (view.autoOpen || view.fabricatePercent) errors.push("result view must stay honest");
  if (!view.demoNotice) errors.push("demo results must be labelled");
  if (/plagiaris|verdict/i.test(JSON.stringify(view))) errors.push("forbidden verdict language");

  const uncertain = describeRun(expire({ ...state, phase: "wait", submitted: true }, 1));
  if (uncertain.error?.code !== "uncertain-query") errors.push("submitted timeout must be uncertain");

  return { ok: errors.length === 0, errors, version: RUN_LIFECYCLE_VERSION };
}

module.exports = {
  RUN_LIFECYCLE_VERSION,
  RUN_DEADLINE_MS,
  DEMO_STEP_MS,
  LOCAL_DEMO_LABEL,
  LOCAL_DEMO_NOTICE,
  TERMINAL_PHASES,
  PHASE_JOB_STATUS,
  JOB_STATUS_PHASE,
  isTerminalPhase,
  createDemoResultRef,
  demoReportPath,
  createRunState,
  advanceRunState,
  recoverRunState,
  jobStatusForRun,
  shouldReleaseRunCredit,
  remainingMs,
  describeRun,
  validateRunLifecycleModule,
};
