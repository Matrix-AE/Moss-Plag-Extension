"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const openapi = require(path.join(root, "packages/contracts/openapi"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/job-account-api.md"), "utf8");

test("P046-T01 OpenAPI validation and artifacts", () => {
  assert.equal(openapi.validateOpenApiModule().ok, true);
  assert.ok(fs.existsSync(path.join(root, "packages/contracts/openapi.json")));
  assert.ok(fs.existsSync(path.join(root, "packages/contracts/generated-types.ts")));
  const docJson = JSON.parse(fs.readFileSync(path.join(root, "packages/contracts/openapi.json"), "utf8"));
  assert.equal(openapi.assertSafeDocument(docJson).ok, true);
});

test("P046-T02 positive and negative fixtures", () => {
  assert.equal(
    openapi.validateFixture("createJob", {
      schemaVersion: 1,
      mode: "batch",
      language: "python",
      title: "t",
      consentPolicyVersion: "1.0.0",
      groups: [{}, {}],
    }).ok,
    true,
  );
  assert.equal(
    openapi.validateFixture("createJob", {
      schemaVersion: 1,
      mode: "pair",
      groups: [{}, {}],
      mossUserId: "123",
    }).ok,
    false,
  );
  assert.equal(
    openapi.validateFixture("jobStatus", {
      status: "succeeded",
      error: { code: "x", message: "safe" },
    }).ok,
    true,
  );
  assert.equal(
    openapi.validateFixture("jobStatus", {
      status: "failed",
      error: { code: "x", message: "see https://secret" },
    }).ok,
    false,
  );
});

test("P046-T03 docs and package export", () => {
  assert.match(doc, /OpenAPI 3\.1/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/contracts/package.json"), "utf8"));
  assert.equal(pkg.exports["./openapi"], "./openapi.js");
  const types = fs.readFileSync(path.join(root, "packages/contracts/generated-types.ts"), "utf8");
  assert.match(types, /JobStatus/);
});
