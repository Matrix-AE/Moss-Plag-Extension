"use strict";

/**
 * Client-side preflight validation (Prompt 043).
 * Backend remains authoritative; client checks are advisory/blocking UX only.
 */

const grouping = require("../grouping");

const PREFLIGHT_VERSION = 1;

const DEFAULT_LIMITS = Object.freeze({
  version: 1,
  maxGroups: 250,
  maxFilesPerGroup: 500,
  maxTotalFiles: 2000,
  maxFileBytes: 2 * 1024 * 1024,
  maxTotalBytes: 50 * 1024 * 1024,
  maxNameLength: 180,
});

function normalizeLimits(serverLimits) {
  if (!serverLimits || typeof serverLimits !== "object") {
    return { ok: false, error: "stale-or-missing-limits", limits: null };
  }
  if (typeof serverLimits.version !== "number") {
    return { ok: false, error: "capability-version-mismatch", limits: null };
  }
  return { ok: true, limits: { ...DEFAULT_LIMITS, ...serverLimits } };
}

function isBinaryName(name) {
  return /\.(exe|dll|so|dylib|bin|class|o|obj|png|jpe?g|gif|pdf|zip|tar|gz)$/i.test(name);
}

function hasControlChars(name) {
  return /[\u0000-\u001f\u007f]/.test(name);
}

function runPreflight(draft, { limits: rawLimits = DEFAULT_LIMITS, hashes = [] } = {}) {
  const normalized = normalizeLimits(rawLimits);
  if (!normalized.ok) {
    return {
      ok: false,
      canProceed: false,
      errors: [{ code: normalized.error, message: "Server limits missing or stale — refresh capabilities.", blocking: true }],
      warnings: [],
      acknowledgedWarnings: false,
    };
  }
  const limits = normalized.limits;
  const errors = [];
  const warnings = [];

  const groupingResult = grouping.validateGrouping(draft);
  for (const code of groupingResult.errors) {
    errors.push({ code, message: humanize(code), blocking: true });
  }

  if (!draft.language || !draft.languageConfirmed) {
    errors.push({ code: "language-unconfirmed", message: "Confirm a programming language before upload.", blocking: true });
  }

  let totalFiles = 0;
  let totalBytes = 0;
  const names = [];
  const seenHashes = new Map();

  for (const group of draft.groups || []) {
    const files = group.files || [];
    if (files.length === 0) {
      errors.push({ code: "empty-group", message: `Group “${group.label}” has no files.`, blocking: true });
    }
    if (files.length > limits.maxFilesPerGroup) {
      errors.push({ code: "files-per-group", message: "A group exceeds the file count limit.", blocking: true });
    }
    for (const file of files) {
      totalFiles += 1;
      totalBytes += file.bytes || file.size || 0;
      names.push(file.displayName);
      if ((file.bytes || 0) > limits.maxFileBytes) {
        errors.push({ code: "file-too-large", message: `${file.displayName} exceeds size limit.`, blocking: true });
      }
      if (!file.displayName || !String(file.displayName).trim()) {
        errors.push({ code: "empty-name", message: "A file is missing a display name.", blocking: true });
      }
      if (String(file.displayName || "").length > limits.maxNameLength) {
        errors.push({ code: "name-too-long", message: "A file name exceeds the allowed length.", blocking: true });
      }
      if (hasControlChars(file.displayName || "")) {
        errors.push({ code: "control-name", message: "File names cannot contain control characters.", blocking: true });
      }
      if (isBinaryName(file.displayName || "")) {
        errors.push({ code: "binary-rejected", message: `${file.displayName} looks binary and cannot be compared.`, blocking: true });
      }
      if (file.encoding && !["utf-8", "utf8", "ascii"].includes(String(file.encoding).toLowerCase())) {
        warnings.push({ code: "encoding-unusual", message: `${file.displayName} uses a non-UTF-8 encoding.`, blocking: false });
      }
      if (file.sourceType === "archive" && !file.archiveMetaOk) {
        warnings.push({ code: "archive-meta", message: `${file.displayName} archive metadata should be rechecked.`, blocking: false });
      }
    }
  }

  if ((draft.groups || []).length > limits.maxGroups) {
    errors.push({ code: "too-many-groups", message: "Too many submission groups.", blocking: true });
  }
  if (totalFiles > limits.maxTotalFiles) {
    errors.push({ code: "too-many-files", message: "Total file count exceeds the limit.", blocking: true });
  }
  if (totalBytes > limits.maxTotalBytes) {
    errors.push({ code: "too-many-bytes", message: "Total upload size exceeds the limit.", blocking: true });
  }

  const nameCounts = names.reduce((m, n) => m.set(n, (m.get(n) || 0) + 1), new Map());
  for (const [name, count] of nameCounts) {
    if (count > 1) {
      warnings.push({ code: "duplicate-name", message: `Duplicate display name: ${name}`, blocking: false });
    }
  }

  for (const entry of hashes) {
    if (!entry?.hash) continue;
    if (seenHashes.has(entry.hash)) {
      warnings.push({
        code: "duplicate-hash",
        message: `Identical content detected between ${seenHashes.get(entry.hash)} and ${entry.name}`,
        blocking: false,
      });
    } else {
      seenHashes.set(entry.hash, entry.name);
    }
  }

  const canProceed = errors.filter((e) => e.blocking).length === 0;
  return {
    ok: canProceed && (warnings.length === 0 || Boolean(draft.warningsAcknowledged)),
    canProceed,
    errors,
    warnings,
    limitsVersion: limits.version,
    summary: { totalFiles, totalBytes, groupCount: (draft.groups || []).length },
  };
}

function acknowledgeWarnings(draft, report) {
  if (!report.canProceed) return { ok: false, error: "blocking-errors", draft };
  if (report.warnings.length === 0) return { ok: true, draft: { ...draft, warningsAcknowledged: true } };
  return { ok: true, draft: { ...clone(draft), warningsAcknowledged: true, warningFingerprint: fingerprint(report.warnings) } };
}

function resetAcknowledgements(draft) {
  const next = clone(draft);
  delete next.warningsAcknowledged;
  delete next.warningFingerprint;
  return next;
}

function materialChangeResets(prevDraft, nextDraft) {
  const prev = JSON.stringify({
    groups: prevDraft.groups,
    language: prevDraft.language,
    baseFiles: prevDraft.baseFiles,
    settings: prevDraft.settings,
  });
  const next = JSON.stringify({
    groups: nextDraft.groups,
    language: nextDraft.language,
    baseFiles: nextDraft.baseFiles,
    settings: nextDraft.settings,
  });
  if (prev !== next) return resetAcknowledgements(nextDraft);
  return nextDraft;
}

function buildPreflightHtml(report) {
  const err = report.errors.map((e) => `<li data-blocking="true">${escape(e.message)}</li>`).join("");
  const warn = report.warnings.map((w) => `<li data-blocking="false">${escape(w.message)}</li>`).join("");
  return {
    html: `<div class="preflight" role="region" aria-label="Preflight findings"><h3>Blocking</h3><ul>${err || "<li>None</li>"}</ul><h3>Warnings</h3><ul>${warn || "<li>None</li>"}</ul></div>`,
  };
}

function validatePreflightModule() {
  const errors = [];
  const limits = { ...DEFAULT_LIMITS, version: 1 };
  const good = {
    mode: "batch",
    language: "python",
    languageConfirmed: true,
    groups: [
      { id: "g1", label: "A", files: [{ id: "f1", key: "k1", displayName: "a.py", bytes: 10 }] },
      { id: "g2", label: "B", files: [{ id: "f2", key: "k2", displayName: "b.py", bytes: 10 }] },
    ],
    baseFiles: [],
  };
  const ok = runPreflight(good, { limits });
  if (!ok.canProceed) errors.push("good");

  const badLang = runPreflight({ ...good, languageConfirmed: false }, { limits });
  if (badLang.canProceed) errors.push("lang");

  const binary = runPreflight(
    {
      ...good,
      groups: [
        { id: "g1", label: "A", files: [{ id: "f1", key: "k1", displayName: "a.exe", bytes: 10 }] },
        good.groups[1],
      ],
    },
    { limits },
  );
  if (!binary.errors.some((e) => e.code === "binary-rejected")) errors.push("binary");

  const control = runPreflight(
    {
      ...good,
      groups: [
        { id: "g1", label: "A", files: [{ id: "f1", key: "k1", displayName: "a\u0000.py", bytes: 10 }] },
        good.groups[1],
      ],
    },
    { limits },
  );
  if (!control.errors.some((e) => e.code === "control-name")) errors.push("control");

  const edge = runPreflight(good, { limits: { ...limits, maxFileBytes: 10 } });
  if (!edge.canProceed) errors.push("boundary-inclusive");

  const over = runPreflight(
    {
      ...good,
      groups: [
        { id: "g1", label: "A", files: [{ id: "f1", key: "k1", displayName: "a.py", bytes: 11 }] },
        good.groups[1],
      ],
    },
    { limits: { ...limits, maxFileBytes: 10 } },
  );
  if (over.canProceed) errors.push("over-size");

  const dupHash = runPreflight(good, {
    limits,
    hashes: [
      { hash: "abc", name: "a.py" },
      { hash: "abc", name: "b.py" },
    ],
  });
  if (!dupHash.warnings.some((w) => w.code === "duplicate-hash")) errors.push("dup-hash");

  const stale = runPreflight(good, { limits: null });
  if (stale.canProceed) errors.push("stale");

  const withWarn = { ...good };
  const report = runPreflight(withWarn, {
    limits,
    hashes: [
      { hash: "abc", name: "a.py" },
      { hash: "abc", name: "b.py" },
    ],
  });
  if (report.ok) errors.push("warn-block");
  const ack = acknowledgeWarnings(withWarn, report);
  if (!ack.ok || !ack.draft.warningsAcknowledged) errors.push("ack");
  const reset = materialChangeResets(ack.draft, {
    ...ack.draft,
    language: "java",
  });
  if (reset.warningsAcknowledged) errors.push("reset");

  return { ok: errors.length === 0, errors };
}

function humanize(code) {
  return String(code).replaceAll("-", " ");
}

function fingerprint(warnings) {
  return warnings.map((w) => w.code + w.message).join("|");
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
  PREFLIGHT_VERSION,
  DEFAULT_LIMITS,
  normalizeLimits,
  runPreflight,
  acknowledgeWarnings,
  resetAcknowledgements,
  materialChangeResets,
  buildPreflightHtml,
  validatePreflightModule,
};
