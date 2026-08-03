"use strict";

/**
 * Map product jobs to provider command sequences (Prompt 059).
 */

const { buildProtocolManifest } = require("./protocol-names");

const COMMANDS_VERSION = 1;
const LANG_MAP = Object.freeze({
  python: "python",
  java: "java",
  cpp: "cc",
  c: "c",
  javascript: "javascript",
});

function mapJobToCommands(job) {
  const errors = [];
  if (!job?.language || !LANG_MAP[job.language]) {
    return { ok: false, error: "language-rejection" };
  }
  if (job.settings?.experimental) return { ok: false, error: "experimental-disabled" };
  if (!job.groups || job.groups.length < 2) return { ok: false, error: "empty-or-insufficient-groups" };
  for (const group of job.groups) {
    if (!group.files?.length) return { ok: false, error: "empty-group" };
  }

  const built = buildProtocolManifest({ groups: job.groups });
  if (!built.ok) return built;

  const commands = [];
  // Deterministic authorized sequence — no free-form input
  commands.push({ type: "auth", line: `userid ${job.providerUserId}` });
  commands.push({ type: "language", line: `language ${LANG_MAP[job.language]}` });
  const threshold = clampInt(job.settings?.commonMatchThreshold ?? 10, 1, 1000);
  const resultCount = clampInt(job.settings?.resultCount ?? 250, 1, 1000);
  commands.push({ type: "limits", line: `maxmatches ${threshold}` });
  commands.push({ type: "limits", line: `show ${resultCount}` });
  const title = sanitizeTitle(job.title || "untitled");
  commands.push({ type: "title", line: `title ${title}` });

  // directory mode derived
  const directoryMode = job.groups.some((g) => g.files.length > 1) ? 1 : 0;
  commands.push({ type: "grouping", line: `directory ${directoryMode}` });

  for (const base of job.baseFiles || []) {
    const name = built.manifest.displayMap.find((d) => d.id === base.id)?.protocolName || `base/${base.displayName}`;
    commands.push({ type: "base", line: `addbase file ${name} ${base.bytes || 0}` });
  }

  let fileIndex = 0;
  for (const group of built.manifest.groups) {
    commands.push({ type: "group", line: `begin group ${group.id}` });
    for (const protocolName of group.protocolNames) {
      const file = built.manifest.files.find((f) => f.protocolName === protocolName);
      commands.push({
        type: "file",
        line: `file ${protocolName} ${file.bytes}`,
        bytes: file.bytes,
        protocolName,
        order: fileIndex++,
      });
    }
    commands.push({ type: "group-end", line: `end group ${group.id}` });
  }

  commands.push({ type: "query", line: "query" });
  commands.push({ type: "end", line: "end" });

  // Validate no controls in lines
  for (const cmd of commands) {
    if (/[\u0000-\u001f\u007f]/.test(cmd.line)) errors.push("controls");
  }
  if (errors.length) return { ok: false, error: "controls" };

  return {
    ok: true,
    commands: Object.freeze(commands.map((c) => Object.freeze(c))),
    manifest: built.manifest,
    transcriptFingerprint: fingerprint(commands),
  };
}

function clampInt(n, min, max) {
  const v = Number(n);
  if (!Number.isInteger(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function sanitizeTitle(title) {
  return String(title).replace(/[;`|$<>\u0000-\u001f]/g, "").trim().slice(0, 80) || "untitled";
}

function fingerprint(commands) {
  return commands.map((c) => c.line).join("\n");
}

function validateCommandsModule() {
  const errors = [];
  const pair = mapJobToCommands({
    providerUserId: "12345",
    language: "python",
    title: "Pair Lab",
    settings: { resultCount: 100, commonMatchThreshold: 10 },
    groups: [
      { id: "g1", label: "A", files: [{ id: "1", displayName: "a.py", bytes: 3 }] },
      { id: "g2", label: "B", files: [{ id: "2", displayName: "b.py", bytes: 4 }] },
    ],
  });
  if (!pair.ok) errors.push("pair");
  if (!pair.commands.some((c) => c.type === "query")) errors.push("query");

  const batch = mapJobToCommands({
    providerUserId: "12345",
    language: "java",
    title: "Batch",
    groups: [
      { id: "g1", label: "A", files: [{ id: "1", displayName: "A.java", bytes: 1 }, { id: "2", displayName: "B.java", bytes: 1 }] },
      { id: "g2", label: "B", files: [{ id: "3", displayName: "C.java", bytes: 1 }] },
      { id: "g3", label: "C", files: [{ id: "4", displayName: "D.java", bytes: 1 }] },
    ],
  });
  if (!batch.ok || !batch.commands.some((c) => c.line === "directory 1")) errors.push("projects");

  const withBase = mapJobToCommands({
    providerUserId: "12345",
    language: "python",
    title: "Base",
    baseFiles: [{ id: "base1", displayName: "starter.py", bytes: 9 }],
    groups: [
      { id: "g1", label: "A", files: [{ id: "1", displayName: "a.py", bytes: 1 }] },
      { id: "g2", label: "B", files: [{ id: "2", displayName: "b.py", bytes: 1 }] },
    ],
  });
  if (!withBase.ok || !withBase.commands.some((c) => c.type === "base")) errors.push("base");

  const again = mapJobToCommands({
    providerUserId: "12345",
    language: "python",
    title: "Pair Lab",
    settings: { resultCount: 100, commonMatchThreshold: 10 },
    groups: [
      { id: "g1", label: "A", files: [{ id: "1", displayName: "a.py", bytes: 3 }] },
      { id: "g2", label: "B", files: [{ id: "2", displayName: "b.py", bytes: 4 }] },
    ],
  });
  if (again.transcriptFingerprint !== pair.transcriptFingerprint) errors.push("snapshot");

  if (mapJobToCommands({ language: "nope", groups: [{ files: [{}] }, { files: [{}] }] }).ok) errors.push("lang");
  if (mapJobToCommands({ language: "python", settings: { experimental: true }, groups: [{ files: [{}] }, { files: [{}] }] }).ok) {
    errors.push("exp");
  }
  if (mapJobToCommands({ language: "python", groups: [{ id: "g1", files: [] }, { id: "g2", files: [{ displayName: "a.py", bytes: 1 }] }] }).ok) {
    errors.push("empty");
  }

  return { ok: errors.length === 0, errors };
}

module.exports = {
  COMMANDS_VERSION,
  LANG_MAP,
  mapJobToCommands,
  validateCommandsModule,
};
