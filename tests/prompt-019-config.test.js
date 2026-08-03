"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const config = require(path.join(root, "packages/config/env.js"));

function validEnv(overrides = {}) {
  return {
    APP_ENV: "production",
    PUBLIC_API_BASE_URL: "https://api.example.com",
    DATABASE_URL: "postgres://example",
    SESSION_SECRET: "x".repeat(32),
    OBJECT_STORAGE_BUCKET: "bucket",
    OBJECT_STORAGE_SECRET_KEY: "storage-secret",
    QUEUE_URL: "https://queue.example",
    PROVIDER_TRANSPORT: "encrypted-allowlisted",
    PROVIDER_HOST: "provider.example.internal",
    PROVIDER_PORT: "443",
    ...overrides,
  };
}

test("P019-T01 valid production env passes", () => {
  const result = config.validateApiEnv(validEnv());
  assert.equal(result.ok, true);
  assert.equal(result.value.hostedChecksIncluded, 40);
});

test("P019-T02 production rejects raw Moss TCP and insecure defaults", () => {
  const raw = config.validateApiEnv(
    validEnv({ PROVIDER_HOST: "moss.stanford.edu", PROVIDER_PORT: "7690" }),
  );
  assert.equal(raw.ok, false);
  assert.ok(raw.errors.some((e) => e.code === "raw-tcp-endpoint"));
  const insecure = config.validateApiEnv(validEnv({ ALLOW_INSECURE_DEFAULTS: "true" }));
  assert.ok(insecure.errors.some((e) => e.code === "insecure-default"));
});

test("P019-T03 missing secrets fail without echoing values", () => {
  const env = validEnv({ SESSION_SECRET: "" });
  const result = config.validateApiEnv(env);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.key === "SESSION_SECRET"));
  assert.equal(config.redact("super-secret"), "[REDACTED]");
});

test("P019-T04 extension public env allowlist rejects server keys", () => {
  const bad = config.validateExtensionPublicEnv({
    PUBLIC_API_BASE_URL: "https://api.example.com",
    PUBLIC_ENVIRONMENT: "production",
    DATABASE_URL: "postgres://nope",
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.code === "non-public-key"));
  const good = config.validateExtensionPublicEnv({
    PUBLIC_API_BASE_URL: "https://api.example.com",
    PUBLIC_ENVIRONMENT: "production",
  });
  assert.equal(good.ok, true);
});

test("P019-T05 example env files exist for api extension and worker", () => {
  for (const relative of [
    "apps/api/.env.example",
    "apps/extension/.env.example",
    "apps/worker-submit/.env.example",
  ]) {
    assert.ok(fs.existsSync(path.join(root, relative)), relative);
  }
});

test("P019-T06 tracked sources contain no canary secrets", () => {
  const result = spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0);
  const files = result.stdout.split(/\r?\n/).filter(Boolean);
  for (const relative of files) {
    if (relative.includes("prompt-019-config.test.js")) {
      continue;
    }
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute) || fs.statSync(absolute).isDirectory()) {
      continue;
    }
    const text = fs.readFileSync(absolute, "utf8");
    const hits = config.scanForCommittedCanaries(text);
    assert.deepEqual(hits, [], relative);
  }
});
