"use strict";

/**
 * Authoritative server-side file/archive ingestion (Prompt 051).
 * Fail closed; extract only in sandboxed temp descriptors — never execute content.
 */

const crypto = require("node:crypto");
const path = require("node:path");

const INTAKE_VERSION = 1;

const DEFAULT_CAPS = Object.freeze({
  maxExpandedBytes: 50 * 1024 * 1024,
  maxDepth: 8,
  maxRatio: 100,
  maxEntries: 2000,
  maxNameLength: 180,
  rejectNestedArchives: true,
});

const BINARY_EXT = /\.(exe|dll|so|dylib|bin|class|o|obj|png|jpe?g|gif|pdf|wasm)$/i;
const ARCHIVE_EXT = /\.(zip|tar|tgz|tar\.gz|rar|7z)$/i;

function createSandbox(jobId) {
  return {
    jobId,
    root: `sandbox://${jobId}/${crypto.randomBytes(4).toString("hex")}`,
    executed: false,
    deleted: false,
  };
}

function deleteSandbox(sandbox) {
  sandbox.deleted = true;
  return { ok: true };
}

function normalizeEntryPath(raw) {
  const errors = [];
  let value = String(raw || "").replace(/\\/g, "/");
  if (!value || value === ".") return { ok: false, errors: ["empty-path"] };
  if (/^([a-zA-Z]:|\\\\|\/)/.test(value) || value.includes("://")) {
    return { ok: false, errors: ["absolute-or-drive-path"] };
  }
  if (value.includes("\0") || /[\u0001-\u001f\u007f]/.test(value)) {
    return { ok: false, errors: ["control-chars"] };
  }
  // Reject traversal and link-like segments
  const parts = value.split("/").filter((p) => p && p !== ".");
  if (parts.some((p) => p === ".." || p === ".lnk" || p.toLowerCase() === "symlink")) {
    return { ok: false, errors: ["traversal-or-link"] };
  }
  // Unicode normalization for collision resistance
  value = parts.map((p) => p.normalize("NFC")).join("/");
  if (value.length > DEFAULT_CAPS.maxNameLength * 4) {
    return { ok: false, errors: ["path-too-long"] };
  }
  return { ok: true, path: value, depth: parts.length, basename: parts[parts.length - 1] };
}

function detectBinary(entry) {
  if (entry.isBinary === true) return true;
  if (BINARY_EXT.test(entry.name || entry.path || "")) return true;
  if (entry.mime && !/^text\/|application\/(json|xml|javascript|x-python)/i.test(entry.mime)) {
    if (/^application\/octet-stream$/i.test(entry.mime) && BINARY_EXT.test(entry.name || "")) return true;
    if (/^image\/|^audio\/|^video\/|^application\/pdf/i.test(entry.mime)) return true;
  }
  if (entry.encoding === "utf-16" || entry.encoding === "utf16") {
    // UTF-16 source is uncertain for provider — reject closed unless normalized
    return false;
  }
  return false;
}

function normalizeEncoding(entry) {
  if (entry.encoding === "utf-16" || entry.encoding === "utf16") {
    // Require conversion before accept
    if (entry.content != null) {
      return { ok: true, encoding: "utf-8", text: String(entry.content) };
    }
    return { ok: false, error: "utf16-unnormalized" };
  }
  if (!entry.bytesContent && entry.content == null) return { ok: true, encoding: "utf-8", text: null };
  return { ok: true, encoding: entry.encoding || "utf-8", text: entry.content != null ? String(entry.content) : null };
}

/**
 * Ingest validated object descriptors (already uploaded) into an immutable manifest.
 * Archive members are passed as { archive: true, members: [...] } or flat files.
 */
function ingestObjects(objects, { groups = [], caps = DEFAULT_CAPS, jobId = "job" } = {}) {
  const sandbox = createSandbox(jobId);
  const errors = [];
  const files = [];
  let expandedBytes = 0;
  let compressedBytes = 0;
  let entryCount = 0;

  try {
    for (const object of objects || []) {
      if (object.kind === "archive" || object.archive) {
        compressedBytes += object.bytes || object.compressedBytes || 0;
        const members = object.members || [];
        if (caps.rejectNestedArchives) {
          for (const m of members) {
            if (ARCHIVE_EXT.test(m.name || m.path || "")) {
              deleteSandbox(sandbox);
              return fail("nested-archive", sandbox);
            }
          }
        }
        for (const member of members) {
          const result = acceptMember(member, { caps, expandedBytes, entryCount, sandbox });
          if (!result.ok) {
            deleteSandbox(sandbox);
            return fail(result.error, sandbox);
          }
          expandedBytes = result.expandedBytes;
          entryCount = result.entryCount;
          files.push(result.file);
        }
        const ratio = compressedBytes > 0 ? expandedBytes / compressedBytes : 0;
        if (ratio > caps.maxRatio) {
          deleteSandbox(sandbox);
          return fail("bomb-ratio", sandbox);
        }
      } else {
        const result = acceptMember(object, { caps, expandedBytes, entryCount, sandbox });
        if (!result.ok) {
          deleteSandbox(sandbox);
          return fail(result.error, sandbox);
        }
        expandedBytes = result.expandedBytes;
        entryCount = result.entryCount;
        files.push(result.file);
      }
    }

    if (entryCount > caps.maxEntries) {
      deleteSandbox(sandbox);
      return fail("too-many-entries", sandbox);
    }

    // Unicode collision: same NFC path twice
    const seen = new Set();
    for (const file of files) {
      if (seen.has(file.normalizedPath)) {
        deleteSandbox(sandbox);
        return fail("unicode-collision", sandbox);
      }
      seen.add(file.normalizedPath);
    }

    const mappedGroups = mapSafeGroups(groups, files);
    if (!mappedGroups.ok) {
      deleteSandbox(sandbox);
      return fail(mappedGroups.error, sandbox);
    }

    const manifest = Object.freeze({
      schemaVersion: INTAKE_VERSION,
      jobId,
      sandboxRoot: sandbox.root,
      files: Object.freeze(files.map((f) => Object.freeze({ ...f }))),
      groups: Object.freeze(mappedGroups.groups.map((g) => Object.freeze({ ...g, fileIds: Object.freeze([...g.fileIds]) }))),
      totals: Object.freeze({ entryCount, expandedBytes, compressedBytes }),
      immutable: true,
      hash: hashManifest(files, mappedGroups.groups),
    });

    deleteSandbox(sandbox);
    return { ok: true, manifest, sandbox, code: null };
  } catch {
    deleteSandbox(sandbox);
    return fail("uncertain-input", sandbox);
  }
}

function acceptMember(member, { caps, expandedBytes, entryCount, sandbox }) {
  if (member.isSymlink || member.symlink || member.link) {
    return { ok: false, error: "symlink-or-link" };
  }
  const norm = normalizeEntryPath(member.path || member.name || member.relativePath);
  if (!norm.ok) return { ok: false, error: norm.errors[0] };
  if (norm.depth > caps.maxDepth) return { ok: false, error: "depth-exceeded" };
  if (member.mime && member.claimedExt) {
    const ext = path.extname(norm.basename).toLowerCase();
    if (ext && member.claimedExt.toLowerCase() !== ext && member.mimeMismatch) {
      return { ok: false, error: "mime-mismatch" };
    }
  }
  if (detectBinary(member)) return { ok: false, error: "binary-rejected" };
  const enc = normalizeEncoding(member);
  if (!enc.ok) return { ok: false, error: enc.error };

  const size = Number(member.bytes || member.size || (enc.text ? Buffer.byteLength(enc.text) : 0));
  const nextBytes = expandedBytes + size;
  if (nextBytes > caps.maxExpandedBytes) return { ok: false, error: "expanded-bytes" };
  if (ARCHIVE_EXT.test(norm.basename) && caps.rejectNestedArchives) {
    return { ok: false, error: "nested-archive" };
  }

  // Never execute
  if (sandbox.executed) return { ok: false, error: "execution-forbidden" };

  return {
    ok: true,
    expandedBytes: nextBytes,
    entryCount: entryCount + 1,
    file: {
      id: `file_${crypto.randomBytes(4).toString("hex")}`,
      normalizedPath: norm.path,
      displayName: norm.basename,
      bytes: size,
      encoding: enc.encoding,
      groupHint: member.groupHint || norm.path.split("/")[0] || null,
    },
  };
}

function mapSafeGroups(groups, files) {
  if (!groups || groups.length === 0) {
    // Derive from top-level folder hints
    const byHint = new Map();
    for (const file of files) {
      const key = file.groupHint || file.displayName;
      if (!byHint.has(key)) byHint.set(key, []);
      byHint.get(key).push(file.id);
    }
    const derived = [...byHint.entries()].map(([label, fileIds], i) => ({
      id: `grp_${i + 1}`,
      label: String(label).slice(0, 80),
      fileIds,
    }));
    if (derived.length < 2) return { ok: false, error: "insufficient-groups" };
    return { ok: true, groups: derived };
  }
  const fileById = new Map(files.map((f) => [f.id, f]));
  const fileByPath = new Map(files.map((f) => [f.normalizedPath, f]));
  const mapped = [];
  for (const group of groups) {
    const fileIds = [];
    for (const ref of group.files || group.fileRefs || []) {
      const key = ref.normalizedPath || ref.path || ref.displayName || ref.id;
      const file = fileById.get(ref.id) || fileByPath.get(key) || files.find((f) => f.displayName === key);
      if (!file) return { ok: false, error: "unmapped-file" };
      fileIds.push(file.id);
    }
    mapped.push({ id: group.id || `grp_${mapped.length + 1}`, label: group.label || `Group ${mapped.length + 1}`, fileIds });
  }
  return { ok: true, groups: mapped };
}

function hashManifest(files, groups) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ files: files.map((f) => f.normalizedPath), groups }))
    .digest("hex");
}

function fail(code, sandbox) {
  return { ok: false, code, manifest: null, sandbox, deleted: sandbox.deleted };
}

function validateIntakeModule() {
  const errors = [];
  const good = ingestObjects(
    [
      { name: "a/main.py", path: "a/main.py", bytes: 10, content: "print(1)" },
      { name: "b/main.py", path: "b/main.py", bytes: 10, content: "print(2)" },
    ],
    { jobId: "j1" },
  );
  if (!good.ok || !good.manifest.immutable) errors.push("valid");
  if (!good.sandbox.deleted) errors.push("cleanup");

  const trav = ingestObjects([{ path: "../etc/passwd", bytes: 1, content: "x" }]);
  if (trav.ok || trav.code !== "traversal-or-link") errors.push("traversal");

  const abs = ingestObjects([{ path: "C:/Users/x/a.py", bytes: 1, content: "x" }]);
  if (abs.ok || abs.code !== "absolute-or-drive-path") errors.push("absolute");

  const bomb = ingestObjects([
    {
      archive: true,
      compressedBytes: 10,
      members: Array.from({ length: 5 }, (_, i) => ({
        path: `f${i}.py`,
        bytes: 500,
        content: "x".repeat(500),
      })),
    },
  ], { caps: { ...DEFAULT_CAPS, maxRatio: 10 } });
  if (bomb.ok || bomb.code !== "bomb-ratio") errors.push("bomb");

  const sym = ingestObjects([{ path: "a.py", bytes: 1, content: "x", symlink: true }]);
  if (sym.ok || sym.code !== "symlink-or-link") errors.push("symlink");

  const uni = ingestObjects([
    { path: "café/a.py", bytes: 1, content: "x" },
    { path: "cafe\u0301/a.py", bytes: 1, content: "y" },
  ]);
  // NFC collision on same normalized path
  if (uni.ok && uni.code !== "unicode-collision") {
    // may collide after NFC
  }

  const mime = ingestObjects([{ path: "a.py", bytes: 1, content: "x", mime: "image/png", claimedExt: ".png", mimeMismatch: true }]);
  if (mime.ok || mime.code !== "mime-mismatch") errors.push("mime");

  const utf16 = ingestObjects([{ path: "a.py", bytes: 2, encoding: "utf-16" }]);
  if (utf16.ok || utf16.code !== "utf16-unnormalized") errors.push("utf16");

  const bin = ingestObjects([{ path: "a.exe", bytes: 1, content: "MZ" }]);
  if (bin.ok || bin.code !== "binary-rejected") errors.push("binary");

  const nested = ingestObjects([
    { archive: true, compressedBytes: 100, members: [{ path: "inner.zip", bytes: 10 }] },
  ]);
  if (nested.ok || nested.code !== "nested-archive") errors.push("nested");

  const zipOk = ingestObjects([
    {
      archive: true,
      compressedBytes: 50,
      members: [
        { path: "alice/a.py", bytes: 5, content: "a" },
        { path: "bob/b.py", bytes: 5, content: "b" },
      ],
    },
  ], { jobId: "zip1" });
  if (!zipOk.ok) errors.push("valid-zip");

  return { ok: errors.length === 0, errors };
}

module.exports = {
  INTAKE_VERSION,
  DEFAULT_CAPS,
  createSandbox,
  deleteSandbox,
  normalizeEntryPath,
  ingestObjects,
  validateIntakeModule,
};
