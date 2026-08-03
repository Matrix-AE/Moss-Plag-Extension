"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const validate = require(path.join(
  path.resolve(__dirname, ".."),
  "packages",
  "contracts",
  "validate.js",
));

function validCreateJob() {
  return {
    schemaVersion: 1,
    idempotencyKey: "job-key-001",
    mode: "pair",
    language: "python",
    consentPolicyVersion: "1.0.0",
    groups: [
      {
        id: "a",
        files: [{ displayName: "a.py", safeProtocolName: "a.py" }],
      },
      {
        id: "b",
        files: [{ displayName: "b.py", safeProtocolName: "b.py" }],
      },
    ],
  };
}

test("P018-T01 valid create-job request passes", () => {
  const result = validate.validateCreateJobRequest(validCreateJob());
  assert.equal(result.ok, true);
});

test("P018-T02 create-job rejects missing groups and unknown version", () => {
  const noGroups = validCreateJob();
  noGroups.groups = [];
  assert.equal(validate.validateCreateJobRequest(noGroups).error.code, "group-count");
  const badVersion = validCreateJob();
  badVersion.schemaVersion = 2;
  assert.equal(validate.validateCreateJobRequest(badVersion).error.code, "schema-version");
});

test("P018-T03 create-job rejects inline source and moss userid fields", () => {
  const withSource = validCreateJob();
  withSource.groups[0].files[0].source = "print(1)";
  assert.equal(validate.validateCreateJobRequest(withSource).error.code, "source-inline");
  const withSecret = validCreateJob();
  withSecret.mossUserId = "12345";
  assert.equal(validate.validateCreateJobRequest(withSecret).error.code, "secret-field");
});

test("P018-T04 job status requires opaque report refs on success", () => {
  const ok = validate.validateJobStatusResponse({
    jobId: "j1",
    status: "succeeded",
    reportUrlRef: "res_opaque_1",
  });
  assert.equal(ok.ok, true);
  const bad = validate.validateJobStatusResponse({
    jobId: "j1",
    status: "succeeded",
    reportUrlRef: "https://example.invalid/report",
  });
  assert.equal(bad.error.code, "result-ref");
});

test("P018-T05 job errors cannot carry secrets", () => {
  const bad = validate.validateJobStatusResponse({
    jobId: "j1",
    status: "failed",
    error: { message: "failed", mossUserId: "12345" },
  });
  assert.equal(bad.error.code, "unsafe-error");
});

test("P018-T06 BYO userid connect validates numeric ids and rejects passwords", () => {
  assert.equal(validate.validateConnectMossUserIdRequest({ mossUserId: "987654" }).ok, true);
  assert.equal(
    validate.validateConnectMossUserIdRequest({ mossUserId: "abc" }).error.code,
    "userid-format",
  );
  assert.equal(
    validate.validateConnectMossUserIdRequest({ mossUserId: "987654", password: "x" }).error.code,
    "password-forbidden",
  );
});
