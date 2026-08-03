"use strict";

/**
 * Accessible Pair / Batch mode selector (Prompt 038).
 * Builds on group-builder drafts. Never exposes MOSS directory-mode jargon
 * or describes similarity as a verdict.
 */

const groupBuilder = require("../group-builder");

const MODE_SELECTOR_VERSION = 1;

const MODE_CARDS = Object.freeze({
  pair: Object.freeze({
    id: "pair",
    title: "Pair Check",
    summary: "Compare exactly two logical submissions. Each submission may contain multiple files that belong together.",
    requiresGroups: 2,
    exactGroups: true,
    supportsFolders: false,
    supportsArchives: false,
  }),
  batch: Object.freeze({
    id: "batch",
    title: "Batch Check",
    summary:
      "Compare two or more logical submissions under one language. Folders and approved archives can each become a submission group.",
    requiresGroups: 2,
    exactGroups: false,
    supportsFolders: true,
    supportsArchives: true,
  }),
});

const FORBIDDEN_COPY = Object.freeze([
  /plagiarism/i,
  /verdict/i,
  /directory[- ]mode/i,
  /\bmoss\b/i,
  /caught/i,
  /guilty/i,
]);

function describeMode(mode) {
  const card = MODE_CARDS[mode];
  if (!card) return { ok: false, error: `Unknown mode: ${mode}` };
  return { ok: true, card };
}

function selectMode(currentDraft, mode, { confirm = false } = {}) {
  if (!MODE_CARDS[mode]) {
    return { ok: false, error: `Unknown mode: ${mode}` };
  }
  if (!currentDraft) {
    const created = groupBuilder.createDraft(mode);
    return { ok: true, draft: created.draft, changed: true, needsConfirm: false };
  }
  if (currentDraft.mode === mode) {
    return { ok: true, draft: currentDraft, changed: false, needsConfirm: false };
  }
  const switched = groupBuilder.switchMode(currentDraft, mode, { confirm });
  if (switched.needsConfirm) {
    return { ok: false, draft: currentDraft, changed: false, needsConfirm: true, error: switched.error };
  }
  if (!switched.ok) {
    return { ok: false, draft: currentDraft, changed: false, needsConfirm: false, error: switched.error };
  }
  return { ok: true, draft: switched.draft, changed: true, needsConfirm: false };
}

function cancelSwitch(draft) {
  return { ok: true, draft, changed: false, cancelled: true };
}

/**
 * Compatible preservation: when switching pair→batch with exactly two populated
 * groups and confirm, we still reset via createDraft today (destructive). Compatible
 * empty drafts can switch without confirm. Populated-compatible means both modes
 * already satisfy the destination's group-count floor without file loss — for pair
 * that means exactly two groups; for batch, >=2. We only auto-preserve when both
 * sides have the same group count and the user confirms an explicit preserve path.
 */
function selectModePreserving(currentDraft, mode, { confirm = false, preserve = false } = {}) {
  if (!currentDraft) return selectMode(null, mode);
  if (currentDraft.mode === mode) {
    return { ok: true, draft: currentDraft, changed: false, needsConfirm: false, preserved: false };
  }
  const hasFiles = currentDraft.groups.some((g) => g.files.length > 0);
  if (hasFiles && !confirm) {
    return {
      ok: false,
      draft: currentDraft,
      changed: false,
      needsConfirm: true,
      error: "Confirm destructive mode switch.",
    };
  }
  if (preserve && confirm && isCompatibleForPreserve(currentDraft, mode)) {
    const next = JSON.parse(JSON.stringify(currentDraft));
    next.mode = mode;
    return { ok: true, draft: next, changed: true, needsConfirm: false, preserved: true };
  }
  return { ...selectMode(currentDraft, mode, { confirm }), preserved: false };
}

function isCompatibleForPreserve(draft, mode) {
  const count = draft.groups.length;
  if (mode === "pair") return count === 2;
  if (mode === "batch") return count >= 2;
  return false;
}

function canContinue(draft) {
  if (!draft || !MODE_CARDS[draft.mode]) {
    return { ok: false, errors: ["missing-draft"] };
  }
  const card = MODE_CARDS[draft.mode];
  const count = Array.isArray(draft.groups) ? draft.groups.length : 0;
  const errors = [];
  if (card.exactGroups && count !== card.requiresGroups) {
    errors.push(`pair-requires-exactly-${card.requiresGroups}`);
  }
  if (!card.exactGroups && count < card.requiresGroups) {
    errors.push(`batch-requires-at-least-${card.requiresGroups}`);
  }
  if ((draft.groups || []).some((g) => !Array.isArray(g.files) || g.files.length === 0)) {
    errors.push("empty-group");
  }
  return { ok: errors.length === 0, errors };
}

function buildModeSelectorHtml({ selected = "pair", labelledBy = "mode-heading" } = {}) {
  const radios = Object.values(MODE_CARDS)
    .map((card) => {
      const checked = card.id === selected ? "checked" : "";
      return [
        `<label class="mode-card focus-ring" for="mode-${card.id}">`,
        `<input type="radio" name="comparison-mode" id="mode-${card.id}" value="${card.id}" ${checked} />`,
        `<span class="type-subtitle">${escape(card.title)}</span>`,
        `<span class="type-helper">${escape(card.summary)}</span>`,
        `</label>`,
      ].join("");
    })
    .join("");
  return {
    ok: true,
    html: `<fieldset class="mode-selector" role="radiogroup" aria-labelledby="${labelledBy}"><legend id="${labelledBy}" class="type-label">Comparison mode</legend>${radios}</fieldset>`,
  };
}

function keyboardContract() {
  return Object.freeze({
    roles: ["radiogroup", "radio"],
    keys: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter"],
    screenReader: "Each mode is a radio option with visible title and summary text.",
  });
}

function validateModeSelector() {
  const errors = [];
  for (const card of Object.values(MODE_CARDS)) {
    for (const pattern of FORBIDDEN_COPY) {
      if (pattern.test(card.title) || pattern.test(card.summary)) {
        errors.push(`forbidden copy in ${card.id}`);
      }
    }
  }
  const empty = selectMode(null, "pair");
  if (!empty.ok || empty.draft.groups.length !== 2) errors.push("pair init");
  const batch = selectMode(null, "batch");
  if (!batch.ok || batch.draft.groups.length < 2) errors.push("batch init");

  const populated = groupBuilder.createDraft("pair").draft;
  populated.groups[0].files.push({ key: "a", displayName: "a.py" });
  const blocked = selectMode(populated, "batch", { confirm: false });
  if (!blocked.needsConfirm) errors.push("populated switch needs confirm");
  const cancelled = cancelSwitch(populated);
  if (!cancelled.cancelled || cancelled.draft.groups[0].files.length !== 1) {
    errors.push("cancel must keep draft");
  }
  const confirmed = selectMode(populated, "batch", { confirm: true });
  if (!confirmed.ok || confirmed.draft.mode !== "batch") errors.push("confirmed switch");

  const pairOk = canContinue({
    mode: "pair",
    groups: [
      { id: "a", files: [{ key: "1" }] },
      { id: "b", files: [{ key: "2" }] },
    ],
  });
  if (!pairOk.ok) errors.push("pair continue");
  const pairBlocked = canContinue({
    mode: "pair",
    groups: [{ id: "a", files: [{ key: "1" }] }],
  });
  if (pairBlocked.ok) errors.push("pair must block wrong count");

  const html = buildModeSelectorHtml({ selected: "batch" });
  if (!html.html.includes('role="radiogroup"') || !html.html.includes('value="batch" checked')) {
    errors.push("selector html");
  }
  return { ok: errors.length === 0, errors };
}

function escape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

module.exports = {
  MODE_SELECTOR_VERSION,
  MODE_CARDS,
  FORBIDDEN_COPY,
  describeMode,
  selectMode,
  selectModePreserving,
  cancelSwitch,
  canContinue,
  buildModeSelectorHtml,
  keyboardContract,
  validateModeSelector,
};
