"use strict";

/**
 * Collision-safe protocol names and manifest mapping (Prompt 057).
 */

const crypto = require("node:crypto");

const NAMES_VERSION = 1;

function sanitizeProtocolName(raw, { maxLength = 64 } = {}) {
  if (raw == null) return { ok: false, error: "empty" };
  let value = String(raw).normalize("NFC");
  if (/[\u0000-\u001f\u007f]/.test(value)) return { ok: false, error: "controls" };
  if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/") || value.startsWith("\\\\")) {
    return { ok: false, error: "absolute-path" };
  }
  if (/users?\\|home\/|storageKey|uploads\//i.test(value)) return { ok: false, error: "sensitive-path" };
  value = value.replace(/\\/g, "/");
  // Drop directory leakage — provider sees virtual names only
  const base = value.split("/").filter(Boolean).pop() || "file";
  let safe = base.replace(/[^A-Za-z0-9._+-]+/g, "_");
  if (!safe || safe === "." || safe === "..") safe = "file";
  // reserved
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(safe)) safe = `f_${safe}`;
  if (safe.length > maxLength) {
    const ext = safe.includes(".") ? safe.slice(safe.lastIndexOf(".")) : "";
    safe = `${safe.slice(0, Math.max(1, maxLength - ext.length - 8))}_${shortHash(safe)}${ext}`.slice(0, maxLength);
  }
  return { ok: true, name: safe, displayName: base };
}

function buildProtocolManifest(productManifest) {
  const used = new Map();
  const files = [];
  const displayMap = [];
  const groups = [];

  for (const group of productManifest.groups || []) {
    const groupRoot = `g${groups.length + 1}`;
    const fileNames = [];
    for (const file of group.files || []) {
      const sanitized = sanitizeProtocolName(file.displayName || file.normalizedPath || file.name);
      if (!sanitized.ok) return { ok: false, error: sanitized.error };
      let name = `${groupRoot}/${sanitized.name}`;
      let n = 1;
      while (used.has(name.toLowerCase())) {
        const parts = sanitized.name.split(".");
        const stem = parts.length > 1 ? parts.slice(0, -1).join(".") : sanitized.name;
        const ext = parts.length > 1 ? `.${parts[parts.length - 1]}` : "";
        name = `${groupRoot}/${stem}_${n}${ext}`;
        n += 1;
      }
      used.set(name.toLowerCase(), true);
      const id = file.id || `f_${files.length + 1}`;
      files.push({ id, protocolName: name, bytes: file.bytes || 0, groupId: group.id || groupRoot });
      displayMap.push({ id, displayName: sanitized.displayName, protocolName: name });
      fileNames.push(name);
    }
    groups.push({
      id: group.id || groupRoot,
      label: String(group.label || groupRoot).slice(0, 80),
      protocolNames: fileNames,
    });
  }

  // Ensure no drive/username leakage in protocol payload
  const blob = JSON.stringify({ files, groups });
  if (/[A-Za-z]:\\|Users\\|home\//i.test(blob)) return { ok: false, error: "path-leak" };

  return {
    ok: true,
    manifest: Object.freeze({
      schemaVersion: NAMES_VERSION,
      files: Object.freeze(files.map((f) => Object.freeze(f))),
      groups: Object.freeze(groups.map((g) => Object.freeze(g))),
      displayMap: Object.freeze(displayMap.map((d) => Object.freeze(d))),
      hash: crypto.createHash("sha256").update(blob).digest("hex"),
    }),
  };
}

function shortHash(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 6);
}

function validateNamesModule() {
  const errors = [];
  if (sanitizeProtocolName("a\u0000.py").ok) errors.push("controls");
  if (sanitizeProtocolName("C:/Users/x/a.py").ok) errors.push("abs");
  if (!sanitizeProtocolName("My File.py").ok) errors.push("space");
  if (sanitizeProtocolName("My File.py").name.includes(" ")) errors.push("space2");

  const long = "a".repeat(200) + ".py";
  const s = sanitizeProtocolName(long);
  if (!s.ok || s.name.length > 64) errors.push("long");

  const m1 = buildProtocolManifest({
    groups: [
      { id: "g1", label: "A", files: [{ id: "1", displayName: "main.py", bytes: 1 }, { id: "2", displayName: "main.py", bytes: 1 }] },
      { id: "g2", label: "B", files: [{ id: "3", displayName: "main.py", bytes: 1 }] },
    ],
  });
  if (!m1.ok) errors.push("build");
  const names = m1.manifest.files.map((f) => f.protocolName);
  if (new Set(names).size !== names.length) errors.push("collision");

  const m2 = buildProtocolManifest({
    groups: [
      { id: "g1", label: "A", files: [{ displayName: "café.py", bytes: 1 }] },
      { id: "g2", label: "B", files: [{ displayName: "cafe\u0301.py", bytes: 1 }] },
    ],
  });
  if (!m2.ok) errors.push("unicode");

  const d1 = buildProtocolManifest({
    groups: [
      { id: "g1", label: "A", files: [{ displayName: "a.py", bytes: 1 }] },
      { id: "g2", label: "B", files: [{ displayName: "b.py", bytes: 1 }] },
    ],
  });
  const d2 = buildProtocolManifest({
    groups: [
      { id: "g1", label: "A", files: [{ displayName: "a.py", bytes: 1 }] },
      { id: "g2", label: "B", files: [{ displayName: "b.py", bytes: 1 }] },
    ],
  });
  if (d1.manifest.hash !== d2.manifest.hash) errors.push("determinism");

  return { ok: errors.length === 0, errors };
}

module.exports = {
  NAMES_VERSION,
  sanitizeProtocolName,
  buildProtocolManifest,
  validateNamesModule,
};
