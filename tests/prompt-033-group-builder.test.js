"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const builder = require(path.join(root, "packages/ui/group-builder"));
const doc = fs.readFileSync(path.join(root, "docs/design/group-builder.md"), "utf8");

test("P033-T01 mode factories and validation helper", () => {
  assert.equal(builder.validateGroupUi().ok, true);
  const pair = builder.createDraft("pair");
  assert.equal(pair.draft.groups.length, 2);
  const batch = builder.createDraft("batch");
  assert.equal(batch.draft.groups.length, 2);
  assert.match(builder.plainLanguageSummary(pair.draft), /two logical submissions/i);
  assert.doesNotMatch(builder.plainLanguageSummary(batch.draft), /MOSS|plagiarism/i);
});

test("P033-T02 destructive switch, move, reorder", () => {
  const { draft } = builder.createDraft("pair");
  draft.groups[0].files.push({ key: "a", displayName: "a.py" });
  assert.equal(builder.switchMode(draft, "batch", { confirm: false }).needsConfirm, true);
  assert.equal(builder.switchMode(draft, "batch", { confirm: true }).ok, true);
  const moved = builder.moveFile(draft, "group-a", "group-b", "a");
  assert.equal(moved.ok, true);
  assert.equal(moved.draft.groups[0].files.length, 0);
  const renamed = builder.renameGroup(draft, "group-a", "Alice");
  assert.equal(renamed.draft.groups[0].label, "Alice");
  const reordered = builder.reorderGroups(draft, ["group-b", "group-a"]);
  assert.equal(reordered.draft.groups[0].id, "group-b");
});

test("P033-T03 builder draft gate and export", () => {
  const { draft } = builder.createDraft("pair");
  assert.ok(builder.validateBuilderDraft(draft).errors.includes("empty-group"));
  draft.groups.forEach((g) => g.files.push({ key: g.id, displayName: "a.py" }));
  draft.language = "python";
  draft.languageConfirmed = true;
  assert.equal(builder.validateBuilderDraft(draft).ok, true);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./group-builder"], "./group-builder/index.js");
  assert.match(doc, /Pair/);
});
