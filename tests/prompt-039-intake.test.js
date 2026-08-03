"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const intake = require(path.join(root, "packages/ui/intake"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/file-intake.md"), "utf8");

test("P039-T01 intake validation covers source types", () => {
  assert.equal(intake.validateIntake().ok, true);
  assert.equal(intake.ingestSelection(null).sourceType, "canceled");
  assert.equal(intake.ingestSelection([{ name: "a.py", size: 3 }]).sourceType, "file");
  assert.equal(
    intake.ingestSelection([
      { name: "a.py", size: 3 },
      { name: "b.py", size: 4 },
    ]).sourceType,
    "multi",
  );
});

test("P039-T02 folder, archive, duplicate, unsupported", () => {
  const folder = intake.ingestSelection([
    { name: "a.py", size: 3, webkitRelativePath: "alice/a.py" },
  ]);
  assert.equal(folder.sourceType, "folder");
  assert.equal(folder.items[0].groupingHint, "alice");
  assert.equal(folder.localOnly, true);
  assert.equal(folder.uploaded, false);

  const archive = intake.ingestSelection([{ name: "hw.zip", size: 50 }]);
  assert.equal(archive.sourceType, "archive");
  assert.equal(archive.items[0].status, "accepted");

  const unsupported = intake.ingestSelection([{ name: "x.7z", size: 50 }]);
  assert.equal(unsupported.items[0].reason, "unsupported-archive");

  const dup = intake.ingestSelection([{ name: "a.py", size: 3 }], {
    existing: [{ key: "a.py::3" }],
  });
  assert.equal(dup.items[0].status, "duplicate");
});

test("P039-T03 remove/replace and security policy", () => {
  const first = intake.ingestSelection([{ name: "a.py", size: 3, handleId: "h1" }]);
  const removed = intake.removeItem(first.items, first.items[0].key);
  assert.equal(removed.length, 0);
  const replaced = intake.replaceItem(first.items, first.items[0].key, { name: "b.py", size: 4 });
  assert.equal(replaced.items.some((i) => i.displayName === "b.py"), true);
  assert.equal(intake.assertSecureIntakePolicy(first).ok, true);
  assert.match(intake.buildDropzoneHtml().html, /webkitdirectory/);
  assert.match(doc, /localOnly|local-only/i);
});

test("P039-T04 package export and workspace mention", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./intake"], "./intake/index.js");
  const workspace = fs.readFileSync(
    path.join(root, "apps/extension/src/shared/workflow/WorkflowApp.tsx"),
    "utf8",
  );
  assert.match(workspace, /intake|drop zone|Browse files|local-only|local only/i);
  assert.ok(fs.existsSync(path.join(root, "packages/ui/specimens/intake.html")));
});
