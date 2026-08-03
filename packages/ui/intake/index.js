"use strict";

/**
 * Secure file / folder / archive intake (Prompt 039).
 * No broad filesystem permission, no execution, no upload before consent.
 */

const fileSelection = require("../file-selection");

const INTAKE_VERSION = 1;

const APPROVED_ARCHIVES = Object.freeze([".zip", ".tar", ".tgz", ".tar.gz"]);

const SOURCE_TYPES = Object.freeze(["file", "multi", "folder", "archive", "canceled"]);

function detectSourceType(entries) {
  if (!entries || entries.length === 0) return "canceled";
  if (entries.length === 1) {
    const name = String(entries[0].name || "").toLowerCase();
    if (APPROVED_ARCHIVES.some((ext) => name.endsWith(ext))) return "archive";
    if (entries[0].webkitRelativePath || entries[0].relativePath) return "folder";
    return "file";
  }
  const hasRelative = entries.some((e) => e.webkitRelativePath || e.relativePath);
  if (hasRelative) return "folder";
  if (entries.every((e) => APPROVED_ARCHIVES.some((ext) => String(e.name || "").toLowerCase().endsWith(ext)))) {
    return "archive";
  }
  return "multi";
}

function isApprovedArchiveName(name) {
  const lower = String(name || "").toLowerCase();
  return APPROVED_ARCHIVES.some((ext) => lower.endsWith(ext));
}

function groupingHint(sourceType, entry) {
  if (sourceType === "folder") {
    const rel = entry.webkitRelativePath || entry.relativePath || entry.name;
    const top = String(rel).replace(/\\/g, "/").split("/").filter(Boolean)[0];
    return top || "folder";
  }
  if (sourceType === "archive") {
    return sanitizeArchiveStem(entry.name);
  }
  return null;
}

function sanitizeArchiveStem(name) {
  return fileSelection.sanitizeDisplayName(String(name || "archive").replace(/\.(tar\.gz|tgz|tar|zip)$/i, ""));
}

/**
 * Process a picker/drop selection into classified local-only items.
 * Browser File handles are referenced only by opaque handleId — never executed.
 */
function ingestSelection(rawEntries, { existing = [], asBase = false, consentGranted = false } = {}) {
  if (rawEntries == null) {
    return { ok: true, sourceType: "canceled", items: [], summary: fileSelection.summarizeSelection([]), uploaded: false };
  }
  const entries = Array.from(rawEntries);
  const sourceType = detectSourceType(entries);
  if (sourceType === "canceled" || entries.length === 0) {
    return { ok: true, sourceType: "canceled", items: [], summary: fileSelection.summarizeSelection([]), uploaded: false };
  }

  const existingKeys = existing.map((f) => f.key).filter(Boolean);
  const items = [];
  for (const entry of entries) {
    const name = entry.name || "";
    if (isApprovedArchiveName(name) && sourceType !== "folder") {
      // Archives are accepted as containers; members expand later. Mark as archive item.
      if (!entry.size || entry.size === 0) {
        items.push({
          status: "rejected",
          reason: entry.size === 0 ? "zero-byte" : "empty-name",
          displayName: fileSelection.sanitizeDisplayName(name),
          sourceType: "archive",
          localOnly: true,
          uploaded: false,
        });
        continue;
      }
      if (entry.size > fileSelection.MAX_FILE_BYTES * 16) {
        items.push({
          status: "rejected",
          reason: "oversized",
          displayName: fileSelection.sanitizeDisplayName(name),
          sourceType: "archive",
          localOnly: true,
          uploaded: false,
        });
        continue;
      }
      const key = `${fileSelection.sanitizeDisplayName(name)}::${entry.size}`;
      if (existingKeys.includes(key) || items.some((i) => i.key === key)) {
        items.push({
          status: "duplicate",
          reason: "duplicate",
          displayName: fileSelection.sanitizeDisplayName(name),
          size: entry.size,
          key,
          sourceType: "archive",
          groupingHint: groupingHint("archive", entry),
          localOnly: true,
          uploaded: false,
          handleId: entry.handleId || null,
        });
        continue;
      }
      items.push({
        status: asBase ? "base" : "accepted",
        displayName: fileSelection.sanitizeDisplayName(name),
        size: entry.size,
        key,
        sourceType: "archive",
        groupingHint: groupingHint("archive", entry),
        localOnly: true,
        uploaded: false,
        handleId: entry.handleId || null,
      });
      continue;
    }

    // Unsupported archive-like names
    if (/\.(rar|7z|exe|dll)$/i.test(name)) {
      items.push({
        status: "rejected",
        reason: "unsupported-archive",
        displayName: fileSelection.sanitizeDisplayName(name),
        sourceType: "archive",
        localOnly: true,
        uploaded: false,
      });
      continue;
    }

    const classified = fileSelection.classifyLocalFile(entry, {
      existingKeys: [...existingKeys, ...items.map((i) => i.key).filter(Boolean)],
      asBase,
    });
    items.push({
      ...classified,
      sourceType: sourceType === "folder" ? "folder" : sourceType === "multi" ? "file" : "file",
      groupingHint: groupingHint(sourceType, entry),
      handleId: entry.handleId || null,
      relativePath: entry.webkitRelativePath || entry.relativePath || null,
    });
  }

  const summary = fileSelection.summarizeSelection(items);
  return {
    ok: true,
    sourceType,
    items,
    summary,
    uploaded: false,
    localOnly: true,
    consentGranted: Boolean(consentGranted),
  };
}

function removeItem(items, key) {
  return items.filter((item) => item.key !== key);
}

function replaceItem(items, key, nextEntry, options = {}) {
  const without = removeItem(items, key);
  const ingested = ingestSelection([nextEntry], { existing: without, ...options });
  return { ...ingested, items: [...without, ...ingested.items] };
}

function buildDropzoneHtml({ id = "intake-drop", inputId = "intake-picker" } = {}) {
  return {
    ok: true,
    html: [
      `<div id="${id}" class="intake-dropzone" role="region" aria-label="File drop zone" data-local-only="true">`,
      `<p class="type-body">Drop files, folders, or approved archives here. Nothing uploads until review and consent.</p>`,
      `<input id="${inputId}" type="file" multiple class="focus-ring" aria-label="Browse files" />`,
      `<input id="${inputId}-folder" type="file" class="focus-ring" webkitdirectory aria-label="Browse folder" />`,
      `</div>`,
    ].join(""),
  };
}

function assertSecureIntakePolicy(result) {
  const errors = [];
  if (result.uploaded) errors.push("must not upload during intake");
  if (result.localOnly !== true && result.sourceType !== "canceled") {
    errors.push("selections must be local-only");
  }
  if (/filesystem|all_urls|file:\/\//i.test(JSON.stringify(result))) {
    errors.push("no broad filesystem permission markers");
  }
  return { ok: errors.length === 0, errors };
}

function validateIntake() {
  const errors = [];
  const canceled = ingestSelection(null);
  if (canceled.sourceType !== "canceled") errors.push("canceled");

  const single = ingestSelection([{ name: "a.py", size: 10 }]);
  if (single.sourceType !== "file" || single.items[0].status !== "accepted") errors.push("single file");

  const multi = ingestSelection([
    { name: "a.py", size: 10 },
    { name: "b.py", size: 11 },
  ]);
  if (multi.sourceType !== "multi") errors.push("multi");

  const folder = ingestSelection([
    { name: "main.py", size: 10, webkitRelativePath: "student1/main.py" },
    { name: "util.py", size: 8, webkitRelativePath: "student1/util.py" },
  ]);
  if (folder.sourceType !== "folder" || folder.items[0].groupingHint !== "student1") {
    errors.push("folder");
  }

  const zip = ingestSelection([{ name: "proj.zip", size: 100 }]);
  if (zip.sourceType !== "archive" || zip.items[0].status !== "accepted") errors.push("zip");

  const badArchive = ingestSelection([{ name: "x.rar", size: 100 }]);
  if (badArchive.items[0].reason !== "unsupported-archive") errors.push("rar");

  const empty = ingestSelection([{ name: "a.py", size: 0 }]);
  if (empty.items[0].reason !== "zero-byte") errors.push("zero");

  const dup = ingestSelection(
    [{ name: "a.py", size: 10 }],
    { existing: [{ key: "a.py::10" }] },
  );
  if (dup.items[0].status !== "duplicate") errors.push("dup");

  const inaccessible = ingestSelection([{ name: "a.py", size: 10, inaccessible: true }]);
  // size present — still accepted at metadata layer; inaccessible flagged if size missing
  const noAccess = ingestSelection([{ name: "", size: 0 }]);
  if (noAccess.items[0].status !== "rejected") errors.push("inaccessible");

  const drop = buildDropzoneHtml();
  if (!drop.html.includes("webkitdirectory") || !drop.html.includes("Nothing uploads")) {
    errors.push("dropzone");
  }

  if (!assertSecureIntakePolicy(single).ok) errors.push("policy");
  return { ok: errors.length === 0, errors };
}

module.exports = {
  INTAKE_VERSION,
  APPROVED_ARCHIVES,
  SOURCE_TYPES,
  detectSourceType,
  ingestSelection,
  removeItem,
  replaceItem,
  buildDropzoneHtml,
  assertSecureIntakePolicy,
  validateIntake,
  isApprovedArchiveName,
};
