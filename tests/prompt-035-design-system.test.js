"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const doc = fs.readFileSync(path.join(root, "docs/design/design-system.md"), "utf8");
const baseCss = fs.readFileSync(path.join(root, "apps/extension/src/styles/base.css"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));

test("P035-T01 catalog documents implemented modules only", () => {
  for (const heading of ["## Catalog (implemented only)", "## Recipes", "## Do / Don’t", "## Accessibility notes", "## Versioning", "## Visual-regression matrix", "## Audit checklist"]) {
    assert.ok(doc.includes(heading), heading);
  }
  for (const mod of ["tokens", "typography", "icons", "interaction", "primitives", "shell", "file-selection", "group-builder", "progress"]) {
    assert.ok(doc.includes(`@moss/ui/${mod}`) || doc.includes(mod), mod);
    assert.ok(pkg.exports[`./${mod}`] || pkg.exports[`./${mod}.css`] || mod === "icons", `export ${mod}`);
  }
});

test("P035-T02 audit gates: no hex in base.css and wireframes covered", () => {
  assert.equal((baseCss.match(/#[0-9a-f]{3,8}\b/gi) || []).length, 0);
  assert.match(doc, /Paywall/);
  assert.match(doc, /Never show a percent|never show a percent/i);
  assert.match(doc, /A01[\s\S]*Pass/);
});

test("P035-T03 recipes reference existing builders", () => {
  const shell = require(path.join(root, "packages/ui/shell"));
  const progress = require(path.join(root, "packages/ui/progress"));
  assert.equal(shell.buildShell({ surface: "popup", stickyActionsHtml: "<button>Go</button>" }).ok, true);
  assert.equal(progress.viewModel("wait").fabricatePercent, false);
  assert.match(doc, /shell\(popup\)|shell\(workspace\)/);
});
