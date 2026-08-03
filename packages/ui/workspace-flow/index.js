"use strict";

/**
 * Workspace workflow controller (Prompt 037).
 * Local preview is free through Review; entitlement is required before upload/job creation.
 */

const groupBuilder = require("../group-builder");
const fileSelection = require("../file-selection");
const progress = require("../progress");

const STAGES = Object.freeze([
  "select",
  "group",
  "configure",
  "review",
  "paywall",
  "progress",
  "result",
]);

const PERSISTABLE_DRAFT_FIELDS = Object.freeze([
  "draftId",
  "mode",
  "language",
  "groupCount",
  "flags",
  "updatedAt",
]);

function createWorkspaceState({ entitled = false } = {}) {
  const created = groupBuilder.createDraft("pair");
  return {
    stage: "select",
    entitled: Boolean(entitled),
    consents: { ownership: false, sensitiveLink: false },
    draft: created.draft,
    localFiles: [],
    jobPhase: null,
    note: "Local preview — files stay on this device until you pay and consent.",
  };
}

function canEnterPaywall(state) {
  return state.stage === "review" && state.consents.ownership && state.consents.sensitiveLink;
}

function advance(state, action) {
  const next = JSON.parse(JSON.stringify(state));
  switch (action.type) {
    case "set-stage": {
      if (action.stage === "paywall" && !canEnterPaywall(next)) {
        return { ok: false, error: "Paywall only after Review consents.", state };
      }
      if (!STAGES.includes(action.stage)) {
        return { ok: false, error: "Unknown stage.", state };
      }
      next.stage = action.stage;
      return { ok: true, state: next };
    }
    case "set-consent": {
      next.consents[action.key] = Boolean(action.value);
      return { ok: true, state: next };
    }
    case "add-local-file": {
      const classified = fileSelection.classifyLocalFile(action.file, {
        existingKeys: next.localFiles.map((f) => f.key).filter(Boolean),
        asBase: Boolean(action.asBase),
      });
      next.localFiles.push(classified);
      next.note = "File listed locally. Restart will require reselection.";
      return { ok: true, state: next };
    }
    case "set-entitled": {
      next.entitled = Boolean(action.value);
      return { ok: true, state: next };
    }
    case "start-job": {
      if (!next.entitled) {
        return { ok: false, error: "Entitlement required before upload/job creation.", state };
      }
      if (!next.consents.ownership || !next.consents.sensitiveLink) {
        return { ok: false, error: "Consents required before upload.", state };
      }
      next.stage = "progress";
      next.jobPhase = "validate";
      next.note = progress.viewModel("validate").detail;
      return { ok: true, state: next };
    }
    case "job-event": {
      if (!next.jobPhase) return { ok: false, error: "No active job.", state };
      const stepped = progress.transition(next.jobPhase, action.event);
      if (!stepped.ok) return { ok: false, error: stepped.error, state };
      next.jobPhase = stepped.state;
      const vm = progress.viewModel(stepped.state, action.payload || {});
      next.note = vm.detail;
      if (vm.isTerminal && stepped.state === "success") next.stage = "result";
      return { ok: true, state: next };
    }
    case "simulate-restart": {
      next.localFiles = [];
      next.jobPhase = null;
      next.stage = "select";
      next.note = "Restarted — reselect files. Draft metadata may remain for 24 hours.";
      return { ok: true, state: next, requiresReselection: true };
    }
    default:
      return { ok: false, error: `Unknown action ${action.type}`, state };
  }
}

function persistableDraft(state) {
  const draft = {
    draftId: state.draftId || "draft-local",
    mode: state.draft?.mode || "pair",
    language: state.draft?.language || "python",
    groupCount: state.draft?.groups?.length || 2,
    flags: { includeBaseCode: (state.draft?.baseFiles || []).length > 0 },
    updatedAt: new Date().toISOString(),
  };
  for (const key of Object.keys(draft)) {
    if (!PERSISTABLE_DRAFT_FIELDS.includes(key)) {
      throw new Error(`Refusing to persist ${key}`);
    }
  }
  return draft;
}

function validateWorkspaceFlow() {
  const errors = [];
  let state = createWorkspaceState();
  if (advance(state, { type: "set-stage", stage: "paywall" }).ok) {
    errors.push("paywall without consent");
  }
  state = advance(state, { type: "set-stage", stage: "review" }).state;
  state = advance(state, { type: "set-consent", key: "ownership", value: true }).state;
  state = advance(state, { type: "set-consent", key: "sensitiveLink", value: true }).state;
  if (advance(state, { type: "start-job" }).ok) errors.push("job without entitlement");
  state = advance(state, { type: "set-entitled", value: true }).state;
  let result = advance(state, { type: "start-job" });
  if (!result.ok) errors.push(result.error);
  state = result.state;
  for (const event of ["next", "next", "next", "next", "next"]) {
    state = advance(state, { type: "job-event", event }).state;
  }
  if (state.stage !== "result") errors.push("should reach result");
  const restarted = advance(state, { type: "simulate-restart" });
  if (!restarted.requiresReselection) errors.push("restart must require reselection");
  if (restarted.state.localFiles.length !== 0) errors.push("files must clear on restart");
  persistableDraft(state);
  return { ok: errors.length === 0, errors };
}

module.exports = {
  STAGES,
  PERSISTABLE_DRAFT_FIELDS,
  createWorkspaceState,
  canEnterPaywall,
  advance,
  persistableDraft,
  validateWorkspaceFlow,
};
