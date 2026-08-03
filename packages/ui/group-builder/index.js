"use strict";

/**
 * Comparison mode and group builder (Prompt 033).
 * Emits the approved domain-shaped draft without provider protocol leakage.
 */

const GROUP_UI_VERSION = 1;
const MODES = Object.freeze(["pair", "batch"]);

function createDraft(mode) {
  if (!MODES.includes(mode)) {
    return { ok: false, error: `Unknown mode: ${mode}` };
  }
  const groups =
    mode === "pair"
      ? [emptyGroup("group-a", "Submission A"), emptyGroup("group-b", "Submission B")]
      : [emptyGroup("group-1", "Group 1"), emptyGroup("group-2", "Group 2")];
  return {
    ok: true,
    draft: {
      schemaVersion: 1,
      mode,
      language: null,
      languageConfirmed: false,
      groups,
      baseFiles: [],
      settings: { experimental: false },
    },
  };
}

function emptyGroup(id, label) {
  return { id, label, files: [] };
}

function renameGroup(draft, groupId, label) {
  const next = clone(draft);
  const group = next.groups.find((g) => g.id === groupId);
  if (!group) return { ok: false, error: "Group not found." };
  if (!String(label || "").trim()) return { ok: false, error: "Group label required." };
  group.label = String(label).trim().slice(0, 80);
  return { ok: true, draft: next };
}

function moveFile(draft, fromGroupId, toGroupId, fileKey) {
  const next = clone(draft);
  const from = next.groups.find((g) => g.id === fromGroupId);
  const to = next.groups.find((g) => g.id === toGroupId);
  if (!from || !to) return { ok: false, error: "Invalid groups." };
  const index = from.files.findIndex((f) => f.key === fileKey);
  if (index < 0) return { ok: false, error: "File not in source group." };
  const [file] = from.files.splice(index, 1);
  to.files.push(file);
  return { ok: true, draft: next };
}

function reorderGroups(draft, orderedIds) {
  const next = clone(draft);
  if (orderedIds.length !== next.groups.length) {
    return { ok: false, error: "Reorder must include every group." };
  }
  const map = new Map(next.groups.map((g) => [g.id, g]));
  next.groups = orderedIds.map((id) => map.get(id)).filter(Boolean);
  if (next.groups.length !== orderedIds.length) return { ok: false, error: "Unknown group id." };
  return { ok: true, draft: next };
}

function switchMode(draft, mode, { confirm = false } = {}) {
  if (!MODES.includes(mode)) return { ok: false, error: "Unknown mode." };
  if (draft.mode === mode) return { ok: true, draft, changed: false };
  const hasFiles = draft.groups.some((g) => g.files.length > 0);
  if (hasFiles && !confirm) {
    return { ok: false, error: "Confirm destructive mode switch.", needsConfirm: true };
  }
  return { ...createDraft(mode), changed: true };
}

function validateBuilderDraft(draft) {
  const errors = [];
  if (!draft || typeof draft !== "object") {
    return { ok: false, errors: ["missing-draft"] };
  }
  if (!MODES.includes(draft.mode)) errors.push("mode");
  if (!Array.isArray(draft.groups) || draft.groups.length < 2) errors.push("min-groups");
  if (draft.mode === "pair" && draft.groups.length !== 2) errors.push("pair-requires-two");
  if (draft.groups.some((g) => g.files.length === 0)) errors.push("empty-group");
  if (!draft.languageConfirmed || !draft.language) errors.push("language-unconfirmed");
  // Reject mixed-language hints at UI layer when files declare language tags.
  const languages = new Set();
  for (const group of draft.groups) {
    for (const file of group.files) {
      if (file.language) languages.add(file.language);
    }
  }
  if (languages.size > 1) errors.push("mixed-language");
  return { ok: errors.length === 0, errors };
}

function plainLanguageSummary(draft) {
  if (draft.mode === "pair") {
    return "Pair check compares exactly two logical submissions. Each submission may contain multiple files that belong together.";
  }
  return "Batch check compares two or more logical submissions under one language. Keep each student’s project in its own group.";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateGroupUi() {
  const errors = [];
  const pair = createDraft("pair");
  if (!pair.ok || pair.draft.groups.length !== 2) errors.push("pair init");
  const batch = createDraft("batch");
  if (!batch.ok) errors.push("batch init");
  const blocked = switchMode(pair.draft, "batch", { confirm: false });
  // empty groups — switch allowed without confirm
  if (!blocked.ok && blocked.needsConfirm) {
    // unexpected for empty
    errors.push("empty switch should not need confirm");
  }
  pair.draft.groups[0].files.push({ key: "a", displayName: "a.py" });
  const needs = switchMode(pair.draft, "batch", { confirm: false });
  if (!needs.needsConfirm) errors.push("populated switch needs confirm");
  const summary = plainLanguageSummary(pair.draft);
  if (/MOSS|directory-mode|plagiarism/i.test(summary)) errors.push("protocol leakage");
  return { ok: errors.length === 0, errors };
}

module.exports = {
  GROUP_UI_VERSION,
  MODES,
  createDraft,
  renameGroup,
  moveFile,
  reorderGroups,
  switchMode,
  validateBuilderDraft,
  plainLanguageSummary,
  validateGroupUi,
};
