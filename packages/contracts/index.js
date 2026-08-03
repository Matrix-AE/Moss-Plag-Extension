"use strict";

/** Shared API/job contract constants for later OpenAPI generation. */
module.exports = Object.freeze({
  apiVersion: "v1",
  consentPolicyVersion: "1.0.0",
  jobStatuses: Object.freeze([
    "draft",
    "ready",
    "uploading",
    "queued",
    "submitting",
    "waiting",
    "succeeded",
    "failed",
    "cancelled",
    "ambiguous",
  ]),
});
