"use strict";

const { STORAGE_BACKEND } = require("./constants.cjs");
const { migrateStorage } = require("./migrate.cjs");
const { purgeExpired } = require("./purge.cjs");
const { validateDraft, validateActiveJob, validatePersistedState } = require("./validate.cjs");
const { isTerminalStatus } = require("./constants.cjs");

/**
 * In-memory storage used by tests and as the contract the Chrome adapter must match.
 * Worker memory is intentionally NOT used — every read goes through this store.
 */
function createMemoryStorage(seed = {}) {
  const data = { ...seed };
  return {
    backend: STORAGE_BACKEND,
    async get(keys) {
      if (keys == null) {
        return { ...data };
      }
      const list = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const key of list) {
        if (key in data) {
          out[key] = data[key];
        }
      }
      return out;
    },
    async set(values) {
      Object.assign(data, values);
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const key of list) {
        delete data[key];
      }
    },
    async clear() {
      for (const key of Object.keys(data)) {
        delete data[key];
      }
    },
    snapshot() {
      return structuredClone(data);
    },
  };
}

const STATE_KEY = "moss.state";

function createStateStore(storage, options = {}) {
  if (storage.backend && storage.backend !== "local") {
    throw new Error("Only storage.local is allowed; sync is forbidden");
  }

  let workerScratch = null; // deliberately unused for durable reads — distrust worker memory

  async function readRaw() {
    const bag = await storage.get(STATE_KEY);
    return bag[STATE_KEY];
  }

  async function writeState(state) {
    const validated = validatePersistedState(state);
    if (!validated.ok) {
      return validated;
    }
    await storage.set({ [STATE_KEY]: validated.value });
    workerScratch = null; // never treat worker memory as authoritative
    return { ok: true, value: validated.value };
  }

  async function load(now = options.now?.() ?? Date.now()) {
    const raw = await readRaw();
    const migrated = migrateStorage(raw, now);
    const purged = purgeExpired(migrated.state, now);
    const next = purged.state;
    if (migrated.migrated || purged.changed || raw === undefined) {
      const written = await writeState(next);
      if (!written.ok) {
        return written;
      }
      return {
        ok: true,
        value: written.value,
        migrated: migrated.migrated,
        purged: purged.events,
        migrationLog: migrated.log,
      };
    }
    return { ok: true, value: next, migrated: false, purged: [], migrationLog: [] };
  }

  async function saveDraft(draftInput, now = options.now?.() ?? Date.now()) {
    const current = await load(now);
    if (!current.ok) {
      return current;
    }
    const draft = validateDraft({
      ...draftInput,
      updatedAt: now,
      createdAt: draftInput.createdAt ?? now,
    });
    if (!draft.ok) {
      return draft;
    }
    return writeState({ ...current.value, draft: draft.value });
  }

  async function discardDraft(now = options.now?.() ?? Date.now()) {
    const current = await load(now);
    if (!current.ok) {
      return current;
    }
    return writeState({ ...current.value, draft: null });
  }

  /**
   * Bind an opaque job id. Reopening with the same idempotency key does not create a second job.
   * Starting a job discards the draft (upload start purge).
   */
  async function bindJob(jobInput, now = options.now?.() ?? Date.now()) {
    const current = await load(now);
    if (!current.ok) {
      return current;
    }

    const existing = current.value.activeJob;
    if (
      existing &&
      existing.submissionIdempotencyKey === jobInput.submissionIdempotencyKey &&
      !isTerminalStatus(existing.status)
    ) {
      // Recoverable reopen — return the existing binding without duplicating submission.
      return { ok: true, value: current.value, rebound: true, duplicated: false };
    }

    if (existing && !isTerminalStatus(existing.status) && existing.jobId !== jobInput.jobId) {
      return {
        ok: false,
        code: "active-job-exists",
        message: "An active job is already bound; wait for terminal state before starting another.",
      };
    }

    const job = validateActiveJob({
      ...jobInput,
      updatedAt: now,
      terminalAt: isTerminalStatus(jobInput.status) ? jobInput.terminalAt ?? now : null,
    });
    if (!job.ok) {
      return job;
    }

    return writeState({
      ...current.value,
      draft: null, // purge draft on upload/start
      activeJob: job.value,
    }).then((written) =>
      written.ok ? { ok: true, value: written.value, rebound: false, duplicated: false } : written,
    );
  }

  async function updateJob(patch, now = options.now?.() ?? Date.now()) {
    const current = await load(now);
    if (!current.ok) {
      return current;
    }
    if (!current.value.activeJob) {
      return { ok: false, code: "no-active-job", message: "No active job to update" };
    }
    if (patch.jobId && patch.jobId !== current.value.activeJob.jobId) {
      return { ok: false, code: "job-mismatch", message: "jobId does not match the bound job" };
    }

    const nextStatus = patch.status ?? current.value.activeJob.status;
    const terminalAt = isTerminalStatus(nextStatus)
      ? current.value.activeJob.terminalAt ?? now
      : null;

    const job = validateActiveJob({
      ...current.value.activeJob,
      ...patch,
      status: nextStatus,
      updatedAt: now,
      terminalAt,
      submissionIdempotencyKey: current.value.activeJob.submissionIdempotencyKey,
      jobId: current.value.activeJob.jobId,
    });
    if (!job.ok) {
      return job;
    }
    return writeState({ ...current.value, activeJob: job.value });
  }

  async function forcePurge(now = options.now?.() ?? Date.now()) {
    const current = await load(now);
    if (!current.ok) {
      return current;
    }
    // load() already applies TTL purge and persists; surface those events to the caller.
    return { ok: true, value: current.value, purged: current.purged || [] };
  }

  function peekWorkerScratch() {
    return workerScratch;
  }

  return {
    load,
    saveDraft,
    discardDraft,
    bindJob,
    updateJob,
    forcePurge,
    peekWorkerScratch,
    STATE_KEY,
  };
}

module.exports = { STATE_KEY, createMemoryStorage, createStateStore };
