"use strict";

/**
 * Versioned Job and Account API OpenAPI fragment (Prompt 046).
 */

const fs = require("node:fs");
const path = require("node:path");

const OPENAPI_VERSION = "3.1.0";
const API_VERSION = "v1";

const JOB_STATUSES = Object.freeze([
  "draft",
  "uploading",
  "uploaded",
  "validating",
  "queued",
  "submitting",
  "awaiting-report",
  "succeeded",
  "failed",
  "cancel-requested",
  "canceled",
]);

function buildOpenApiDocument() {
  return {
    openapi: OPENAPI_VERSION,
    info: {
      title: "Moss Similarity Job and Account API",
      version: API_VERSION,
      description:
        "Auth, account data rights, jobs, uploads, validation, status, cancel, forget, and results. Safe errors only — never object paths, plaintext credentials, bearer URLs in lists, or raw provider errors.",
    },
    servers: [{ url: "/api/v1" }],
    paths: {
      "/auth/magic-link": {
        post: {
          operationId: "requestMagicLink",
          summary: "Request email magic-link / device-bound nonce",
          responses: { "202": { description: "Accepted" }, "400": { $ref: "#/components/responses/SafeError" } },
        },
      },
      "/auth/verify": {
        post: {
          operationId: "verifyMagicLink",
          summary: "Consume single-use magic-link proof",
          responses: { "200": { description: "Session issued" }, "401": { $ref: "#/components/responses/SafeError" } },
        },
      },
      "/auth/logout-all": {
        post: {
          operationId: "logoutAll",
          summary: "Revoke all sessions for the account",
          security: [{ bearerAuth: [] }],
          responses: { "204": { description: "All sessions revoked" } },
        },
      },
      "/account/devices": {
        get: {
          operationId: "listDevices",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Device list without secrets" } },
        },
      },
      "/account/export": {
        post: {
          operationId: "requestExport",
          security: [{ bearerAuth: [] }],
          responses: { "202": { description: "Export queued" } },
        },
      },
      "/account/export/status": {
        get: {
          operationId: "exportStatus",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Export status" } },
        },
      },
      "/account/delete": {
        post: {
          operationId: "requestDelete",
          security: [{ bearerAuth: [] }],
          responses: { "202": { description: "Deletion queued" } },
        },
      },
      "/account/delete/status": {
        get: {
          operationId: "deleteStatus",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Deletion status" } },
        },
      },
      "/jobs": {
        get: {
          operationId: "listJobs",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "cursor", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          ],
          responses: { "200": { description: "Paginated jobs without bearer result URLs" } },
        },
        post: {
          operationId: "createJob",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", minLength: 8 } }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateJobRequest" } } } },
          responses: {
            "201": { description: "Job created" },
            "409": { description: "Idempotency conflict" },
            "400": { $ref: "#/components/responses/SafeError" },
          },
        },
      },
      "/jobs/{jobId}": {
        get: {
          operationId: "getJob",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/jobId" }],
          responses: { "200": { description: "Job status" }, "404": { $ref: "#/components/responses/SafeError" } },
        },
      },
      "/jobs/{jobId}/cancel": {
        post: {
          operationId: "cancelJob",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/jobId" }],
          responses: { "200": { description: "Cancel requested or applied" }, "409": { description: "Invalid/late cancellation" } },
        },
      },
      "/jobs/{jobId}/forget": {
        post: {
          operationId: "forgetJob",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/jobId" }],
          responses: { "202": { description: "Forget queued" } },
        },
      },
      "/jobs/{jobId}/uploads": {
        post: {
          operationId: "createUploadSession",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/jobId" }],
          responses: { "201": { description: "Upload session" } },
        },
      },
      "/jobs/{jobId}/validate": {
        post: {
          operationId: "finalizeValidation",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/jobId" }],
          responses: { "202": { description: "Validation enqueued" } },
        },
      },
      "/jobs/{jobId}/result": {
        get: {
          operationId: "getResult",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/jobId" }],
          responses: { "200": { description: "Opaque result availability metadata" }, "404": { $ref: "#/components/responses/SafeError" } },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      parameters: {
        jobId: { name: "jobId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      },
      schemas: {
        CreateJobRequest: {
          type: "object",
          required: ["schemaVersion", "mode", "language", "groups", "consentPolicyVersion", "title"],
          properties: {
            schemaVersion: { const: 1 },
            mode: { enum: ["pair", "batch"] },
            language: { type: "string" },
            title: { type: "string", maxLength: 120 },
            consentPolicyVersion: { type: "string" },
            groups: { type: "array", minItems: 2 },
            baseFiles: { type: "array" },
            settings: { type: "object" },
          },
          additionalProperties: false,
        },
        JobStatus: {
          type: "object",
          required: ["jobId", "status", "ownerUserId"],
          properties: {
            jobId: { type: "string" },
            status: { enum: [...JOB_STATUSES] },
            ownerUserId: { type: "string" },
            reportAvailable: { type: "boolean" },
            reportUrlRef: { type: "string", description: "Opaque reference — never a raw bearer URL in list endpoints" },
            error: { $ref: "#/components/schemas/SafeErrorBody" },
          },
        },
        SafeErrorBody: {
          type: "object",
          properties: {
            code: { type: "string" },
            message: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      responses: {
        SafeError: {
          description: "Safe error without paths, credentials, or provider internals",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SafeErrorBody" },
            },
          },
        },
      },
    },
  };
}

function assertSafeDocument(doc) {
  const raw = JSON.stringify(doc);
  const errors = [];
  if (/mossUserId|password|sk_live|Bearer [A-Za-z0-9_-]{20,}/i.test(raw) && /example.*mossUserId/i.test(raw)) {
    errors.push("credential-example");
  }
  if (/\"reportUrl\"\s*:\s*\"https?:\/\//i.test(raw)) errors.push("bearer-url-in-spec");
  if (/\/tmp\/|objectPath|storageKey/i.test(raw) && /example/i.test(raw)) errors.push("object-path-example");
  for (const status of JOB_STATUSES) {
    if (!raw.includes(status)) errors.push(`missing-status-${status}`);
  }
  const requiredPaths = [
    "/auth/logout-all",
    "/account/devices",
    "/account/export",
    "/account/delete",
    "/jobs",
    "/jobs/{jobId}/cancel",
    "/jobs/{jobId}/forget",
    "/jobs/{jobId}/uploads",
    "/jobs/{jobId}/result",
  ];
  for (const p of requiredPaths) {
    if (!doc.paths[p]) errors.push(`missing-path-${p}`);
  }
  return { ok: errors.length === 0, errors };
}

function generateTypesStub(doc) {
  const statuses = JOB_STATUSES.map((s) => `"${s}"`).join(" | ");
  return `/** Generated from OpenAPI ${doc.info.version} — do not edit by hand in production pipelines. */
export type JobStatus = ${statuses};
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
`;
}

function writeArtifacts(rootDir) {
  const doc = buildOpenApiDocument();
  const check = assertSafeDocument(doc);
  if (!check.ok) return { ok: false, errors: check.errors };
  const openapiPath = path.join(rootDir, "openapi.json");
  const typesPath = path.join(rootDir, "generated-types.ts");
  fs.writeFileSync(openapiPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  fs.writeFileSync(typesPath, generateTypesStub(doc), "utf8");
  return { ok: true, openapiPath, typesPath, doc };
}

function validateFixture(kind, payload) {
  if (kind === "createJob") {
    if (payload.mossUserId) return { ok: false, error: "undocumented-field" };
    if (payload.reportUrl) return { ok: false, error: "undocumented-field" };
    if (payload.schemaVersion !== 1) return { ok: false, error: "incompatible" };
    if (!["pair", "batch"].includes(payload.mode)) return { ok: false, error: "incompatible" };
    if (!Array.isArray(payload.groups) || payload.groups.length < 2) return { ok: false, error: "incompatible" };
    return { ok: true };
  }
  if (kind === "jobStatus") {
    if (!JOB_STATUSES.includes(payload.status)) return { ok: false, error: "incompatible" };
    if (payload.error && /path|password|https?:\/\//i.test(JSON.stringify(payload.error))) {
      return { ok: false, error: "unsafe-error" };
    }
    return { ok: true };
  }
  return { ok: false, error: "unknown-fixture" };
}

function validateOpenApiModule() {
  const errors = [];
  const doc = buildOpenApiDocument();
  const safe = assertSafeDocument(doc);
  if (!safe.ok) errors.push(...safe.errors);
  const types = generateTypesStub(doc);
  if (!types.includes("JobStatus")) errors.push("types");
  if (!validateFixture("createJob", {
    schemaVersion: 1,
    mode: "pair",
    language: "python",
    title: "t",
    consentPolicyVersion: "1.0.0",
    groups: [{}, {}],
  }).ok) errors.push("pos");
  if (validateFixture("createJob", { schemaVersion: 1, mode: "pair", groups: [{}, {}], mossUserId: "1" }).ok) {
    errors.push("neg");
  }
  return { ok: errors.length === 0, errors, doc };
}

module.exports = {
  OPENAPI_VERSION,
  API_VERSION,
  JOB_STATUSES,
  buildOpenApiDocument,
  assertSafeDocument,
  generateTypesStub,
  writeArtifacts,
  validateFixture,
  validateOpenApiModule,
};
