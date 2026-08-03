"use strict";

/**
 * Shared comparison domain model (Prompt 036).
 * Compatible across extension, API, and worker. Source bytes and absolute paths
 * never enter persisted metadata.
 */

const SCHEMA_VERSION = 1;

const JOB_STATUSES = Object.freeze([
  "draft",
  "ready",
  "uploading",
  "queued",
  "submitting",
  "waiting",
  "succeeded",
  "failed",
  "cancelled",
  "ambiguous",
]);

const UPLOAD_STATES = Object.freeze([
  "local",
  "pending",
  "uploading",
  "uploaded",
  "failed",
]);

const FORBIDDEN_PERSISTED_FILE_KEYS = Object.freeze([
  "source",
  "content",
  "bytesContent",
  "absolutePath",
  "fullPath",
  "path",
  "webkitRelativePath",
]);

function freezeDeep(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) {
      freezeDeep(nested);
    }
  }
  return value;
}

function safeProtocolName(displayName, index) {
  const base = String(displayName || "file")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return base.length > 0 ? base : `file_${index}`;
}

function assertNoForbiddenKeys(object, pathLabel, errors) {
  if (!object || typeof object !== "object") return;
  for (const key of Object.keys(object)) {
    if (FORBIDDEN_PERSISTED_FILE_KEYS.includes(key)) {
      errors.push({
        code: "forbidden-persisted-field",
        message: `${pathLabel} must not persist ${key}.`,
      });
    }
  }
}

function validateComparison(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return { ok: false, errors: [{ code: "invalid-root", message: "Comparison must be an object." }] };
  }
  if (input.schemaVersion !== SCHEMA_VERSION) {
    errors.push({ code: "schema-version", message: `Unsupported schemaVersion ${input.schemaVersion}.` });
  }
  if (!input.idempotencyKey || typeof input.idempotencyKey !== "string") {
    errors.push({ code: "idempotency-key", message: "idempotencyKey is required." });
  }
  if (!JOB_STATUSES.includes(input.status)) {
    errors.push({ code: "status", message: "Unknown lifecycle status." });
  }
  if (input.mode && !["pair", "batch"].includes(input.mode)) {
    errors.push({ code: "mode", message: "mode must be pair or batch." });
  }
  if (input.mode === "pair" && Array.isArray(input.groups) && input.groups.length !== 2) {
    errors.push({ code: "pair-count", message: "Pair mode requires exactly two groups." });
  }
  if (!Array.isArray(input.groups) || input.groups.length < 2) {
    errors.push({ code: "group-count", message: "At least two logical submissions are required." });
  }
  if (input.owner && typeof input.owner !== "object") {
    errors.push({ code: "owner", message: "owner must be an object when present." });
  }
  if (input.createdAt && Number.isNaN(Date.parse(input.createdAt))) {
    errors.push({ code: "created-at", message: "createdAt must be an ISO timestamp." });
  }
  if (input.updatedAt && Number.isNaN(Date.parse(input.updatedAt))) {
    errors.push({ code: "updated-at", message: "updatedAt must be an ISO timestamp." });
  }

  const languages = new Set();
  const groupIds = new Set();
  (input.groups || []).forEach((group, groupIndex) => {
    if (!group.id || groupIds.has(group.id)) {
      errors.push({ code: "group-id", message: `Group ${groupIndex} needs a stable unique id.` });
    }
    groupIds.add(group.id);
    if (!Array.isArray(group.files) || group.files.length === 0) {
      errors.push({ code: "empty-group", message: `Group ${group.id || groupIndex} is empty.` });
      return;
    }
    const protocolNames = new Set();
    group.files.forEach((file, fileIndex) => {
      assertNoForbiddenKeys(file, `${group.id}/${fileIndex}`, errors);
      if (!file.id) {
        errors.push({ code: "file-id", message: `File in ${group.id} missing stable id.` });
      }
      if (!file.displayName || !file.safeProtocolName) {
        errors.push({
          code: "file-names",
          message: `File in ${group.id} missing displayName/safeProtocolName.`,
        });
      }
      if (file.safeProtocolName && protocolNames.has(file.safeProtocolName)) {
        errors.push({
          code: "duplicate-protocol-name",
          message: `Duplicate safeProtocolName ${file.safeProtocolName} in ${group.id}.`,
        });
      }
      protocolNames.add(file.safeProtocolName);
      if (typeof file.bytes !== "number" || file.bytes < 0) {
        errors.push({ code: "file-bytes", message: `File in ${group.id} needs non-negative bytes.` });
      }
      if (file.contentHash != null && !/^[a-f0-9]{64}$/i.test(file.contentHash)) {
        errors.push({ code: "file-hash", message: `contentHash must be sha256 hex in ${group.id}.` });
      }
      if (file.uploadState && !UPLOAD_STATES.includes(file.uploadState)) {
        errors.push({ code: "upload-state", message: `Unknown uploadState in ${group.id}.` });
      }
      if (file.language) languages.add(file.language);
      if (file.virtualPath && file.virtualPath.includes("..")) {
        errors.push({ code: "path-traversal", message: `Unsafe virtualPath in ${group.id}/${fileIndex}.` });
      }
      if (file.inferredFromPathOnly === true) {
        errors.push({
          code: "untrusted-grouping",
          message: "Grouping must not rely solely on user-controlled paths.",
        });
      }
    });
  });

  if (languages.size > 1) {
    errors.push({ code: "mixed-language", message: "Mixed languages must be rejected or split." });
  }
  if (input.language && languages.size === 1 && [...languages][0] !== input.language) {
    errors.push({ code: "language-mismatch", message: "Selected language does not match files." });
  }

  (input.baseFiles || []).forEach((file, index) => {
    assertNoForbiddenKeys(file, `base/${index}`, errors);
    if (file.countsAsSubmission === true) {
      errors.push({ code: "base-as-submission", message: "Base files must not count as submissions." });
    }
  });

  if (input.result && input.status === "succeeded") {
    if (!input.result.reportUrlRef || typeof input.result.reportUrlRef !== "string") {
      errors.push({ code: "result-ref", message: "Succeeded jobs need an opaque reportUrlRef." });
    }
    if (/https?:\/\//i.test(input.result.reportUrlRef || "")) {
      errors.push({
        code: "result-plaintext-url",
        message: "Domain model stores opaque refs, not plaintext provider URLs.",
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

function stamp(example) {
  const now = "2026-08-03T08:00:00.000Z";
  return freezeDeep({
    ...example,
    owner: example.owner || { deviceId: "dev-local", accountRef: null },
    createdAt: example.createdAt || now,
    updatedAt: example.updatedAt || now,
  });
}

function withUploadMeta(file, index) {
  return {
    ...file,
    id: file.id || `file-${index}`,
    uploadState: file.uploadState || "local",
    contentHash: file.contentHash || null,
  };
}

function enrich(example) {
  const copy = JSON.parse(JSON.stringify(example));
  copy.groups = copy.groups.map((group) => ({
    ...group,
    files: group.files.map((file, index) => withUploadMeta(file, index)),
  }));
  copy.baseFiles = (copy.baseFiles || []).map((file, index) => withUploadMeta(file, index));
  return stamp(copy);
}

// --- fixtures (Prompt 011 + 036) -------------------------------------------------

function exampleTwoFiles() {
  return enrich({
    schemaVersion: SCHEMA_VERSION,
    idempotencyKey: "pair-demo-001",
    status: "ready",
    mode: "pair",
    language: "python",
    groups: [
      {
        id: "submission-a",
        label: "Submission A",
        files: [
          {
            id: "a1",
            displayName: "solution A.py",
            safeProtocolName: safeProtocolName("solution_A.py", 1),
            virtualPath: "submission-a/solution_A.py",
            language: "python",
            bytes: 1200,
            contentHash: "a".repeat(64),
            uploadState: "local",
          },
        ],
      },
      {
        id: "submission-b",
        label: "Submission B",
        files: [
          {
            id: "b1",
            displayName: "solution B.py",
            safeProtocolName: safeProtocolName("solution_B.py", 1),
            virtualPath: "submission-b/solution_B.py",
            language: "python",
            bytes: 1300,
            contentHash: "b".repeat(64),
            uploadState: "local",
          },
        ],
      },
    ],
    baseFiles: [],
    settings: { directoryMode: false, maxMatches: 10, show: 250 },
    result: null,
  });
}

function exampleManyFlatFiles() {
  const groups = [];
  for (let i = 1; i <= 5; i += 1) {
    groups.push({
      id: `file-${i}`,
      label: `File ${i}`,
      files: [
        {
          id: `f${i}`,
          displayName: `main${i}.java`,
          safeProtocolName: `main${i}.java`,
          virtualPath: `file-${i}/main${i}.java`,
          language: "java",
          bytes: 800 + i,
          contentHash: String(i).repeat(64).slice(0, 64),
          uploadState: "local",
        },
      ],
    });
  }
  return enrich({
    schemaVersion: SCHEMA_VERSION,
    idempotencyKey: "flat-5",
    status: "draft",
    mode: "batch",
    language: "java",
    groups,
    baseFiles: [],
    settings: { directoryMode: false, maxMatches: 10, show: 250 },
    result: null,
  });
}

function exampleTwoProjects() {
  return enrich({
    schemaVersion: SCHEMA_VERSION,
    idempotencyKey: "projects-2",
    status: "ready",
    mode: "pair",
    language: "javascript",
    groups: [
      {
        id: "project-atlas",
        label: "Project Atlas",
        files: [
          {
            id: "pa1",
            displayName: "index.js",
            safeProtocolName: "index.js",
            virtualPath: "project-atlas/src/index.js",
            language: "javascript",
            bytes: 1000,
          },
          {
            id: "pa2",
            displayName: "util.js",
            safeProtocolName: "util.js",
            virtualPath: "project-atlas/src/util.js",
            language: "javascript",
            bytes: 400,
          },
        ],
      },
      {
        id: "project-nova",
        label: "Project Nova",
        files: [
          {
            id: "pn1",
            displayName: "index.js",
            safeProtocolName: "index.js",
            virtualPath: "project-nova/src/index.js",
            language: "javascript",
            bytes: 1100,
          },
          {
            id: "pn2",
            displayName: "util.js",
            safeProtocolName: "util.js",
            virtualPath: "project-nova/src/util.js",
            language: "javascript",
            bytes: 420,
          },
        ],
      },
    ],
    baseFiles: [],
    settings: { directoryMode: true, maxMatches: 10, show: 250 },
    result: null,
  });
}

function exampleManyProjects() {
  const groups = [];
  for (let p = 1; p <= 4; p += 1) {
    groups.push({
      id: `project-${p}`,
      label: `Project ${p}`,
      files: [1, 2, 3].map((n) => ({
        id: `p${p}f${n}`,
        displayName: `Module${n}.cs`,
        safeProtocolName: `Module${n}.cs`,
        virtualPath: `project-${p}/src/Module${n}.cs`,
        language: "csharp",
        bytes: 500 + p * 10 + n,
      })),
    });
  }
  return enrich({
    schemaVersion: SCHEMA_VERSION,
    idempotencyKey: "projects-4",
    status: "ready",
    mode: "batch",
    language: "csharp",
    groups,
    baseFiles: [],
    settings: { directoryMode: true, maxMatches: 10, show: 250 },
    result: null,
  });
}

function exampleMixedLanguage() {
  const copy = JSON.parse(JSON.stringify(exampleTwoFiles()));
  copy.groups[1].files[0].language = "javascript";
  copy.language = null;
  return freezeDeep(copy);
}

function exampleWithBaseCode() {
  const copy = JSON.parse(JSON.stringify(exampleTwoFiles()));
  copy.baseFiles = [
    {
      id: "base-1",
      displayName: "starter.py",
      safeProtocolName: "starter.py",
      virtualPath: "base/starter.py",
      language: "python",
      bytes: 300,
      countsAsSubmission: false,
      uploadState: "local",
      contentHash: "c".repeat(64),
    },
  ];
  return freezeDeep(copy);
}

function exampleEmptyGroup() {
  const copy = JSON.parse(JSON.stringify(exampleTwoFiles()));
  copy.groups[1].files = [];
  return freezeDeep(copy);
}

function exampleDuplicateProtocolNames() {
  const copy = JSON.parse(JSON.stringify(exampleTwoProjects()));
  copy.groups[0].files[1].safeProtocolName = "index.js";
  return freezeDeep(copy);
}

function exampleNestedPathTraversal() {
  const copy = JSON.parse(JSON.stringify(exampleTwoFiles()));
  copy.groups[0].files[0].virtualPath = "submission-a/../secret.py";
  return freezeDeep(copy);
}

function exampleWithAbsolutePathLeak() {
  const copy = JSON.parse(JSON.stringify(exampleTwoFiles()));
  copy.groups[0].files[0].absolutePath = "C:\\\\Users\\\\x\\\\secret.py";
  return freezeDeep(copy);
}

function serialize(comparison) {
  return JSON.stringify(comparison);
}

function deserialize(text) {
  return freezeDeep(JSON.parse(text));
}

module.exports = {
  JOB_STATUSES,
  UPLOAD_STATES,
  SCHEMA_VERSION,
  FORBIDDEN_PERSISTED_FILE_KEYS,
  deserialize,
  exampleDuplicateProtocolNames,
  exampleEmptyGroup,
  exampleManyFlatFiles,
  exampleManyProjects,
  exampleMixedLanguage,
  exampleNestedPathTraversal,
  exampleTwoFiles,
  exampleTwoProjects,
  exampleWithAbsolutePathLeak,
  exampleWithBaseCode,
  safeProtocolName,
  serialize,
  validateComparison,
};
