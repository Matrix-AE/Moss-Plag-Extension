"use strict";

/**
 * Progress and result presentation (Prompt 034).
 * Driven by a deterministic job state machine — no fabricated percentages.
 */

const PROGRESS_UI_VERSION = 1;

const PHASES = Object.freeze([
  "validate",
  "upload",
  "queue",
  "submit",
  "wait",
  "success",
  "failure",
  "cancelled",
  "timeout",
]);

const COPY = Object.freeze({
  validate: { title: "Checking files", detail: "Local checks only — nothing has left this device.", action: null },
  upload: { title: "Uploading", detail: "Encrypted transfer to the product endpoint.", action: "Cancel" },
  queue: { title: "Queued", detail: "Waiting for a worker. This can take a minute.", action: "Cancel" },
  submit: { title: "Submitting", detail: "Handing the job to the similarity provider.", action: "Cancel" },
  wait: { title: "Waiting for the report", detail: "The provider may be slow. No percentage is shown because none is known.", action: "Cancel" },
  success: { title: "Report ready", detail: "Treat this report link like a password. Availability is estimated, not guaranteed.", action: "Copy link" },
  failure: { title: "Check failed", detail: "Something went wrong. You can retry or change the draft.", action: "Retry" },
  cancelled: { title: "Cancelled", detail: "The job was cancelled before a report was ready.", action: "Start over" },
  timeout: { title: "Timed out", detail: "The provider did not respond in time.", action: "Retry" },
});

function transition(state, event) {
  const table = {
    validate: { next: "upload", fail: "failure", cancel: "cancelled" },
    upload: { next: "queue", fail: "failure", cancel: "cancelled" },
    queue: { next: "submit", fail: "failure", cancel: "cancelled" },
    submit: { next: "wait", fail: "failure", cancel: "cancelled" },
    wait: { next: "success", fail: "failure", cancel: "cancelled", timeout: "timeout" },
    success: {},
    failure: { retry: "validate" },
    cancelled: { retry: "validate" },
    timeout: { retry: "validate" },
  };
  const row = table[state];
  if (!row) return { ok: false, error: `Unknown state ${state}` };
  const next = row[event];
  if (!next) return { ok: false, error: `Invalid transition ${state} --${event}→` };
  return { ok: true, state: next };
}

function viewModel(state, { reportUrl = null, diagnosticId = null, etaMinutes = null } = {}) {
  if (!PHASES.includes(state)) return { ok: false, error: "Unknown phase" };
  const base = COPY[state];
  const announcements = {
    polite: ["validate", "upload", "queue", "submit", "wait", "success", "cancelled"].includes(state),
    assertive: ["failure", "timeout"].includes(state),
  };
  const caveats = [];
  if (state === "success") {
    caveats.push("Estimated availability may end earlier than expected.");
    if (etaMinutes != null) caveats.push(`Estimated availability about ${etaMinutes} minutes.`);
  }
  return {
    ok: true,
    state,
    title: base.title,
    detail: base.detail,
    action: base.action,
    reportUrl: state === "success" ? reportUrl : null,
    autoOpen: false,
    fabricatePercent: false,
    diagnosticId: ["failure", "timeout"].includes(state) ? diagnosticId : null,
    announcements,
    caveats,
    isTerminal: ["success", "failure", "cancelled", "timeout"].includes(state),
  };
}

function validateProgressUi() {
  const errors = [];
  let state = "validate";
  for (const event of ["next", "next", "next", "next", "next"]) {
    const step = transition(state, event);
    if (!step.ok) errors.push(step.error);
    state = step.state;
  }
  if (state !== "success") errors.push("happy path should end success");
  const vm = viewModel("success", { reportUrl: "https://example.test/r", etaMinutes: 14 });
  if (vm.autoOpen) errors.push("must not auto-open");
  if (vm.fabricatePercent) errors.push("no fabricated percent");
  if (/plagiarism|proof|verdict/i.test(JSON.stringify(COPY))) errors.push("forbidden verdict language");
  const bad = transition("validate", "timeout");
  if (bad.ok) errors.push("validate cannot timeout directly");
  return { ok: errors.length === 0, errors };
}

module.exports = {
  PROGRESS_UI_VERSION,
  PHASES,
  COPY,
  transition,
  viewModel,
  validateProgressUi,
};
