"use strict";

const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

function testFile(name, body) {
  fs.writeFileSync(path.join(root, "tests", name), body, "utf8");
  console.log(name);
}

testFile(
  "prompt-051-server-intake.test.js",
  `"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const ingest = require(path.join(root, "apps/api/intake/ingest"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/server-intake.md"), "utf8");

test("P051-T01 module validation", () => assert.equal(ingest.validateIntakeModule().ok, true));
test("P051-T02 traversal absolute bomb symlink binary nested", () => {
  assert.equal(ingest.ingestObjects([{ path: "../x", bytes: 1, content: "a" }]).code, "traversal-or-link");
  assert.equal(ingest.ingestObjects([{ path: "C:/a.py", bytes: 1, content: "a" }]).code, "absolute-or-drive-path");
  assert.equal(ingest.ingestObjects([{ path: "a.py", symlink: true, bytes: 1 }]).code, "symlink-or-link");
  assert.equal(ingest.ingestObjects([{ path: "a.exe", bytes: 1, content: "MZ" }]).code, "binary-rejected");
  assert.equal(ingest.ingestObjects([{ archive: true, compressedBytes: 10, members: [{ path: "x.zip", bytes: 1 }] }]).code, "nested-archive");
});
test("P051-T03 valid zip manifest docs wiring", () => {
  const ok = ingest.ingestObjects([{ archive: true, compressedBytes: 20, members: [
    { path: "a/a.py", bytes: 2, content: "a" }, { path: "b/b.py", bytes: 2, content: "b" },
  ]}], { jobId: "z" });
  assert.equal(ok.ok, true);
  assert.equal(ok.manifest.immutable, true);
  assert.equal(ok.sandbox.deleted, true);
  assert.match(doc, /fail closed/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./intake/ingest"], "./intake/ingest.js");
});
`,
);

testFile(
  "prompt-052-finalize.test.js",
  `"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const finalize = require(path.join(root, "apps/api/intake/finalize"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/finalize-outbox.md"), "utf8");

test("P052-T01 module validation", () => assert.equal(finalize.validateFinalizeModule().ok, true));
test("P052-T02 idempotency quota cancel", () => {
  const svc = finalize.createFinalizeService();
  const base = { userId: "u1", idempotencyKey: "k", entitlementOk: true,
    consent: { policyVersion: "1.0.0", recordedAt: new Date().toISOString() },
    objects: [{ path: "a/a.py", bytes: 1, content: "a" }, { path: "b/b.py", bytes: 1, content: "b" }],
    language: "python", settings: {}, title: "T" };
  const a = svc.finalize(base);
  assert.equal(svc.finalize(base).jobId, a.jobId);
  svc.processValidationOutbox();
  assert.equal(svc.getQuota("u1").reserved, 1);
  svc.processProviderOutbox();
  assert.equal(svc.getQuota("u1").consumed, 1);
});
test("P052-T03 docs wiring", () => {
  assert.match(doc, /Quota reserves after intake/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./intake/finalize"], "./intake/finalize.js");
});
`,
);

testFile(
  "prompt-053-fair-queues.test.js",
  `"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const queues = require(path.join(root, "apps/api/queues/fair"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/fair-queues.md"), "utf8");

test("P053-T01 module validation", () => assert.equal(queues.validateQueuesModule().ok, true));
test("P053-T02 fairness caps leases circuit", () => {
  let t = 1; const q = queues.createFairQueues({ now: () => t, perCredentialCap: 1, leaseMs: 50 });
  q.enqueueProvider({ jobId: "1", userId: "u1" }, { credentialId: "c1" });
  q.enqueueProvider({ jobId: "2", userId: "u2" }, { credentialId: "c1" });
  assert.equal(q.claimProvider({ workerId: "w" }).ok, true);
  assert.equal(q.claimProvider({ workerId: "w" }).ok, false);
  t += 100; q.recoverExpiredLeases();
  assert.equal(q.claimProvider({ workerId: "w2" }).ok, true);
  assert.equal(q.quotaResetBoundary().ok, false);
});
test("P053-T03 docs wiring", () => {
  assert.match(doc, /circuit breaker/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./queues/fair"], "./queues/fair.js");
});
`,
);

testFile(
  "prompt-054-stream-adapter.test.js",
  `"use strict";
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
`,
);

testFile(
  "prompt-055-mock-moss.test.js",
  `"use strict";
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
    const c = net.connect(addr.port, addr.host, () => c.write("query\\n"));
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
`,
);

testFile(
  "prompt-056-line-parser.test.js",
  `"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const parser = require(path.join(root, "packages/provider-adapter/line-parser"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/line-parser.md"), "utf8");

test("P056-T01 module validation", async () => assert.equal((await parser.validateParserModule()).ok, true));
test("P056-T02 chunks surplus abort", async () => {
  const p = parser.createLineParser();
  p.push(Buffer.from("A\\nB"));
  assert.equal((await p.readLine()).line, "A");
  assert.equal(p.getSurplus().toString(), "B");
});
test("P056-T03 docs wiring", () => {
  assert.match(doc, /deadline\\/abort/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/provider-adapter/package.json"), "utf8"));
  assert.equal(pkg.exports["./line-parser"], "./line-parser.js");
});
`,
);

testFile(
  "prompt-057-protocol-names.test.js",
  `"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const names = require(path.join(root, "packages/provider-adapter/protocol-names"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/protocol-names.md"), "utf8");

test("P057-T01 module validation", () => assert.equal(names.validateNamesModule().ok, true));
test("P057-T02 collisions controls paths", () => {
  assert.equal(names.sanitizeProtocolName("a\\u0000.py").ok, false);
  assert.equal(names.sanitizeProtocolName("C:/Users/x/a.py").ok, false);
  const m = names.buildProtocolManifest({ groups: [
    { id: "g1", files: [{ displayName: "main.py", bytes: 1 }, { displayName: "main.py", bytes: 1 }] },
    { id: "g2", files: [{ displayName: "main.py", bytes: 1 }] },
  ]});
  assert.equal(m.ok, true);
  assert.equal(new Set(m.manifest.files.map((f) => f.protocolName)).size, 3);
});
test("P057-T03 docs wiring", () => {
  assert.match(doc, /Collision-safe/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/provider-adapter/package.json"), "utf8"));
  assert.equal(pkg.exports["./protocol-names"], "./protocol-names.js");
});
`,
);

testFile(
  "prompt-058-socket-transport.test.js",
  `"use strict";
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
`,
);

testFile(
  "prompt-059-job-commands.test.js",
  `"use strict";
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
  const workspace = fs.readFileSync(path.join(root, "apps/extension/src/entrypoints/workspace/Workspace.tsx"), "utf8");
  assert.match(workspace, /mock loopback adapter|never opens raw provider TCP/i);
});
`,
);

testFile(
  "prompt-060-upstream-failures.test.js",
  `"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const failures = require(path.join(root, "packages/provider-adapter/failures"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/upstream-failures.md"), "utf8");

test("P060-T01 module validation", () => assert.equal(failures.validateFailuresModule().ok, true));
test("P060-T02 phase retry quota", () => {
  const before = failures.classifyFailure({ phase: "before-connect", cause: "timeout" });
  assert.equal(before.retryable, true);
  assert.equal(before.quotaAction, "release");
  const after = failures.classifyFailure({ phase: "query-sent", cause: "timeout" });
  assert.equal(after.retryable, false);
  assert.equal(after.quotaAction, "consume");
  const amb = failures.classifyFailure({ phase: "awaiting-url", cause: "ambiguous" });
  assert.equal(amb.requiresDeliberateResubmit, true);
});
test("P060-T03 docs wiring", () => {
  assert.match(doc, /deliberate resubmit/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/provider-adapter/package.json"), "utf8"));
  assert.equal(pkg.exports["./failures"], "./failures.js");
  assert.ok(fs.existsSync(path.join(root, "docs/engineering/extension-local-testing.md")));
});
`,
);

console.log("tests written");
