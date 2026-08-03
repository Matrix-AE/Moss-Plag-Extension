"use strict";

/**
 * File selection components (Prompt 032).
 * Nothing uploads before final review/consent — local checks only.
 */

const FILE_UI_VERSION = 1;

const ACCEPTED_EXTENSIONS = Object.freeze([
  ".c", ".cc", ".cpp", ".cxx", ".h", ".hpp", ".java", ".py", ".js", ".ts", ".cs", ".go", ".rs", ".php", ".rb", ".swift", ".kt", ".m", ".mm", ".scala",
]);

const MAX_FILE_BYTES = 2 * 1024 * 1024;

function sanitizeDisplayName(name) {
  return String(name || "file")
    .replace(/[<>:"|?*\u0000-\u001f]/g, "_")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .slice(0, 180);
}

function classifyLocalFile(file, { existingKeys = [], asBase = false } = {}) {
  const displayName = sanitizeDisplayName(file && file.name);
  const size = Number(file && file.size) || 0;
  const ext = displayName.includes(".") ? `.${displayName.split(".").pop().toLowerCase()}` : "";
  const key = `${displayName}::${size}`;

  if (!file || !displayName) {
    return { status: "rejected", reason: "empty-name", displayName };
  }
  if (size === 0) {
    return { status: "rejected", reason: "zero-byte", displayName, size };
  }
  if (size > MAX_FILE_BYTES) {
    return { status: "rejected", reason: "oversized", displayName, size };
  }
  if (ext && !ACCEPTED_EXTENSIONS.includes(ext)) {
    return { status: "rejected", reason: "unsupported-type", displayName, ext };
  }
  if (existingKeys.includes(key)) {
    return { status: "duplicate", reason: "duplicate", displayName, size, key };
  }
  return {
    status: asBase ? "base" : "accepted",
    displayName,
    size,
    ext,
    key,
    uploaded: false,
    localOnly: true,
  };
}

function summarizeSelection(files) {
  const totals = { accepted: 0, rejected: 0, duplicate: 0, base: 0, bytes: 0 };
  for (const file of files) {
    totals[file.status] = (totals[file.status] || 0) + 1;
    if (file.status === "accepted" || file.status === "base") {
      totals.bytes += file.size || 0;
    }
  }
  return totals;
}

function buildFileRow(file) {
  const label = `${file.displayName} (${file.status})`;
  return {
    html: `<div class="file-row" data-status="${file.status}" role="listitem"><span class="type-code">${escape(file.displayName)}</span><span class="badge type-caption" role="status">${escape(file.status)}</span><button type="button" class="focus-ring" data-action="remove" aria-label="Remove ${escape(file.displayName)}">Remove</button></div>`,
    label,
  };
}

function assertNoUploadBeforeConsent({ consentGranted, attemptUpload }) {
  if (attemptUpload && !consentGranted) {
    return { ok: false, error: "Upload blocked until final review consent." };
  }
  return { ok: true };
}

function validateFileUi() {
  const errors = [];
  const ok = classifyLocalFile({ name: "a.py", size: 10 });
  if (ok.status !== "accepted") errors.push("py should accept");
  const big = classifyLocalFile({ name: "a.py", size: MAX_FILE_BYTES + 1 });
  if (big.status !== "rejected") errors.push("oversized should reject");
  const zero = classifyLocalFile({ name: "a.py", size: 0 });
  if (zero.reason !== "zero-byte") errors.push("zero-byte");
  const dup = classifyLocalFile({ name: "a.py", size: 10 }, { existingKeys: ["a.py::10"] });
  if (dup.status !== "duplicate") errors.push("duplicate");
  const blocked = assertNoUploadBeforeConsent({ consentGranted: false, attemptUpload: true });
  if (blocked.ok) errors.push("consent gate failed");
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
  FILE_UI_VERSION,
  ACCEPTED_EXTENSIONS,
  MAX_FILE_BYTES,
  sanitizeDisplayName,
  classifyLocalFile,
  summarizeSelection,
  buildFileRow,
  assertNoUploadBeforeConsent,
  validateFileUi,
};
