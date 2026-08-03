"use strict";

/**
 * Optional base-code handling (Prompt 042).
 * Base files suppress expected overlap; they never become comparison groups.
 */

const intake = require("../intake");
const grouping = require("../grouping");

const BASE_VERSION = 1;

function explainBaseEffect() {
  return {
    title: "Optional base / starter code",
    body: "Instructor-provided skeleton, starter, or shared library files can suppress expected overlap and reduce false-positive similarity matches. Base files are never compared as submissions.",
  };
}

function addBaseFiles(draft, rawEntries, { language = null, capabilities = null } = {}) {
  const next = clone(draft);
  next.baseFiles = next.baseFiles || [];
  const result = intake.ingestSelection(rawEntries, {
    existing: [...filesFromDraft(next), ...next.baseFiles],
    asBase: true,
    consentGranted: false,
  });
  if (!result.ok) return { ok: false, error: result.error || "intake-failed", draft: next };

  const added = [];
  const rejected = [];
  for (const item of result.items) {
    if (item.status === "rejected" || item.status === "duplicate") {
      rejected.push(item);
      continue;
    }
    if (item.status !== "accepted" && item.status !== "base") continue;
    const marked = {
      ...item,
      sourceType: "base",
      role: "base",
      status: "accepted",
      id: item.id || grouping.newId("base"),
    };
    const langCheck = validateBaseLanguage(marked, language, capabilities);
    if (!langCheck.ok) {
      marked.status = "rejected";
      marked.reason = langCheck.error;
      rejected.push(marked);
    } else {
      added.push(marked);
      next.baseFiles.push(marked);
    }
  }

  return {
    ok: true,
    draft: next,
    added,
    rejected,
    explanation: explainBaseEffect(),
    uploaded: false,
  };
}

function validateBaseLanguage(file, language, capabilities) {
  if (!language) return { ok: true };
  if (!capabilities || !Array.isArray(capabilities.languages)) return { ok: true };
  const lang = capabilities.languages.find((l) => l.code === language);
  if (!lang) return { ok: false, error: "unknown-language" };
  const name = String(file.displayName || "").toLowerCase();
  const ext = name.includes(".") ? `.${name.split(".").pop()}` : "";
  if (ext && Array.isArray(lang.extensions) && lang.extensions.length && !lang.extensions.includes(ext)) {
    return { ok: false, error: "wrong-language" };
  }
  return { ok: true };
}

function replaceBaseFile(draft, baseId, rawEntry) {
  const removed = removeBaseFile(draft, baseId);
  if (!removed.ok) return removed;
  return addBaseFiles(removed.draft, [rawEntry], {
    language: draft.language,
  });
}

function removeBaseFile(draft, baseId) {
  const next = clone(draft);
  const before = (next.baseFiles || []).length;
  next.baseFiles = (next.baseFiles || []).filter((f) => f.id !== baseId && f.key !== baseId);
  if (next.baseFiles.length === before) return { ok: false, error: "base-not-found", draft };
  return { ok: true, draft: next };
}

function clearBaseFiles(draft) {
  const next = clone(draft);
  next.baseFiles = [];
  return { ok: true, draft: next };
}

function markBaseInReview(draft) {
  return {
    baseFiles: (draft.baseFiles || []).map((f) => ({
      id: f.id,
      displayName: f.displayName,
      bytes: f.size || f.bytes || 0,
      role: "base",
      distinct: true,
    })),
    note: "Base files are listed separately and do not count as comparison groups.",
    groupIds: (draft.groups || []).map((g) => g.id),
  };
}

function validateBaseHandling(draft) {
  const errors = [];
  const groupIds = new Set((draft.groups || []).map((g) => g.id));
  for (const base of draft.baseFiles || []) {
    if (base.role !== "base" && base.sourceType !== "base") {
      errors.push("base-not-marked");
    }
    if (groupIds.has(base.id)) errors.push("base-collides-group-id");
    for (const group of draft.groups || []) {
      if ((group.files || []).some((f) => f.key === base.key || f.id === base.id)) {
        errors.push("base-in-submission-group");
      }
    }
  }
  const keys = (draft.baseFiles || []).map((f) => f.key).filter(Boolean);
  if (new Set(keys).size !== keys.length) errors.push("duplicate-base");
  return { ok: errors.length === 0, errors, review: markBaseInReview(draft) };
}

function buildBasePanelHtml(draft) {
  const explanation = explainBaseEffect();
  const review = markBaseInReview(draft);
  const list = review.baseFiles
    .map(
      (f) =>
        `<li data-base-id="${escape(f.id)}" data-role="base"><span class="type-code">${escape(f.displayName)}</span> <em>base</em></li>`,
    )
    .join("");
  return {
    ok: true,
    html: `<section class="base-panel" aria-labelledby="base-heading"><h2 id="base-heading">${escape(explanation.title)}</h2><p class="type-helper">${escape(explanation.body)}</p><ul>${list || "<li class=\"type-helper\">No base files</li>"}</ul><p class="type-helper">${escape(review.note)}</p></section>`,
  };
}

function validateBaseModule() {
  const errors = [];
  let draft = { mode: "batch", language: "python", groups: [{ id: "g1", label: "A", files: [] }, { id: "g2", label: "B", files: [] }], baseFiles: [] };
  const caps = { languages: [{ code: "python", extensions: [".py"] }] };

  const none = validateBaseHandling(draft);
  if (!none.ok) errors.push("no-base");

  const one = addBaseFiles(draft, [{ name: "starter.py", size: 10 }], { language: "python", capabilities: caps });
  if (!one.ok || one.draft.baseFiles.length !== 1) errors.push("one-base");
  draft = one.draft;

  const many = addBaseFiles(draft, [{ name: "lib.py", size: 5 }, { name: "util.py", size: 5 }], {
    language: "python",
    capabilities: caps,
  });
  if (many.draft.baseFiles.length < 3) errors.push("many-base");
  draft = many.draft;

  const wrong = addBaseFiles(draft, [{ name: "Main.java", size: 8 }], {
    language: "python",
    capabilities: caps,
  });
  if (wrong.added.length !== 0 && !wrong.rejected?.length) {
    // wrong language should reject
  }
  if (wrong.draft.baseFiles.some((f) => f.displayName === "Main.java" && f.status === "accepted")) {
    errors.push("wrong-language");
  }

  const dup = addBaseFiles(draft, [{ name: "starter.py", size: 10 }], {
    language: "python",
    capabilities: caps,
  });
  // duplicate key may reject via intake
  const idsBefore = draft.groups.map((g) => g.id).join(",");
  const removed = removeBaseFile(draft, draft.baseFiles[0].id);
  if (!removed.ok) errors.push("removal");
  if (removed.draft.groups.map((g) => g.id).join(",") !== idsBefore) errors.push("identity-changed");

  const vsSub = validateBaseHandling({
    ...draft,
    baseFiles: [{ id: "b1", key: "x", displayName: "a.py", role: "base", sourceType: "base" }],
    groups: [{ id: "g1", label: "A", files: [{ id: "f1", key: "x", displayName: "a.py" }] }],
  });
  if (!vsSub.errors.includes("base-in-submission-group")) errors.push("base-vs-submission");

  if (!buildBasePanelHtml(draft).html.includes("never compared as submissions")) errors.push("html");
  return { ok: errors.length === 0, errors };
}

function filesFromDraft(draft) {
  return (draft.groups || []).flatMap((g) => g.files || []);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

module.exports = {
  BASE_VERSION,
  explainBaseEffect,
  addBaseFiles,
  replaceBaseFile,
  removeBaseFile,
  clearBaseFiles,
  markBaseInReview,
  validateBaseHandling,
  buildBasePanelHtml,
  validateBaseModule,
};
