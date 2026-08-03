"use strict";

const { jobStatuses } = require("./index.js");

/**
 * Minimal runtime validators for extension↔API payloads.
 * Sensitive fields must never be echoed in error details.
 */

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return { ok: false, error };
}

function validateCreateJobRequest(input) {
  if (!input || typeof input !== "object") {
    return fail("invalid-payload", "Request body must be an object.");
  }
  if (input.schemaVersion !== 1) {
    return fail("schema-version", "Unsupported schemaVersion.");
  }
  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.length < 8) {
    return fail("idempotency-key", "idempotencyKey is required.");
  }
  if (!["pair", "batch"].includes(input.mode)) {
    return fail("mode", "mode must be pair or batch.");
  }
  if (typeof input.language !== "string" || input.language.length < 1) {
    return fail("language", "language is required.");
  }
  if (typeof input.consentPolicyVersion !== "string") {
    return fail("consent-version", "consentPolicyVersion is required.");
  }
  if (!Array.isArray(input.groups) || input.groups.length < 2) {
    return fail("group-count", "At least two groups are required.");
  }
  for (const group of input.groups) {
    if (!group || typeof group.id !== "string" || !Array.isArray(group.files) || group.files.length < 1) {
      return fail("group-shape", "Each group needs id and files.");
    }
    for (const file of group.files) {
      if (!file || typeof file.safeProtocolName !== "string" || typeof file.displayName !== "string") {
        return fail("file-shape", "Each file needs displayName and safeProtocolName.");
      }
      if ("source" in file || "content" in file || "bytesContent" in file) {
        return fail("source-inline", "Source bytes must not appear in JSON create-job payloads.");
      }
    }
  }
  if ("mossUserId" in input) {
    return fail("secret-field", "Provider credentials must not appear in create-job payloads.");
  }
  if ("reportUrl" in input) {
    return fail("secret-field", "Report URLs must not appear in create-job payloads.");
  }
  return { ok: true, value: input };
}

function validateJobStatusResponse(input) {
  if (!input || typeof input !== "object") {
    return fail("invalid-payload", "Response must be an object.");
  }
  if (typeof input.jobId !== "string") {
    return fail("job-id", "jobId is required.");
  }
  if (!jobStatuses.includes(input.status)) {
    return fail("status", "Unknown job status.");
  }
  if (input.error && typeof input.error === "object") {
    const details = JSON.stringify(input.error);
    if (/mossUserId|reportUrl|source\b/i.test(details)) {
      return fail("unsafe-error", "Error payloads must not include secrets or source.");
    }
  }
  if (input.status === "succeeded") {
    if (typeof input.reportUrlRef !== "string" || /^https?:\/\//i.test(input.reportUrlRef)) {
      return fail("result-ref", "Succeeded jobs need an opaque reportUrlRef.");
    }
  }
  return { ok: true, value: input };
}

function validateConnectMossUserIdRequest(input) {
  if (!input || typeof input !== "object") {
    return fail("invalid-payload", "Request body must be an object.");
  }
  if (typeof input.mossUserId !== "string" || !/^[0-9]{3,}$/.test(input.mossUserId)) {
    return fail("userid-format", "mossUserId must be numeric.");
  }
  if ("password" in input || "emailPassword" in input) {
    return fail("password-forbidden", "Email passwords must never be collected.");
  }
  return { ok: true, value: { mossUserId: input.mossUserId } };
}

module.exports = {
  validateConnectMossUserIdRequest,
  validateCreateJobRequest,
  validateJobStatusResponse,
};
