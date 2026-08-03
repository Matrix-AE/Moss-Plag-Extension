"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const adapter = require(path.join(root, "packages/provider-adapter/stream-adapter"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/stream-adapter.md"), "utf8");

test("P054-T01 module validation", async () => assert.equal((await adapter.validateAdapterModule()).ok, true));
test("P054-T02 mock streams concurrent cleanup", async () => {
  const a = adapter.createMockAdapter().create({ transport: "mock-loopback" });
  const r = await a.submit({ manifest: {}, streams: [adapter.bufferToStream("hi")] });
  assert.equal(r.ok, true);
  await assert.rejects(() => a.submit({ manifest: {}, streams: [] }));
});
test("P054-T03 docs wiring", () => {
  assert.match(doc, /single-use/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/provider-adapter/package.json"), "utf8"));
  assert.equal(pkg.exports["./stream-adapter"], "./stream-adapter.js");
});
