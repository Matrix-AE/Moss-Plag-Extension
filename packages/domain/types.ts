export const DOMAIN_SCHEMA_VERSION = 1 as const;

export type ComparisonMode = "pair" | "batch";

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

export type UploadState = "local" | "pending" | "uploading" | "uploaded" | "failed";

export interface OwnerRef {
  deviceId: string;
  accountRef: string | null;
}

export interface ComparisonFile {
  id: string;
  displayName: string;
  safeProtocolName: string;
  virtualPath?: string;
  language?: string;
  bytes: number;
  contentHash?: string | null;
  uploadState?: UploadState;
  /** Must never be true for trusted grouping. */
  inferredFromPathOnly?: boolean;
}

export interface ComparisonGroup {
  id: string;
  label: string;
  files: ComparisonFile[];
}

export interface ComparisonResult {
  reportUrlRef: string;
  etaMinutes?: number | null;
}

export interface ComparisonDocument {
  schemaVersion: typeof DOMAIN_SCHEMA_VERSION;
  idempotencyKey: string;
  status: JobStatus;
  mode: ComparisonMode;
  language: string | null;
  groups: ComparisonGroup[];
  baseFiles: Array<ComparisonFile & { countsAsSubmission?: boolean }>;
  settings: Record<string, unknown>;
  result: ComparisonResult | null;
  owner?: OwnerRef;
  createdAt?: string;
  updatedAt?: string;
}
