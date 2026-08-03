"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const harness = require(path.join(
  path.resolve(__dirname, ".."),
  "packages",
  "testing",
  "harness.js",
));

test("P020-T01 harness suite marks every layer offline without live Moss", () => {
  const suite = harness.createHarnessSuite();
  for (const layer of Object.values(suite)) {
    assert.equal(layer.runOffline, true);
    assert.equal(layer.requiresLiveMoss, false);
  }
  assert.equal(suite.protocolHarness.fullMockTcpDeferredToPrompt, 55);
});

test("P020-T02 fake transport succeeds offline and records calls", async () => {
  const transport = harness.createFakeProviderTransport({ mode: "success" });
  const result = await transport.submit({ jobId: "j1" });
  assert.equal(result.status, "succeeded");
  assert.equal(result.reportUrlRef, "res_fake_001");
  assert.equal(transport.calls.length, 1);
});

test("P020-T03 fake transport blocks moss.stanford.edu egress", async () => {
  const transport = harness.createFakeProviderTransport();
  await assert.rejects(
    () => transport.submit({ jobId: "j2", egressHost: "moss.stanford.edu" }),
    (error) => error.code === "egress-blocked",
  );
});

test("P020-T04 timeout mode seeds ambiguous recovery defect path", async () => {
  const transport = harness.createFakeProviderTransport({ mode: "timeout" });
  const result = await transport.submit({ jobId: "j3" });
  assert.equal(result.status, "ambiguous");
  assert.equal(result.reportUrlRef, null);
});

test("P020-T05 CI forbids live Moss smoke flag", () => {
  assert.equal(harness.assertNoLiveMossDependency({ CI: "true" }), true);
  assert.throws(
    () => harness.assertNoLiveMossDependency({ CI: "true", MOSS_LIVE_SMOKE: "1" }),
    (error) => error.code === "live-moss-in-ci",
  );
});
