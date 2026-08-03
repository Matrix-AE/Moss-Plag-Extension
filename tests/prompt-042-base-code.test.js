"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const base = require(path.join(root, "packages/ui/base-code"));
const doc = fs.readFileSync(path.join(root, "docs/product/base-code.md"), "utf8");

test("P042-T01 module validation", () => {
  assert.equal(base.validateBaseModule().ok, true);
});

test("P042-T02 no-base, one, many, wrong language, removal", () => {
  let draft = {
    mode: "batch",
    language: "python",
    groups: [
      { id: "g1", label: "A", files: [] },
      { id: "g2", label: "B", files: [] },
    ],
    baseFiles: [],
  };
  const caps = { languages: [{ code: "python", extensions: [".py"] }] };
  assert.equal(base.validateBaseHandling(draft).ok, true);

  const one = base.addBaseFiles(draft, [{ name: "starter.py", size: 10 }], {
    language: "python",
    capabilities: caps,
  });
  assert.equal(one.draft.baseFiles.length, 1);
  draft = one.draft;
  const ids = draft.groups.map((g) => g.id).join(",");

  const many = base.addBaseFiles(draft, [{ name: "lib.py", size: 4 }], {
    language: "python",
    capabilities: caps,
  });
  assert.ok(many.draft.baseFiles.length >= 2);
  draft = many.draft;

  const wrong = base.addBaseFiles(draft, [{ name: "Main.java", size: 8 }], {
    language: "python",
    capabilities: caps,
  });
  assert.equal(wrong.added.length, 0);
  assert.ok(wrong.rejected.length >= 1);

  const removed = base.removeBaseFile(draft, draft.baseFiles[0].id);
  assert.equal(removed.ok, true);
  assert.equal(removed.draft.groups.map((g) => g.id).join(","), ids);
});

test("P042-T03 duplicate, collision, base-vs-submission, docs wiring", () => {
  const draft = {
    mode: "batch",
    groups: [{ id: "g1", label: "A", files: [{ id: "f1", key: "a.py::10", displayName: "a.py" }] }],
    baseFiles: [{ id: "b1", key: "a.py::10", displayName: "a.py", role: "base", sourceType: "base" }],
  };
  const result = base.validateBaseHandling(draft);
  assert.ok(result.errors.includes("base-in-submission-group"));
  assert.match(base.buildBasePanelHtml(draft).html, /data-role="base"/);
  assert.match(doc, /never count as comparison groups/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./base-code"], "./base-code/index.js");
  const workspace = fs.readFileSync(
    path.join(root, "apps/extension/src/entrypoints/workspace/Workspace.tsx"),
    "utf8",
  );
  assert.match(workspace, /Base code|base-code|base files/i);
  assert.ok(fs.existsSync(path.join(root, "packages/ui/specimens/base-code.html")));
});
