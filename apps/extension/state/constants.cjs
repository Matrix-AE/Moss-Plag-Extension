"use strict";

const { jobStatuses } = require("../../../packages/contracts/index.js");

const STORAGE_SCHEMA_VERSION = 1;
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const TERMINAL_JOB_TTL_MS = 24 * 60 * 60 * 1000;

const STORAGE_BACKEND = "local"; // never sync — sync can leave the profile

const TERMINAL_STATUSES = Object.freeze(["succeeded", "failed", "cancelled"]);

const FORBIDDEN_PERSISTED_KEYS = Object.freeze([
  "title",
  "label",
  "labels",
  "name",
  "names",
  "path",
  "paths",
  "hash",
  "hashes",
  "source",
  "File",
  "file",
  "files",
  "displayName",
  "filename",
  "filenames",
  "reportUrl",
  "content",
  "bytesContent",
  "mossUserId",
]);

const OWNERS = Object.freeze({
  popup: "ephemeral-ui",
  workspace: "ephemeral-ui",
  settings: "ephemeral-ui",
  serviceWorker: "message-router",
  storageLocal: "source-of-truth",
  apiClient: "transient-network",
});

function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(status);
}

function emptyState(now = Date.now()) {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    shell: { installedAt: now },
    draft: null,
    activeJob: null,
  };
}

module.exports = {
  STORAGE_SCHEMA_VERSION,
  DRAFT_TTL_MS,
  TERMINAL_JOB_TTL_MS,
  STORAGE_BACKEND,
  TERMINAL_STATUSES,
  FORBIDDEN_PERSISTED_KEYS,
  OWNERS,
  jobStatuses,
  isTerminalStatus,
  emptyState,
};
