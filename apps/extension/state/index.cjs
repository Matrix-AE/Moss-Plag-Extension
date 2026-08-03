"use strict";

const {
  STORAGE_SCHEMA_VERSION,
  DRAFT_TTL_MS,
  TERMINAL_JOB_TTL_MS,
  STORAGE_BACKEND,
  FORBIDDEN_PERSISTED_KEYS,
  OWNERS,
  emptyState,
} = require("./constants.cjs");
const { validateDraft, validateActiveJob, validatePersistedState, assertNoForbiddenKeys } = require("./validate.cjs");
const { migrateStorage } = require("./migrate.cjs");
const { purgeExpired, discardDraft } = require("./purge.cjs");
const { createMemoryStorage, createStateStore, STATE_KEY } = require("./store.cjs");
const { MESSAGE_ACTIONS, parseMessage, createRouter } = require("./messages.cjs");

module.exports = {
  STORAGE_SCHEMA_VERSION,
  DRAFT_TTL_MS,
  TERMINAL_JOB_TTL_MS,
  STORAGE_BACKEND,
  FORBIDDEN_PERSISTED_KEYS,
  OWNERS,
  STATE_KEY,
  MESSAGE_ACTIONS,
  emptyState,
  assertNoForbiddenKeys,
  validateDraft,
  validateActiveJob,
  validatePersistedState,
  migrateStorage,
  purgeExpired,
  discardDraft,
  createMemoryStorage,
  createStateStore,
  parseMessage,
  createRouter,
};
