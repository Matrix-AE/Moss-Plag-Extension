"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const domain = require(path.join(root, "packages/domain/comparison-model"));
const doc = fs.readFileSync(path.join(root, "docs/domain/comparison-model.md"), "utf8");
const types = fs.readFileSync(path.join(root, "packages/domain/types.ts"), "utf8");

test("P036-T01 valid fixtures serialize and validate", () => {
  for (const example of [
    domain.exampleTwoFiles(),
    domain.exampleManyFlatFiles(),
    domain.exampleTwoProjects(),
    domain.exampleManyProjects(),
    domain.exampleWithBaseCode(),
  ]) {
    const result = domain.validateComparison(example);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    const roundTrip = domain.deserialize(domain.serialize(example));
    assert.equal(domain.validateComparison(roundTrip).ok, true);
    assert.ok(example.owner);
    assert.ok(example.createdAt);
  }
});

test("P036-T02 rejects path leaks, bad versions, and invalid states", () => {
  assert.ok(
    domain.validateComparison(domain.exampleWithAbsolutePathLeak()).errors.some(
      (e) => e.code === "forbidden-persisted-field",
    ),
  );
  const badVersion = { ...domain.exampleTwoFiles(), schemaVersion: 99 };
  assert.ok(domain.validateComparison(badVersion).errors.some((e) => e.code === "schema-version"));
  const badStatus = { ...domain.exampleTwoFiles(), status: "exploded" };
  assert.ok(domain.validateComparison(badStatus).errors.some((e) => e.code === "status"));
  assert.ok(domain.validateComparison(domain.exampleEmptyGroup()).errors.some((e) => e.code === "empty-group"));
  assert.ok(
    domain.validateComparison(domain.exampleMixedLanguage()).errors.some((e) => e.code === "mixed-language"),
  );
});

test("P036-T03 pair/batch invariants and typed surface", () => {
  const pair = domain.exampleTwoFiles();
  assert.equal(pair.mode, "pair");
  assert.equal(pair.groups.length, 2);
  const three = JSON.parse(JSON.stringify(pair));
  three.groups.push(three.groups[0]);
  assert.ok(domain.validateComparison(three).errors.some((e) => e.code === "pair-count"));
  assert.match(types, /UploadState/);
  assert.match(types, /ComparisonDocument/);
  assert.match(doc, /Forbidden/);
  assert.deepEqual(domain.UPLOAD_STATES.includes("local"), true);
});
