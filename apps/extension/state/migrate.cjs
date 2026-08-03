"use strict";

const { STORAGE_SCHEMA_VERSION, emptyState } = require("./constants.cjs");
const { validatePersistedState } = require("./validate.cjs");

/**
 * Migrate whatever is in storage.local into the current schema.
 * Unknown or corrupted blobs reset to empty rather than inventing sensitive recovery.
 */
function migrateStorage(raw, now = Date.now()) {
  const log = [];

  if (raw == null || (typeof raw === "object" && Object.keys(raw).length === 0)) {
    const next = emptyState(now);
    log.push({ from: null, to: STORAGE_SCHEMA_VERSION, reason: "empty" });
    return { ok: true, state: next, migrated: true, log };
  }

  if (typeof raw !== "object") {
    const next = emptyState(now);
    log.push({ from: typeof raw, to: STORAGE_SCHEMA_VERSION, reason: "non-object" });
    return { ok: true, state: next, migrated: true, log };
  }

  // Legacy shell-only key from Prompt 023.
  if ("shellInstalledAt" in raw && !("schemaVersion" in raw)) {
    const next = emptyState(Number(raw.shellInstalledAt) || now);
    log.push({ from: "shell-v0", to: STORAGE_SCHEMA_VERSION, reason: "promote-shell-key" });
    return { ok: true, state: next, migrated: true, log };
  }

  if (raw.schemaVersion === STORAGE_SCHEMA_VERSION) {
    const validated = validatePersistedState(raw);
    if (!validated.ok) {
      const next = emptyState(now);
      log.push({ from: STORAGE_SCHEMA_VERSION, to: STORAGE_SCHEMA_VERSION, reason: validated.code });
      return { ok: true, state: next, migrated: true, log };
    }
    return { ok: true, state: validated.value, migrated: false, log };
  }

  // Future schemas and unknown versions reset; never try to invent recovery of sensitive fields.
  const next = emptyState(now);
  log.push({
    from: raw.schemaVersion ?? "unknown",
    to: STORAGE_SCHEMA_VERSION,
    reason: "unsupported-schema",
  });
  return { ok: true, state: next, migrated: true, log };
}

module.exports = { migrateStorage };
