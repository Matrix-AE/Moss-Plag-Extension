"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const grouping = require(path.join(root, "packages/ui/grouping"));
const groupBuilder = require(path.join(root, "packages/ui/group-builder"));
const doc = fs.readFileSync(path.join(root, "docs/product/submission-grouping.md"), "utf8");

test("P041-T01 module validation", () => {
  assert.equal(grouping.validateGroupingModule().ok, true);
});

test("P041-T02 flat files stay separate; nested folders group", () => {
  const flat = grouping.suggestGroups(
    [
      { status: "accepted", displayName: "a.py", size: 10, key: "a", sourceType: "file" },
      { status: "accepted", displayName: "b.py", size: 11, key: "b", sourceType: "file" },
      { status: "accepted", displayName: "c.py", size: 12, key: "c", sourceType: "file" },
    ],
    { mode: "batch" },
  );
  assert.equal(flat.length, 3);

  const nested = grouping.suggestGroups(
    [
      {
        status: "accepted",
        displayName: "main.py",
        size: 1,
        key: "1",
        relativePath: "alice/src/main.py",
        sourceType: "folder",
      },
      {
        status: "accepted",
        displayName: "util.py",
        size: 1,
        key: "2",
        relativePath: "alice/src/util.py",
        sourceType: "folder",
      },
      {
        status: "accepted",
        displayName: "main.py",
        size: 1,
        key: "3",
        relativePath: "bob/main.py",
        sourceType: "folder",
      },
    ],
    { mode: "batch" },
  );
  assert.equal(nested.length, 2);
  assert.equal(nested.find((g) => g.label === "alice").files.length, 2);
});

test("P041-T03 two projects, many archives, collisions", () => {
  const two = grouping.suggestGroups(
    [
      {
        status: "accepted",
        displayName: "a.py",
        size: 1,
        key: "1",
        relativePath: "proj1/a.py",
        sourceType: "folder",
      },
      {
        status: "accepted",
        displayName: "b.py",
        size: 1,
        key: "2",
        relativePath: "proj2/b.py",
        sourceType: "folder",
      },
    ],
    { mode: "pair" },
  );
  assert.equal(two.length, 2);

  const archives = grouping.suggestGroups(
    Array.from({ length: 5 }, (_, i) => ({
      status: "accepted",
      displayName: `p${i}.zip`,
      size: 10,
      key: `z${i}`,
      sourceType: "archive",
      groupingHint: `p${i}`,
    })),
    { mode: "batch" },
  );
  assert.equal(archives.length, 5);

  const ids = new Set(archives.map((g) => g.id));
  assert.equal(ids.size, archives.length);
});

test("P041-T04 rename merge split move reorder", () => {
  const groups = grouping.suggestGroups(
    [
      {
        status: "accepted",
        displayName: "a.py",
        size: 1,
        key: "k1",
        relativePath: "a/a.py",
        sourceType: "folder",
      },
      {
        status: "accepted",
        displayName: "b.py",
        size: 1,
        key: "k2",
        relativePath: "b/b.py",
        sourceType: "folder",
      },
      {
        status: "accepted",
        displayName: "c.py",
        size: 1,
        key: "k3",
        relativePath: "c/c.py",
        sourceType: "folder",
      },
    ],
    { mode: "batch" },
  );
  let draft = { mode: "batch", groups, baseFiles: [] };

  const renamed = groupBuilder.renameGroup(draft, groups[0].id, "Alpha");
  assert.equal(renamed.ok, true);
  draft = renamed.draft;

  const merged = grouping.mergeGroups(draft, draft.groups[1].id, draft.groups[0].id);
  assert.equal(merged.ok, true);
  assert.equal(merged.draft.groups.length, 2);
  draft = merged.draft;

  const split = grouping.splitGroup(draft, draft.groups[0].id, ["k2"]);
  assert.equal(split.ok, true);
  draft = split.draft;

  const moved = groupBuilder.moveFile(
    draft,
    draft.groups[0].id,
    draft.groups[1].id,
    draft.groups[0].files[0].key,
  );
  assert.equal(moved.ok, true);
  draft = moved.draft;

  const order = draft.groups.map((g) => g.id).reverse();
  const reordered = groupBuilder.reorderGroups(draft, order);
  assert.equal(reordered.ok, true);
});

test("P041-T05 mode validation and preview identity", () => {
  const one = {
    mode: "pair",
    groups: [{ id: "grp_stable", label: "Only", files: [{ id: "f1", key: "k", displayName: "a.py", bytes: 1 }] }],
  };
  assert.equal(grouping.validateGrouping(one).ok, false);
  assert.ok(grouping.validateGrouping(one).errors.includes("pair-requires-exactly-two-groups"));

  const batch = {
    mode: "batch",
    groups: [
      { id: "g1", label: "A", files: [{ id: "f1", key: "k1", displayName: "a.py", bytes: 1 }] },
      { id: "g2", label: "B", files: [{ id: "f2", key: "k2", displayName: "b.py", bytes: 2 }] },
    ],
  };
  const ok = grouping.validateGrouping(batch);
  assert.equal(ok.ok, true);
  assert.equal(ok.preview.groupCount, 2);

  const pathId = {
    mode: "batch",
    groups: [
      {
        id: "uploads/tmp/foo",
        label: "A",
        files: [{ id: "f1", key: "k1", displayName: "a.py", bytes: 1 }],
      },
      { id: "g2", label: "B", files: [{ id: "f2", key: "k2", displayName: "b.py", bytes: 2 }] },
    ],
  };
  assert.ok(grouping.validateGrouping(pathId).errors.includes("untrusted-path-identity"));

  const html = grouping.buildPreviewHtml(batch);
  assert.match(html.html, /stable internal IDs/);
  assert.match(html.html, /data-group-id/);
});

test("P041-T06 base files stay separate; docs and wiring", () => {
  const withBase = grouping.suggestGroups(
    [
      {
        status: "accepted",
        displayName: "starter.py",
        size: 1,
        key: "base",
        sourceType: "base",
      },
      {
        status: "accepted",
        displayName: "a.py",
        size: 1,
        key: "a",
        relativePath: "s1/a.py",
        sourceType: "folder",
      },
      {
        status: "accepted",
        displayName: "b.py",
        size: 1,
        key: "b",
        relativePath: "s2/b.py",
        sourceType: "folder",
      },
    ],
    { mode: "batch" },
  );
  assert.equal(withBase.length, 2);
  assert.ok(!withBase.some((g) => g.files.some((f) => f.key === "base")));

  assert.match(doc, /stable internal IDs/i);
  assert.match(doc, /pair mode/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./grouping"], "./grouping/index.js");
  const workspace = fs.readFileSync(
    path.join(root, "apps/extension/src/shared/workflow/WorkflowApp.tsx"),
    "utf8",
  );
  assert.match(workspace, /Grouping|group preview|Comparison preview/i);
  assert.ok(fs.existsSync(path.join(root, "packages/ui/specimens/grouping.html")));
  assert.ok(fs.existsSync(path.join(root, ".changes/0019-submission-grouping.md")));
});
