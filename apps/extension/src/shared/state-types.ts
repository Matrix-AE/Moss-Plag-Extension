import {
  STORAGE_SCHEMA_VERSION,
  DRAFT_TTL_MS,
  TERMINAL_JOB_TTL_MS,
  STORAGE_BACKEND,
  FORBIDDEN_PERSISTED_KEYS,
  OWNERS,
  STATE_KEY,
  MESSAGE_ACTIONS,
} from "../../state/index.cjs";

export type MessageAction =
  | "shell/ping"
  | "shell/open-workspace"
  | "shell/status"
  | "state/get"
  | "state/save-draft"
  | "state/discard-draft"
  | "state/bind-job"
  | "state/update-job"
  | "state/purge";

export type JobStatus =
  | "draft"
  | "ready"
  | "uploading"
  | "queued"
  | "submitting"
  | "waiting"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "ambiguous";

export interface DraftShell {
  draftId: string;
  mode: "pair" | "batch";
  language: string;
  groupCount: number;
  flags: { includeBaseCode: boolean };
  createdAt: number;
  updatedAt: number;
}

export interface ActiveJob {
  jobId: string;
  status: JobStatus;
  mode: "pair" | "batch";
  language: string;
  submissionIdempotencyKey: string;
  updatedAt: number;
  terminalAt: number | null;
  reportUrlRef?: string;
}

export interface PersistedState {
  schemaVersion: number;
  shell: { installedAt: number };
  draft: DraftShell | null;
  activeJob: ActiveJob | null;
}

export {
  STORAGE_SCHEMA_VERSION,
  DRAFT_TTL_MS,
  TERMINAL_JOB_TTL_MS,
  STORAGE_BACKEND,
  FORBIDDEN_PERSISTED_KEYS,
  OWNERS,
  STATE_KEY,
  MESSAGE_ACTIONS,
};
