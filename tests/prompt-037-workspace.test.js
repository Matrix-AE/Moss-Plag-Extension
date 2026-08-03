"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const flow = require(path.join(root, "packages/ui/workspace-flow"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/upload-workspace.md"), "utf8");
const workspace = fs.readFileSync(
  path.join(root, "apps/extension/src/shared/workflow/WorkflowApp.tsx"),
  "utf8",
);

test("P037-T01 workflow validation reaches result only after entitlement", () => {
  assert.equal(flow.validateWorkspaceFlow().ok, true);
  let state = flow.createWorkspaceState();
  assert.equal(flow.advance(state, { type: "start-job" }).ok, false);
  state = flow.advance(state, { type: "set-stage", stage: "review" }).state;
  state = flow.advance(state, { type: "set-consent", key: "ownership", value: true }).state;
  state = flow.advance(state, { type: "set-consent", key: "sensitiveLink", value: true }).state;
  assert.equal(flow.advance(state, { type: "set-stage", stage: "paywall" }).ok, true);
});

test("P037-T02 restart clears files and persistable draft stays allowlisted", () => {
  let state = flow.createWorkspaceState({ entitled: true });
  state = flow.advance(state, {
    type: "add-local-file",
    file: { name: "a.py", size: 10 },
  }).state;
  assert.equal(state.localFiles.length, 1);
  const restarted = flow.advance(state, { type: "simulate-restart" });
  assert.equal(restarted.requiresReselection, true);
  assert.equal(restarted.state.localFiles.length, 0);
  const persisted = flow.persistableDraft(state);
  for (const key of Object.keys(persisted)) {
    assert.ok(flow.PERSISTABLE_DRAFT_FIELDS.includes(key), key);
  }
});

test("P037-T03 workspace UI wires gates and docs", () => {
  assert.match(workspace, /Local preview/);
  assert.match(workspace, /Entitlement required|Simulate purchase/);
  assert.match(workspace, /Open paywall/);
  assert.match(workspace, /role="banner"/);
  assert.match(workspace, /role="contentinfo"/);
  assert.match(doc, /24-hour/);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./workspace-flow"], "./workspace-flow/index.js");
});
