"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const mock = require(path.join(root, "packages/provider-adapter/mock-moss-server"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/mock-moss-server.md"), "utf8");

test("P055-T01 module validation", async () => assert.equal((await mock.validateMockServerModule()).ok, true));
test("P055-T02 loopback session transcript", async () => {
  const s = mock.createMockMossServer({ script: "valid", chunkSize: 2 });
  const addr = await s.start();
  assert.equal(addr.host, "127.0.0.1");
  await new Promise((resolve, reject) => {
    const c = net.connect(addr.port, addr.host, () => c.write("query\n"));
    c.on("data", () => { c.end(); resolve(); });
    c.on("error", reject);
    setTimeout(() => reject(new Error("t")), 2000);
  });
  const torn = await s.teardown();
  assert.ok(torn.transcripts.length >= 1);
});
test("P055-T03 docs wiring", () => {
  assert.match(doc, /loopback/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/provider-adapter/package.json"), "utf8"));
  assert.equal(pkg.exports["./mock-moss-server"], "./mock-moss-server.js");
});
