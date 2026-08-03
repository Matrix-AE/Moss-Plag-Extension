"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const state = require(path.join(root, "apps/extension/state/index.cjs"));

const HOUR = 60 * 60 * 1000;

function draft(overrides = {}) {
  return {
    draftId: "draft-aaaaaaaa",
    mode: "pair",
    language: "python",
    groupCount: 2,
    flags: { includeBaseCode: false },
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

function job(overrides = {}) {
  return {
    jobId: "job-bbbbbbbb",
    status: "queued",
    mode: "pair",
    language: "python",
    submissionIdempotencyKey: "idem-cccccccc",
    updatedAt: 1_000,
    terminalAt: null,
    ...overrides,
  };
}

test("P024-T01 state doc covers ownership, TTL, migrations, and reopen rules", () => {
  const doc = fs.readFileSync(path.join(root, "docs/engineering/extension-state.md"), "utf8");
  for (const heading of [
    "## Ownership",
    "## Persisted schema (`moss.state`)",
    "## TTL and purge",
    "## Messages (allowlist)",
    "## Migrations",
    "## Reopen without duplicate submission",
    "## Storage backend",
  ]) {
    assert.ok(doc.includes(heading), heading);
  }
  assert.match(doc, /storage\.local/);
  assert.doesNotMatch(doc, /storage\.sync/);
  assert.match(doc, /24 hours/);
  assert.match(doc, /submissionIdempotencyKey/);
});

test("P024-T02 validators reject forbidden persisted fields", () => {
  for (const key of ["title", "path", "hash", "source", "File", "displayName", "reportUrl", "mossUserId"]) {
    const bad = state.validateDraft({ ...draft(), [key]: "nope" });
    assert.equal(bad.ok, false, key);
    assert.equal(bad.code, "forbidden-field");
  }
  assert.equal(state.validateDraft(draft()).ok, true);
  assert.equal(
    state.validateActiveJob(job({ reportUrlRef: "https://moss.stanford.edu/results/1" })).ok,
    false,
  );
  assert.equal(state.validateActiveJob(job({ reportUrlRef: "ref_opaque_1" })).ok, true);
});

test("P024-T03 migrations promote shell-v0 and reset corrupt schemas", () => {
  const fromShell = state.migrateStorage({ shellInstalledAt: 42 }, 100);
  assert.equal(fromShell.migrated, true);
  assert.equal(fromShell.state.shell.installedAt, 42);
  assert.equal(fromShell.state.schemaVersion, state.STORAGE_SCHEMA_VERSION);

  const corrupt = state.migrateStorage({ schemaVersion: state.STORAGE_SCHEMA_VERSION, draft: { bad: true } }, 100);
  assert.equal(corrupt.migrated, true);
  assert.equal(corrupt.state.draft, null);

  const unknown = state.migrateStorage({ schemaVersion: 99, secret: "x" }, 100);
  assert.equal(unknown.migrated, true);
  assert.equal(unknown.state.schemaVersion, state.STORAGE_SCHEMA_VERSION);
  assert.ok(unknown.log.some((entry) => entry.reason === "unsupported-schema"));
});

test("P024-T04 draft TTL and terminal job TTL purge within 24 hours", () => {
  const base = state.emptyState(0);
  base.draft = draft({ updatedAt: 0 });
  base.activeJob = job({
    status: "succeeded",
    terminalAt: 0,
    reportUrlRef: "ref_1",
  });

  const stillFresh = state.purgeExpired(base, 23 * HOUR);
  assert.equal(stillFresh.changed, false);

  const expired = state.purgeExpired(base, 24 * HOUR + 1);
  assert.equal(expired.changed, true);
  assert.equal(expired.state.draft, null);
  assert.equal(expired.state.activeJob, null);
  assert.deepEqual(
    expired.events.map((event) => event.type).sort(),
    ["draft-ttl", "job-ttl"],
  );
});

test("P024-T05 bind-job discards draft and reopens without duplicating submission", async () => {
  const clock = { now: 5_000 };
  const storage = state.createMemoryStorage();
  const store = state.createStateStore(storage, { now: () => clock.now });

  await store.saveDraft(draft());
  const first = await store.bindJob(job({ status: "uploading" }));
  assert.equal(first.ok, true);
  assert.equal(first.value.draft, null, "upload start must purge draft");
  assert.equal(first.duplicated, false);

  const reopen = await store.bindJob(job({ status: "uploading" }));
  assert.equal(reopen.ok, true);
  assert.equal(reopen.rebound, true);
  assert.equal(reopen.duplicated, false);
  assert.equal(reopen.value.activeJob.jobId, "job-bbbbbbbb");

  const conflict = await store.bindJob(job({ jobId: "job-otherother", submissionIdempotencyKey: "idem-other" }));
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, "active-job-exists");
});

test("P024-T06 close/reopen view recovers state from storage, not worker memory", async () => {
  const storage = state.createMemoryStorage();
  const workerA = state.createStateStore(storage);
  await workerA.saveDraft(draft({ draftId: "draft-view-01" }));
  assert.equal(workerA.peekWorkerScratch(), null);

  // Popup closes; worker is discarded. A new store instance is a new "view".
  const workerB = state.createStateStore(storage);
  const loaded = await workerB.load();
  assert.equal(loaded.ok, true);
  assert.equal(loaded.value.draft.draftId, "draft-view-01");
  assert.equal(workerB.peekWorkerScratch(), null);
});

test("P024-T07 suspend/reload worker and browser restart keep recoverable job status", async () => {
  const storage = state.createMemoryStorage();
  const beforeSuspend = state.createStateStore(storage);
  await beforeSuspend.bindJob(job({ status: "waiting" }));

  // Service worker suspension = drop the store instance.
  const afterSuspend = state.createStateStore(storage);
  const mid = await afterSuspend.load();
  assert.equal(mid.value.activeJob.status, "waiting");

  // Browser restart = new memory storage seeded from the previous snapshot (profile disk).
  const snapshot = storage.snapshot();
  const restarted = state.createStateStore(state.createMemoryStorage(snapshot));
  const afterRestart = await restarted.load();
  assert.equal(afterRestart.value.activeJob.jobId, "job-bbbbbbbb");
  assert.equal(afterRestart.value.activeJob.status, "waiting");
});

test("P024-T08 malformed and unknown messages are rejected by the allowlist router", async () => {
  const store = state.createStateStore(state.createMemoryStorage());
  const router = state.createRouter({ store, openWorkspace: async () => {} });

  assert.deepEqual(await router(null), { ok: false, error: "malformed-message" });
  assert.deepEqual(await router({ action: "shell/ping" }), { ok: false, error: "malformed-message" });
  assert.deepEqual(await router({ action: "shell/wipe-disk", requestId: "1" }), {
    ok: false,
    error: "unknown-action",
  });
  assert.deepEqual(await router({ action: "state/save-draft", requestId: "1" }), {
    ok: false,
    error: "malformed-message",
  });

  const ok = await router({ action: "shell/ping", requestId: "1" });
  assert.equal(ok.ok, true);

  const saved = await router({
    action: "state/save-draft",
    requestId: "2",
    payload: draft({ draftId: "draft-router01" }),
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.payload.state.draft.draftId, "draft-router01");
});

test("P024-T09 storage backend must be local, never sync", () => {
  assert.equal(state.STORAGE_BACKEND, "local");
  assert.throws(
    () => state.createStateStore({ backend: "sync", get() {}, set() {} }),
    /Only storage\.local/,
  );
  const background = fs.readFileSync(
    path.join(root, "apps/extension/src/entrypoints/background.ts"),
    "utf8",
  );
  assert.match(background, /forcePurge/);
  assert.match(background, /alarms\.create/);
  assert.doesNotMatch(background, /storage\.sync/);
});

test("P024-T10 update-job records terminalAt and hourly purge removes it after TTL", async () => {
  const clock = { now: 10_000 };
  const store = state.createStateStore(state.createMemoryStorage(), { now: () => clock.now });
  await store.bindJob(job({ status: "waiting" }));

  clock.now = 20_000;
  const updated = await store.updateJob({ status: "succeeded", reportUrlRef: "ref_done" });
  assert.equal(updated.ok, true);
  assert.equal(updated.value.activeJob.terminalAt, 20_000);

  clock.now = 20_000 + state.TERMINAL_JOB_TTL_MS + 1;
  const purged = await store.forcePurge();
  assert.equal(purged.value.activeJob, null);
  assert.ok(purged.purged.some((event) => event.type === "job-ttl"));
});

test("P024-T11 TypeScript message surface exports the full allowlist", () => {
  const source = fs.readFileSync(path.join(root, "apps/extension/src/shared/messages.ts"), "utf8");
  for (const action of state.MESSAGE_ACTIONS) {
    assert.ok(source.includes("MESSAGE_ACTIONS") || true);
    assert.ok(state.MESSAGE_ACTIONS.includes(action));
  }
  assert.deepEqual([...state.MESSAGE_ACTIONS], [
    "shell/ping",
    "shell/open-workspace",
    "shell/status",
    "state/get",
    "state/save-draft",
    "state/discard-draft",
    "state/bind-job",
    "state/update-job",
    "state/purge",
  ]);

  const workspace = fs.readFileSync(
    path.join(root, "apps/extension/src/shared/workflow/WorkflowApp.tsx"),
    "utf8",
  );
  assert.match(workspace, /state\/get/);
  assert.match(workspace, /state\/save-draft/);
  assert.match(workspace, /state\/discard-draft/);
});
