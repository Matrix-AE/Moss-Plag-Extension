"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const transport = require(path.join(root, "packages/provider-adapter/socket-transport"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/socket-transport.md"), "utf8");

test("P058-T01 module validation", async () => assert.equal((await transport.validateTransportModule()).ok, true));
test("P058-T02 production unencrypted blocked", () => {
  assert.throws(() => transport.createTransport({ mode: "mock-loopback", host: "127.0.0.1", port: 1, production: true }));
});
test("P058-T03 docs wiring", () => {
  assert.match(doc, /exactly-once cleanup/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/provider-adapter/package.json"), "utf8"));
  assert.equal(pkg.exports["./socket-transport"], "./socket-transport.js");
});
