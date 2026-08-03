"use strict";

/**
 * Submission grouping and preview (Prompt 041).
 * Suggests groups from top-level folders; flat files stay separate by default.
 * Stable internal IDs only — never trust temporary server paths as identity.
 */

const crypto = require("node:crypto");
const groupBuilder = require("../group-builder");

const GROUPING_VERSION = 1;

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function topLevelFolder(item) {
  const rel = item.relativePath || item.webkitRelativePath || item.groupingHint;
  if (!rel) return null;
  const parts = String(rel).replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.length > 1 ? parts[0] : item.groupingHint || null;
}

/**
 * Build suggested groups from intake items (excluding base files).
 */
function suggestGroups(items, { mode = "batch" } = {}) {
  const files = (items || []).filter((item) => item.status === "accepted" && item.sourceType !== "base");
  const byFolder = new Map();
  const flat = [];

  for (const item of files) {
    const folder = topLevelFolder(item);
    if (folder) {
      if (!byFolder.has(folder)) byFolder.set(folder, []);
      byFolder.get(folder).push(item);
    } else if (item.sourceType === "archive" && item.groupingHint) {
      const key = item.groupingHint;
      if (!byFolder.has(key)) byFolder.set(key, []);
      byFolder.get(key).push(item);
    } else {
      flat.push(item);
    }
  }

  const groups = [];
  for (const [label, members] of byFolder) {
    groups.push({
      id: newId("grp"),
      label: String(label).slice(0, 80),
      files: members.map(toGroupFile),
    });
  }
  for (const item of flat) {
    groups.push({
      id: newId("grp"),
      label: item.displayName.slice(0, 80),
      files: [toGroupFile(item)],
    });
  }

  if (mode === "pair" && groups.length === 0) {
    return groupBuilder.createDraft("pair").draft.groups;
  }
  if (mode === "pair" && groups.length === 1) {
    groups.push({ id: newId("grp"), label: "Submission B", files: [] });
  }
  if (mode === "pair" && groups.length > 2) {
    // Preview still shows all; validation will block continue.
  }
  if (mode === "batch" && groups.length < 2) {
    while (groups.length < 2) {
      groups.push({ id: newId("grp"), label: `Group ${groups.length + 1}`, files: [] });
    }
  }
  return groups;
}

function toGroupFile(item) {
  return {
    id: item.id || newId("file"),
    key: item.key,
    displayName: item.displayName,
    bytes: item.size || item.bytes || 0,
    sourceType: item.sourceType || "file",
  };
}

function previewComparison(draft) {
  const groups = (draft.groups || []).map((group) => ({
    id: group.id,
    label: group.label,
    fileCount: (group.files || []).length,
    files: (group.files || []).map((f) => ({
      id: f.id,
      displayName: f.displayName,
      bytes: f.bytes || 0,
    })),
    bytes: (group.files || []).reduce((sum, f) => sum + (f.bytes || 0), 0),
  }));
  return {
    mode: draft.mode,
    language: draft.language,
    languageConfirmed: Boolean(draft.languageConfirmed),
    groupCount: groups.length,
    totalFiles: groups.reduce((n, g) => n + g.fileCount, 0),
    totalBytes: groups.reduce((n, g) => n + g.bytes, 0),
    baseFileCount: (draft.baseFiles || []).length,
    groups,
    identityNote: "Group identity uses stable internal IDs only — never temporary server paths.",
  };
}

function mergeGroups(draft, sourceId, targetId) {
  const next = clone(draft);
  const source = next.groups.find((g) => g.id === sourceId);
  const target = next.groups.find((g) => g.id === targetId);
  if (!source || !target || sourceId === targetId) {
    return { ok: false, error: "Invalid merge targets." };
  }
  target.files.push(...source.files);
  next.groups = next.groups.filter((g) => g.id !== sourceId);
  return { ok: true, draft: next };
}

function splitGroup(draft, groupId, fileKeys) {
  const next = clone(draft);
  const group = next.groups.find((g) => g.id === groupId);
  if (!group) return { ok: false, error: "Group not found." };
  const moving = group.files.filter((f) => fileKeys.includes(f.key || f.id));
  if (moving.length === 0) return { ok: false, error: "No files to split." };
  group.files = group.files.filter((f) => !fileKeys.includes(f.key || f.id));
  next.groups.push({
    id: newId("grp"),
    label: `${group.label} (split)`,
    files: moving,
  });
  return { ok: true, draft: next };
}

function validateGrouping(draft) {
  const errors = [];
  const preview = previewComparison(draft);
  if (draft.mode === "pair" && preview.groupCount !== 2) {
    errors.push("pair-requires-exactly-two-groups");
  }
  if (draft.mode === "batch" && preview.groupCount < 2) {
    errors.push("batch-requires-at-least-two-groups");
  }
  if (preview.groups.some((g) => g.fileCount === 0)) {
    errors.push("empty-group");
  }
  const ids = new Set();
  for (const group of draft.groups || []) {
    if (ids.has(group.id)) errors.push("duplicate-group-id");
    ids.add(group.id);
    if (/tmp|temp|uploads\//i.test(group.id) || /https?:/i.test(group.label || "")) {
      errors.push("untrusted-path-identity");
    }
  }
  return { ok: errors.length === 0, errors, preview };
}

function buildPreviewHtml(draft) {
  const preview = previewComparison(draft);
  const rows = preview.groups
    .map(
      (g) =>
        `<section class="group-preview" data-group-id="${escape(g.id)}"><h3 class="type-subtitle">${escape(g.label)}</h3><p class="type-helper">${g.fileCount} files · ${g.bytes} bytes</p><ul>${g.files
          .map((f) => `<li class="type-code">${escape(f.displayName)}</li>`)
          .join("")}</ul></section>`,
    )
    .join("");
  return {
    ok: true,
    html: `<div class="grouping-preview" role="region" aria-label="Comparison preview"><p class="type-body">${escape(preview.identityNote)}</p>${rows}</div>`,
    preview,
  };
}

function validateGroupingModule() {
  const errors = [];
  const flat = suggestGroups(
    [
      { status: "accepted", displayName: "a.py", size: 1, key: "a.py::1", sourceType: "file" },
      { status: "accepted", displayName: "b.py", size: 2, key: "b.py::2", sourceType: "file" },
    ],
    { mode: "batch" },
  );
  if (flat.length !== 2) errors.push("flat-separate");

  const projects = suggestGroups(
    [
      {
        status: "accepted",
        displayName: "main.py",
        size: 1,
        key: "1",
        relativePath: "alice/main.py",
        sourceType: "folder",
      },
      {
        status: "accepted",
        displayName: "util.py",
        size: 1,
        key: "2",
        relativePath: "alice/util.py",
        sourceType: "folder",
      },
      {
        status: "accepted",
        displayName: "main.py",
        size: 1,
        key: "3",
        relativePath: "bob/main.py",
        sourceType: "folder",
      },
    ],
    { mode: "batch" },
  );
  if (projects.length !== 2) errors.push("two-projects");
  if (projects.find((g) => g.label === "alice")?.files.length !== 2) errors.push("alice-multi");

  const archives = suggestGroups(
    [
      { status: "accepted", displayName: "p1.zip", size: 10, key: "z1", sourceType: "archive", groupingHint: "p1" },
      { status: "accepted", displayName: "p2.zip", size: 10, key: "z2", sourceType: "archive", groupingHint: "p2" },
      { status: "accepted", displayName: "p3.zip", size: 10, key: "z3", sourceType: "archive", groupingHint: "p3" },
    ],
    { mode: "batch" },
  );
  if (archives.length !== 3) errors.push("many-archives");

  let draft = {
    mode: "batch",
    language: "python",
    languageConfirmed: true,
    groups: projects,
    baseFiles: [],
  };
  const merged = mergeGroups(draft, projects[0].id, projects[1].id);
  if (!merged.ok || merged.draft.groups.length !== 1) errors.push("merge");

  draft = { mode: "batch", groups: projects, baseFiles: [] };
  const split = splitGroup(draft, projects[0].id, [projects[0].files[0].key]);
  if (!split.ok || split.draft.groups.length < 3) errors.push("split");

  const renamed = groupBuilder.renameGroup(draft, projects[0].id, "Alice");
  if (!renamed.ok) errors.push("rename");

  const moved = groupBuilder.moveFile(
    { ...draft, groups: JSON.parse(JSON.stringify(projects)) },
    projects[0].id,
    projects[1].id,
    projects[0].files[0].key,
  );
  if (!moved.ok) errors.push("move");

  const pairBad = validateGrouping({ mode: "pair", groups: projects.slice(0, 1) });
  if (pairBad.ok) errors.push("pair-validation");

  const html = buildPreviewHtml({ mode: "batch", groups: projects });
  if (!html.html.includes("stable internal IDs")) errors.push("preview-html");

  return { ok: errors.length === 0, errors };
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
  GROUPING_VERSION,
  suggestGroups,
  previewComparison,
  mergeGroups,
  splitGroup,
  validateGrouping,
  buildPreviewHtml,
  validateGroupingModule,
  newId,
};
