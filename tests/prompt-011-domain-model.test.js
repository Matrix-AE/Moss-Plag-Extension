"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const model = require(path.join(
  path.resolve(__dirname, ".."),
  "packages",
  "domain",
  "comparison-model.js",
));

test("P011-T01 two-file pair validates", () => {
  const example = model.exampleTwoFiles();
  const result = model.validateComparison(example);
  assert.equal(result.ok, true);
  assert.equal(example.groups.length, 2);
  assert.notEqual(example.groups[0].files[0].displayName, example.groups[0].files[0].safeProtocolName);
});

test("P011-T02 many flat files and many projects validate", () => {
  assert.equal(model.validateComparison(model.exampleManyFlatFiles()).ok, true);
  assert.equal(model.validateComparison(model.exampleManyProjects()).ok, true);
  assert.equal(model.exampleManyProjects().groups.length, 4);
});

test("P011-T03 two multi-file projects keep separate membership", () => {
  const example = model.exampleTwoProjects();
  assert.equal(example.groups[0].files.length, 2);
  assert.ok(example.groups[0].files.every((f) => f.virtualPath.startsWith("project-atlas/")));
  assert.ok(example.groups[1].files.every((f) => f.virtualPath.startsWith("project-nova/")));
  assert.equal(model.validateComparison(example).ok, true);
});

test("P011-T04 mixed language and empty groups are rejected", () => {
  const mixed = model.validateComparison(model.exampleMixedLanguage());
  assert.equal(mixed.ok, false);
  assert.ok(mixed.errors.some((e) => e.code === "mixed-language"));
  const empty = model.validateComparison(model.exampleEmptyGroup());
  assert.equal(empty.ok, false);
  assert.ok(empty.errors.some((e) => e.code === "empty-group"));
});

test("P011-T05 base code does not count as submission", () => {
  const example = model.exampleWithBaseCode();
  assert.equal(model.validateComparison(example).ok, true);
  assert.equal(example.baseFiles[0].countsAsSubmission, false);
  const bad = JSON.parse(model.serialize(example));
  bad.baseFiles[0].countsAsSubmission = true;
  assert.ok(model.validateComparison(bad).errors.some((e) => e.code === "base-as-submission"));
});

test("P011-T06 duplicate protocol names and path traversal fail", () => {
  assert.ok(
    model
      .validateComparison(model.exampleDuplicateProtocolNames())
      .errors.some((e) => e.code === "duplicate-protocol-name"),
  );
  assert.ok(
    model.validateComparison(model.exampleNestedPathTraversal()).errors.some((e) => e.code === "path-traversal"),
  );
});

test("P011-T07 serialization round-trip preserves schema and stable ids", () => {
  const original = model.exampleTwoProjects();
  const restored = model.deserialize(model.serialize(original));
  assert.equal(restored.schemaVersion, model.SCHEMA_VERSION);
  assert.deepEqual(
    restored.groups.map((g) => g.id),
    ["project-atlas", "project-nova"],
  );
  assert.equal(model.validateComparison(restored).ok, true);
});

test("P011-T08 untrusted path-only grouping and plaintext result URLs fail", () => {
  const untrusted = JSON.parse(model.serialize(model.exampleTwoFiles()));
  untrusted.groups[0].files[0].inferredFromPathOnly = true;
  assert.ok(model.validateComparison(untrusted).errors.some((e) => e.code === "untrusted-grouping"));

  const withResult = JSON.parse(model.serialize(model.exampleTwoFiles()));
  withResult.status = "succeeded";
  withResult.result = { reportUrlRef: "https://example.invalid/report/1" };
  assert.ok(model.validateComparison(withResult).errors.some((e) => e.code === "result-plaintext-url"));

  withResult.result = { reportUrlRef: "res_opaque_001" };
  assert.equal(model.validateComparison(withResult).ok, true);

  const old = JSON.parse(model.serialize(model.exampleTwoFiles()));
  old.schemaVersion = 99;
  assert.ok(model.validateComparison(old).errors.some((e) => e.code === "schema-version"));
});
