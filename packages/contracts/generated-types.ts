/** Generated from OpenAPI v1 — do not edit by hand in production pipelines. */
export type JobStatus = "draft" | "uploading" | "uploaded" | "validating" | "queued" | "submitting" | "awaiting-report" | "succeeded" | "failed" | "cancel-requested" | "canceled";
export type ComparisonMode = "pair" | "batch";
export interface SafeErrorBody { code: string; message: string }
export interface CreateJobRequest {
  schemaVersion: 1;
  mode: ComparisonMode;
  language: string;
  title: string;
  consentPolicyVersion: string;
  groups: unknown[];
  baseFiles?: unknown[];
  settings?: Record<string, unknown>;
}
