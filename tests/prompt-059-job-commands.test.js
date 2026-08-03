"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const cmds = require(path.join(root, "packages/provider-adapter/job-commands"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/job-commands.md"), "utf8");

test("P059-T01 module validation", () => assert.equal(cmds.validateCommandsModule().ok, true));
test("P059-T02 pair batch base snapshots", () => {
  const job = { providerUserId: "1", language: "python", title: "T", groups: [
    { id: "g1", files: [{ id: "1", displayName: "a.py", bytes: 1 }] },
    { id: "g2", files: [{ id: "2", displayName: "b.py", bytes: 1 }] },
  ]};
  const a = cmds.mapJobToCommands(job);
  const b = cmds.mapJobToCommands(job);
  assert.equal(a.ok, true);
  assert.equal(a.transcriptFingerprint, b.transcriptFingerprint);
  assert.ok(a.commands.some((c) => c.type === "query"));
});
test("P059-T03 docs wiring", () => {
  assert.match(doc, /free-form/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/provider-adapter/package.json"), "utf8"));
  assert.equal(pkg.exports["./job-commands"], "./job-commands.js");
  const workspace = fs.readFileSync(path.join(root, "apps/extension/src/shared/workflow/WorkflowApp.tsx"), "utf8");
  assert.match(workspace, /mock loopback adapter|never opens raw provider TCP/i);
});
