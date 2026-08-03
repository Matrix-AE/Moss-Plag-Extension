"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const shell = require(path.join(root, "packages/ui/shell"));
const doc = fs.readFileSync(path.join(root, "docs/design/extension-shell-components.md"), "utf8");

test("P031-T01 shell validation and landmarks", () => {
  assert.equal(shell.validateShell().ok, true);
  assert.match(doc, /banner/);
  assert.match(doc, /sticky/i);
  const popup = shell.buildShell({ surface: "popup", stickyActionsHtml: "<button>Go</button>" });
  assert.match(popup.html, /role="banner"/);
  assert.match(popup.html, /role="main"/);
  assert.match(popup.html, /contentinfo/);
  assert.equal(popup.viewport.width, 320);
});

test("P031-T02 offline and workspace rail", () => {
  const offline = shell.buildShell({ surface: "workspace", offline: true });
  assert.match(offline.html, /Offline/);
  assert.match(offline.html, /role="navigation"/);
  assert.equal(shell.buildShell({ surface: "nope" }).ok, false);
});

test("P031-T03 package export", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./shell"], "./shell/index.js");
});
