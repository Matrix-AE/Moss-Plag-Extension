"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const deployDoc = fs.readFileSync(
  path.join(root, "docs/engineering/deploy-api-mossworkflow.md"),
  "utf8",
);
const origins = fs.readFileSync(
  path.join(root, "apps/extension/src/shared/origins.ts"),
  "utf8",
);
const apiClient = fs.readFileSync(
  path.join(root, "apps/extension/src/shared/api-client.ts"),
  "utf8",
);
const wxt = fs.readFileSync(path.join(root, "apps/extension/wxt.config.ts"), "utf8");
const checkScript = fs.readFileSync(path.join(root, "scripts/check-extension-build.js"), "utf8");

test("deploy checklist covers hosted API and forbids production raw TCP", () => {
  assert.match(deployDoc, /api\.mossworkflow\.dev/);
  assert.match(deployDoc, /uploads\.mossworkflow\.dev/);
  assert.match(deployDoc, /ALLOW_PUBLIC_MOSS_TCP/);
  assert.match(deployDoc, /NODE_ENV/);
  assert.match(deployDoc, /encrypted/);
  assert.match(deployDoc, /Chrome Web Store|store/i);
  assert.match(deployDoc, /\/health/);
});

test("production extension defaults to hosted API only", () => {
  assert.match(origins, /API_ORIGIN = "https:\/\/api\.mossworkflow\.dev"/);
  assert.match(origins, /USE_LOCAL_API/);
  assert.match(origins, /VITE_MOSS_USE_LOCAL_API/);
  assert.match(apiClient, /resolveApiOrigin/);
  assert.match(apiClient, /USE_LOCAL_API/);
  assert.match(wxt, /VITE_MOSS_USE_LOCAL_API/);
  assert.match(wxt, /allowLocalApi/);
  assert.doesNotMatch(checkScript, /127\.0\.0\.1:8787/);
});
