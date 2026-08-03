"use strict";

const {
  FORBIDDEN_PERSISTED_KEYS,
  STORAGE_SCHEMA_VERSION,
  jobStatuses,
  isTerminalStatus,
} = require("./constants.cjs");

function fail(code, message) {
  return { ok: false, code, message };
}

function assertNoForbiddenKeys(value, path = "") {
  if (!value || typeof value !== "object") {
    return null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = assertNoForbiddenKeys(value[i], `${path}[${i}]`);
      if (hit) {
        return hit;
      }
    }
    return null;
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_PERSISTED_KEYS.includes(key)) {
      return fail("forbidden-field", `Persisted state must not include "${key}" at ${path || "root"}`);
    }
    const hit = assertNoForbiddenKeys(value[key], path ? `${path}.${key}` : key);
    if (hit) {
      return hit;
    }
  }
  return null;
}

function validateDraft(draft) {
  if (draft === null) {
    return { ok: true, value: null };
  }
  if (!draft || typeof draft !== "object") {
    return fail("draft-shape", "draft must be an object or null");
  }
  const forbidden = assertNoForbiddenKeys(draft);
  if (forbidden) {
    return forbidden;
  }
  if (typeof draft.draftId !== "string" || draft.draftId.length < 8) {
    return fail("draft-id", "draftId must be an opaque string");
  }
  if (!["pair", "batch"].includes(draft.mode)) {
    return fail("draft-mode", "mode must be pair or batch");
  }
  if (typeof draft.language !== "string" || !draft.language) {
    return fail("draft-language", "language is required");
  }
  if (!Number.isInteger(draft.groupCount) || draft.groupCount < 2) {
    return fail("draft-groups", "groupCount must be an integer ≥ 2");
  }
  if (!draft.flags || typeof draft.flags !== "object" || typeof draft.flags.includeBaseCode !== "boolean") {
    return fail("draft-flags", "flags.includeBaseCode must be boolean");
  }
  if (!Number.isFinite(draft.createdAt) || !Number.isFinite(draft.updatedAt)) {
    return fail("draft-timestamps", "createdAt and updatedAt are required");
  }
  return {
    ok: true,
    value: {
      draftId: draft.draftId,
      mode: draft.mode,
      language: draft.language,
      groupCount: draft.groupCount,
      flags: { includeBaseCode: draft.flags.includeBaseCode },
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    },
  };
}

function validateActiveJob(job) {
  if (job === null) {
    return { ok: true, value: null };
  }
  if (!job || typeof job !== "object") {
    return fail("job-shape", "activeJob must be an object or null");
  }
  const forbidden = assertNoForbiddenKeys(job);
  if (forbidden) {
    return forbidden;
  }
  if (typeof job.jobId !== "string" || job.jobId.length < 8) {
    return fail("job-id", "jobId must be an opaque string");
  }
  if (!jobStatuses.includes(job.status)) {
    return fail("job-status", "unknown job status");
  }
  if (typeof job.submissionIdempotencyKey !== "string" || job.submissionIdempotencyKey.length < 8) {
    return fail("idempotency-key", "submissionIdempotencyKey is required");
  }
  if (!["pair", "batch"].includes(job.mode)) {
    return fail("job-mode", "mode must be pair or batch");
  }
  if (typeof job.language !== "string" || !job.language) {
    return fail("job-language", "language is required");
  }
  if (!Number.isFinite(job.updatedAt)) {
    return fail("job-timestamps", "updatedAt is required");
  }
  if (isTerminalStatus(job.status)) {
    if (!Number.isFinite(job.terminalAt)) {
      return fail("job-terminal-at", "terminal jobs need terminalAt");
    }
  } else if (job.terminalAt != null) {
    return fail("job-terminal-at", "non-terminal jobs must not set terminalAt");
  }
  if (job.reportUrlRef != null) {
    if (typeof job.reportUrlRef !== "string" || /^https?:\/\//i.test(job.reportUrlRef)) {
      return fail("result-ref", "reportUrlRef must be opaque, not a URL");
    }
  }
  return {
    ok: true,
    value: {
      jobId: job.jobId,
      status: job.status,
      mode: job.mode,
      language: job.language,
      submissionIdempotencyKey: job.submissionIdempotencyKey,
      updatedAt: job.updatedAt,
      terminalAt: job.terminalAt ?? null,
      ...(job.reportUrlRef ? { reportUrlRef: job.reportUrlRef } : {}),
    },
  };
}

function validatePersistedState(input) {
  if (!input || typeof input !== "object") {
    return fail("state-shape", "state must be an object");
  }
  const forbidden = assertNoForbiddenKeys(input);
  if (forbidden) {
    return forbidden;
  }
  if (input.schemaVersion !== STORAGE_SCHEMA_VERSION) {
    return fail("schema-version", `unsupported schemaVersion ${input.schemaVersion}`);
  }
  if (!input.shell || typeof input.shell.installedAt !== "number") {
    return fail("shell", "shell.installedAt is required");
  }
  const draft = validateDraft(input.draft ?? null);
  if (!draft.ok) {
    return draft;
  }
  const activeJob = validateActiveJob(input.activeJob ?? null);
  if (!activeJob.ok) {
    return activeJob;
  }
  return {
    ok: true,
    value: {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      shell: { installedAt: input.shell.installedAt },
      draft: draft.value,
      activeJob: activeJob.value,
    },
  };
}

module.exports = {
  assertNoForbiddenKeys,
  validateDraft,
  validateActiveJob,
  validatePersistedState,
};
