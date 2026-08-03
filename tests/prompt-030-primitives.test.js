"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const primitives = require(path.join(root, "packages/ui/primitives"));
const doc = fs.readFileSync(path.join(root, "docs/design/component-primitives.md"), "utf8");

test("P030-T01 catalog documents all primitives", () => {
  assert.equal(primitives.validatePrimitives().ok, true);
  assert.equal(primitives.PRIMITIVES.length, 12);
  for (const name of primitives.PRIMITIVES) {
    assert.match(doc, new RegExp(name, "i"));
    assert.ok(primitives.KEYBOARD[name], name);
  }
});

test("P030-T02 builders require visible labels and safe progress", () => {
  assert.equal(primitives.buildButton({ label: "" }).ok, false);
  assert.equal(primitives.buildButton({ label: "Save" }).ok, true);
  assert.match(primitives.buildButton({ label: "Save", loading: true }).html, /aria-busy/);
  assert.equal(primitives.buildBadge({ label: "" }).ok, false);
  assert.equal(primitives.buildProgress({ label: "Uploading" }).ok, true);
  assert.match(primitives.buildProgress({ label: "Uploading" }).html, /In progress/);
  assert.equal(primitives.buildDialog({ title: "" }).ok, false);
  assert.match(primitives.buildDialog({ title: "Confirm", body: "x" }).html, /aria-modal/);
});

test("P030-T03 tabs, switch, toast, disclosure semantics", () => {
  const tabs = primitives.buildTabs({
    id: "modes",
    tabs: [
      { label: "Pair", content: "Two groups" },
      { label: "Batch", content: "Many groups" },
    ],
  });
  assert.equal(tabs.ok, true);
  assert.match(tabs.html, /role="tablist"/);
  assert.match(tabs.html, /role="tabpanel"/);
  assert.match(primitives.buildSwitch({ id: "n", label: "Notify" }).html, /role="switch"/);
  assert.match(primitives.buildToast({ message: "Done", assertive: true }).html, /role="alert"/);
  assert.match(primitives.buildDisclosure({ id: "more", summary: "Details" }).html, /<details/);
});

test("P030-T04 package export and specimen", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./primitives"], "./primitives/index.js");
  const specimen = fs.readFileSync(path.join(root, "packages/ui/specimens/primitives.html"), "utf8");
  for (const needle of ["role=\"dialog\"", "role=\"switch\"", "role=\"tablist\"", "aria-busy", "role=\"progressbar\""]) {
    assert.ok(specimen.includes(needle), needle);
  }
});
