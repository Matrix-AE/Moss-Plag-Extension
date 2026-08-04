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
  assert.match(deployDoc, /Railway|mossapi-production|api\.mossworkflow\.dev/i);
  assert.match(deployDoc, /ALLOW_PUBLIC_MOSS_TCP/);
  assert.match(deployDoc, /ALLOW_HOSTED_PUBLIC_MOSS_TCP|Railway/i);
  assert.match(deployDoc, /NODE_ENV/);
  assert.match(deployDoc, /encrypted/);
  assert.match(deployDoc, /Chrome Web Store|store/i);
  assert.match(deployDoc, /\/health/);
  assert.doesNotMatch(deployDoc, /VITE_MOSS_USE_LOCAL_API/);
});

test("production extension defaults to hosted Railway API only", () => {
  assert.match(origins, /mossapi-production\.up\.railway\.app/);
  assert.match(origins, /VITE_MOSS_API_ORIGIN/);
  assert.doesNotMatch(origins, /localhost|127\.0\.0\.1|USE_LOCAL_API|VITE_MOSS_USE_LOCAL_API/);
  assert.match(apiClient, /resolveApiOrigin/);
  assert.doesNotMatch(apiClient, /USE_LOCAL_API|localhost|127\.0\.0\.1/);
  assert.match(wxt, /VITE_MOSS_API_ORIGIN/);
  assert.match(wxt, /mossapi-production\.up\.railway\.app/);
  assert.doesNotMatch(wxt, /VITE_MOSS_USE_LOCAL_API|allowLocalApi|localhost|127\.0\.0\.1/);
  assert.doesNotMatch(checkScript, /127\.0\.0\.1:8787|localhost/);
  assert.ok(fs.existsSync(path.join(root, "Dockerfile")));
  assert.ok(fs.existsSync(path.join(root, "railway.toml")));
  assert.ok(fs.existsSync(path.join(root, "docs/engineering/deploy-railway.md")));
});
