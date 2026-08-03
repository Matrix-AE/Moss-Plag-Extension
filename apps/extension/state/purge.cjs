"use strict";

const { DRAFT_TTL_MS, TERMINAL_JOB_TTL_MS, isTerminalStatus } = require("./constants.cjs");

function purgeExpired(state, now = Date.now()) {
  let changed = false;
  const next = {
    schemaVersion: state.schemaVersion,
    shell: { ...state.shell },
    draft: state.draft,
    activeJob: state.activeJob,
  };
  const events = [];

  if (next.draft && now - next.draft.updatedAt > DRAFT_TTL_MS) {
    events.push({ type: "draft-ttl", draftId: next.draft.draftId, ageMs: now - next.draft.updatedAt });
    next.draft = null;
    changed = true;
  }

  if (
    next.activeJob &&
    isTerminalStatus(next.activeJob.status) &&
    Number.isFinite(next.activeJob.terminalAt) &&
    now - next.activeJob.terminalAt > TERMINAL_JOB_TTL_MS
  ) {
    events.push({
      type: "job-ttl",
      jobId: next.activeJob.jobId,
      ageMs: now - next.activeJob.terminalAt,
    });
    next.activeJob = null;
    changed = true;
  }

  return { state: next, changed, events };
}

function discardDraft(state) {
  if (!state.draft) {
    return { state, changed: false };
  }
  return {
    state: { ...state, draft: null },
    changed: true,
  };
}

module.exports = { purgeExpired, discardDraft };
