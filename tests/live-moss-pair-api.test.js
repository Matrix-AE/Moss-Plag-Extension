"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const fs = require("node:fs");

const root = path.resolve(__dirname, "..");
const live = require(path.join(root, "packages/provider-adapter/live-submit"));
const { createServer } = require(path.join(root, "apps/api/server"));

test("live-submit exports and package map", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "packages/provider-adapter/package.json"), "utf8"),
  );
  assert.equal(pkg.exports["./live-submit"], "./live-submit.js");
  assert.equal(live.LIVE_SUBMIT_VERSION, 1);
});

test("public TCP is gated for production and missing flag", async () => {
  assert.throws(
    () => live.assertPublicMossAllowed({ env: { NODE_ENV: "production", ALLOW_PUBLIC_MOSS_TCP: "1" }, production: true }),
    (err) => err.code === "unencrypted-forbidden",
  );
  assert.throws(
    () => live.assertPublicMossAllowed({ env: {}, production: false }),
    (err) => err.code === "public-tcp-flag-required",
  );
});

test("mock-loopback pair submit returns allowlisted https URL", async () => {
  const result = await live.submitPairToMoss(
    {
      mossUserId: "123456",
      language: "python",
      files: [
        { displayName: "a.py", bytes: Buffer.from("print(1)\n") },
        { displayName: "b.py", bytes: Buffer.from("print(2)\n") },
      ],
      comment: "ci-pair",
    },
    { mode: "mock-loopback" },
  );
  assert.equal(result.ok, true);
  assert.match(result.reportUrl, /^https:\/\/mock\.local\//);
});

test("local API pair flow create → upload → finalize → reveal (mock)", async () => {
  const api = createServer({
    host: "127.0.0.1",
    port: 0,
    submitMode: "mock-loopback",
    env: { NODE_ENV: "test" },
  });
  // Bind ephemeral: override listen to use port 0 via server handle
  await new Promise((resolve, reject) => {
    api.server.listen(0, "127.0.0.1", (err) => (err ? reject(err) : resolve()));
  });
  const addr = api.server.address();
  const origin = `http://127.0.0.1:${addr.port}`;
  const owner = "demo@mossworkflow.test";

  async function call(method, pathname, body) {
    const response = await fetch(`${origin}${pathname}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Owner-User-Id": owner,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    return { status: response.status, data };
  }

  const health = await fetch(`${origin}/health`).then((r) => r.json());
  assert.equal(health.ok, true);
  assert.equal(health.submitMode, "mock-loopback");
  assert.equal(health.livePublicTcp, false);

  const created = await call("POST", "/v1/jobs", {
    language: "python",
    mode: "pair",
    idempotencyKey: "idem-ci-1",
    settings: { reportLabel: "ci" },
  });
  assert.equal(created.data.ok, true);
  const jobId = created.data.job.jobId;

  const cred = await call("POST", `/v1/jobs/${jobId}/credentials`, { mossUserId: "424242" });
  assert.equal(cred.data.ok, true);

  const a = Buffer.from("print('a')\n").toString("base64");
  const b = Buffer.from("print('b')\n").toString("base64");
  const uploaded = await call("POST", `/v1/jobs/${jobId}/uploads`, {
    files: [
      { displayName: "a.py", bytes: a },
      { displayName: "b.py", bytes: b },
    ],
  });
  assert.equal(uploaded.data.ok, true);

  const finalized = await call("POST", `/v1/jobs/${jobId}/finalize`, {});
  assert.equal(finalized.data.ok, true);

  let terminal = null;
  for (let i = 0; i < 40; i += 1) {
    await new Promise((r) => setTimeout(r, 50));
    const status = await call("GET", `/v1/jobs/${jobId}`);
    if (["succeeded", "failed", "ambiguous"].includes(status.data.job?.status)) {
      terminal = status.data.job;
      break;
    }
  }
  assert.ok(terminal, "job should reach a terminal status");
  assert.equal(terminal.status, "succeeded");
  assert.ok(terminal.reportUrlRef);

  const revealed = await call("POST", `/v1/jobs/${jobId}/result/reveal`, {});
  assert.equal(revealed.data.ok, true);
  assert.match(revealed.data.reportUrl, /^https:\/\/mock\.local\//);

  // Never log/leak userid in response bodies
  assert.equal(JSON.stringify(revealed.data).includes("424242"), false);

  await api.close();
});

test("resolveSubmitMode stays mock unless flag set", () => {
  const { resolveSubmitMode } = require(path.join(root, "apps/api/server"));
  assert.equal(resolveSubmitMode({}), "mock-loopback");
  assert.equal(resolveSubmitMode({ ALLOW_PUBLIC_MOSS_TCP: "1" }), "public-raw-tcp");
  assert.equal(resolveSubmitMode({ NODE_ENV: "production", ALLOW_PUBLIC_MOSS_TCP: "1" }), "mock-loopback");
});
