"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const mode = require(path.join(root, "packages/ui/mode-selector"));
const doc = fs.readFileSync(path.join(root, "docs/product/mode-selection.md"), "utf8");

test("P038-T01 validation and forbidden copy", () => {
  assert.equal(mode.validateModeSelector().ok, true);
  for (const card of Object.values(mode.MODE_CARDS)) {
    for (const pattern of mode.FORBIDDEN_COPY) {
      assert.equal(pattern.test(card.summary), false, card.id);
    }
  }
  assert.match(doc, /Pair Check/);
  assert.match(doc, /Batch Check/);
  assert.match(doc, /responsible/i);
});

test("P038-T02 empty, compatible, incompatible, and canceled switches", () => {
  const empty = mode.selectMode(null, "pair");
  assert.equal(empty.draft.groups.length, 2);

  const batchEmpty = mode.selectMode(empty.draft, "batch", { confirm: false });
  assert.equal(batchEmpty.ok, true);

  const populated = JSON.parse(JSON.stringify(empty.draft));
  populated.groups[0].files.push({ key: "a", displayName: "a.py" });
  const blocked = mode.selectMode(populated, "batch", { confirm: false });
  assert.equal(blocked.needsConfirm, true);

  const cancelled = mode.cancelSwitch(populated);
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.draft.groups[0].files.length, 1);

  const confirmed = mode.selectMode(populated, "batch", { confirm: true });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.draft.mode, "batch");

  const preserved = mode.selectModePreserving(populated, "batch", {
    confirm: true,
    preserve: true,
  });
  assert.equal(preserved.preserved, true);
  assert.equal(preserved.draft.groups[0].files.length, 1);
});

test("P038-T03 continuation rules and accessible markup", () => {
  assert.equal(
    mode.canContinue({
      mode: "pair",
      groups: [
        { id: "a", files: [{ key: "1" }] },
        { id: "b", files: [{ key: "2" }] },
      ],
    }).ok,
    true,
  );
  assert.equal(
    mode.canContinue({
      mode: "pair",
      groups: [
        { id: "a", files: [{ key: "1" }] },
        { id: "b", files: [{ key: "2" }] },
        { id: "c", files: [{ key: "3" }] },
      ],
    }).ok,
    false,
  );
  assert.equal(
    mode.canContinue({
      mode: "batch",
      groups: [{ id: "a", files: [{ key: "1" }] }],
    }).ok,
    false,
  );
  const html = mode.buildModeSelectorHtml({ selected: "pair" });
  assert.match(html.html, /role="radiogroup"/);
  assert.match(html.html, /type="radio"/);
  assert.match(html.html, /Pair Check/);
  assert.deepEqual(mode.keyboardContract().keys.includes("ArrowRight"), true);
});

test("P038-T04 package export and workspace wiring", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./mode-selector"], "./mode-selector/index.js");
  const workspace = fs.readFileSync(
    path.join(root, "apps/extension/src/entrypoints/workspace/Workspace.tsx"),
    "utf8",
  );
  assert.match(workspace, /comparison-mode|Pair Check|mode-selector|Batch Check/);
  assert.ok(fs.existsSync(path.join(root, "packages/ui/specimens/mode-selector.html")));
});
