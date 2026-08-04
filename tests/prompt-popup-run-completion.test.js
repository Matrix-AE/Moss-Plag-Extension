"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const lifecycle = require(path.join(root, "packages/ui/run-lifecycle"));
const progress = require(path.join(root, "packages/ui/progress"));
const { validateActiveJob } = require(path.join(root, "apps/extension/state/validate.cjs"));

const workflow = fs.readFileSync(
  path.join(root, "apps/extension/src/shared/workflow/WorkflowApp.tsx"),
  "utf8",
);
const entitlementSrc = fs.readFileSync(
  path.join(root, "apps/extension/src/shared/entitlement-demo.ts"),
  "utf8",
);
const reportPath = path.join(root, "apps/extension/src/entrypoints/report/Report.tsx");
const shellDoc = fs.readFileSync(path.join(root, "docs/engineering/extension-shell.md"), "utf8");
const localDoc = fs.readFileSync(
  path.join(root, "docs/engineering/extension-local-testing.md"),
  "utf8",
);

function drive(state, { now, steps = 12 } = {}) {
  let current = state;
  let clock = now ?? current.startedAt;
  for (let i = 0; i < steps && !lifecycle.isTerminalPhase(current.phase); i += 1) {
    clock += lifecycle.DEMO_STEP_MS;
    const advanced = lifecycle.advanceRunState(current, { now: clock });
    assert.equal(advanced.ok, true, advanced.error);
    current = advanced.state;
  }
  return current;
}

test("P-RUN-T01 a started run always reaches a terminal phase instead of spinning", () => {
  const started = lifecycle.createRunState({ now: 1_000, jobId: "job-abcdefgh" });
  assert.equal(started.phase, "validate");
  assert.equal(lifecycle.isTerminalPhase(started.phase), false);

  const finished = drive(started, { now: 1_000 });
  assert.equal(finished.phase, "success");
  assert.equal(lifecycle.isTerminalPhase(finished.phase), true);
  assert.ok(finished.resultRef, "success must carry a result reference");
  assert.equal(lifecycle.describeRun(finished, { reportUrl: "u" }).isTerminal, true);
});

test("P-RUN-T02 a bounded deadline turns a stalled run into an honest terminal state", () => {
  const started = lifecycle.createRunState({ now: 0, deadlineMs: 5_000, jobId: "job-abcdefgh" });
  assert.equal(started.deadlineAt, 5_000);
  assert.equal(lifecycle.remainingMs(started, 1_000), 4_000);

  const stalled = lifecycle.advanceRunState(started, { now: 5_001 });
  assert.equal(stalled.ok, true);
  assert.equal(stalled.deadlineExceeded, true);
  assert.equal(stalled.state.phase, "timeout");
  assert.equal(lifecycle.isTerminalPhase(stalled.state.phase), true);

  // Even a caller that keeps ticking can never leave the run non-terminal past the deadline.
  const again = lifecycle.advanceRunState(stalled.state, { now: 9_999_999 });
  assert.equal(again.state.phase, "timeout");
  assert.ok(lifecycle.RUN_DEADLINE_MS > 0 && lifecycle.RUN_DEADLINE_MS <= 5 * 60 * 1000);
});

test("P-RUN-T03 recovering a persisted job past its deadline never resumes a forever spinner", () => {
  const recovered = lifecycle.recoverRunState(
    { jobId: "job-abcdefgh", status: "waiting", mode: "pair", language: "python", updatedAt: 0 },
    { now: lifecycle.RUN_DEADLINE_MS + 1 },
  );
  assert.equal(recovered.ok, true);
  assert.equal(recovered.state.phase, "timeout");
  assert.equal(recovered.state.submitted, true);

  const fresh = lifecycle.recoverRunState(
    { jobId: "job-abcdefgh", status: "queued", mode: "pair", language: "python", updatedAt: 0 },
    { now: 500 },
  );
  assert.equal(fresh.state.phase, "queue");
  assert.equal(lifecycle.isTerminalPhase(fresh.state.phase), false);
});

test("P-RUN-T04 demo results are opaque, storable, and labelled as simulated", () => {
  const ref = lifecycle.createDemoResultRef("job-abcdefgh:1");
  assert.match(ref, /^demo-[0-9a-z]+$/);
  assert.doesNotMatch(ref, /^https?:\/\//i);

  const stored = validateActiveJob({
    jobId: "job-abcdefgh",
    status: "succeeded",
    mode: "pair",
    language: "python",
    submissionIdempotencyKey: "idem-abcdefgh",
    updatedAt: 10,
    terminalAt: 10,
    reportUrlRef: ref,
  });
  assert.equal(stored.ok, true, stored.message);
  assert.equal(stored.value.reportUrlRef, ref);

  assert.match(lifecycle.demoReportPath(ref), /^\/report\.html#ref=/);
  assert.match(lifecycle.LOCAL_DEMO_NOTICE, /not a MOSS similarity report/i);
  assert.match(lifecycle.LOCAL_DEMO_NOTICE, /no files were uploaded/i);
});

test("P-RUN-T05 terminal view models stay honest: no fabricated percent, no auto-open", () => {
  const finished = drive(lifecycle.createRunState({ now: 0, jobId: "job-abcdefgh" }));
  const view = lifecycle.describeRun(finished, { reportUrl: "chrome-extension://x/report.html#a" });
  assert.equal(view.fabricatePercent, false);
  assert.equal(view.autoOpen, false);
  assert.equal(view.isDemo, true);
  assert.equal(view.demoNotice, lifecycle.LOCAL_DEMO_NOTICE);
  assert.doesNotMatch(JSON.stringify(view), /plagiaris|verdict|\d+%/i);
  assert.equal(progress.viewModel(finished.phase).autoOpen, false);
});

test("P-RUN-T06 failures and timeouts expose recovery actions, not a silent spinner", () => {
  const failed = lifecycle.advanceRunState(lifecycle.createRunState({ now: 0, jobId: "job-abcdefgh" }), {
    now: 10,
    event: "fail",
    failureCode: "worker",
  });
  const failedView = lifecycle.describeRun(failed.state);
  assert.equal(failedView.isTerminal, true);
  assert.equal(failedView.error.code, "worker");
  assert.ok(failedView.error.actions.length > 0);
  assert.equal(failedView.reportUrl, null);

  const stalled = lifecycle.advanceRunState(
    { ...lifecycle.createRunState({ now: 0, jobId: "job-abcdefgh" }), phase: "wait", submitted: true },
    { now: lifecycle.RUN_DEADLINE_MS + 1 },
  );
  const stalledView = lifecycle.describeRun(stalled.state);
  assert.equal(stalledView.error.code, "uncertain-query");
  assert.equal(stalledView.error.requiresDeliberateResubmit, true);
});

test("P-RUN-T07 remaining runs are released only when nothing was submitted", () => {
  const start = lifecycle.createRunState({ now: 0, jobId: "job-abcdefgh" });
  const earlyFailure = lifecycle.advanceRunState(start, { now: 5, event: "fail", failureCode: "validation" });
  assert.equal(lifecycle.shouldReleaseRunCredit(earlyFailure.state), true);

  const submittedTimeout = lifecycle.advanceRunState(
    { ...start, phase: "wait", submitted: true },
    { now: lifecycle.RUN_DEADLINE_MS + 1 },
  );
  assert.equal(lifecycle.shouldReleaseRunCredit(submittedTimeout.state), false);

  const success = drive(start);
  assert.equal(lifecycle.shouldReleaseRunCredit(success), false);
  assert.equal(lifecycle.shouldReleaseRunCredit(start), false, "a running job never releases credit");
  assert.equal(lifecycle.validateRunLifecycleModule().ok, true);
});

test("P-RUN-T08 popup drives the lifecycle to a result link and releases credit on failure", () => {
  assert.match(workflow, /@moss\/ui\/run-lifecycle/);
  assert.match(workflow, /api-client/);
  assert.match(workflow, /probeApi|probeLocalApi|createPairJob|revealJobResult/);
  assert.match(workflow, /recoverRunState/);
  assert.match(workflow, /shouldReleaseRunCredit/);
  assert.match(workflow, /releaseDemoRun/);
  assert.match(workflow, /state\/bind-job/);
  assert.match(workflow, /state\/update-job/);
  // Progress must render a real terminal surface with a copyable, non-auto-opened link.
  assert.match(workflow, /run-result|result-card/);
  assert.match(workflow, /Copy link/i);
  assert.match(workflow, /noreferrer/);
  assert.doesNotMatch(workflow, /window\.open|tabs\.create/);
  assert.match(entitlementSrc, /export async function releaseDemoRun/);
  assert.match(entitlementSrc, /deobfuscateMossUserId/);
});

test("P-RUN-T09 a labelled local demo report page backs the produced link", () => {
  assert.ok(fs.existsSync(reportPath), "report entrypoint must exist");
  const report = fs.readFileSync(reportPath, "utf8");
  assert.match(report, /Local demo/i);
  assert.match(report, /LOCAL_DEMO_NOTICE/, "the page must render the honest demo notice");
  assert.match(report, /no similarity measurements/i);
  assert.doesNotMatch(report, /\d+\s*%/, "a simulated report must not invent similarity numbers");
  assert.match(shellDoc, /run-lifecycle|deadline/i);
  assert.match(shellDoc, /api\.mossworkflow\.dev/);
  assert.doesNotMatch(shellDoc, /connect-src 'self' https:\/\/api\.mossworkflow\.dev https:\/\/uploads\.mossworkflow\.dev http:\/\/127\.0\.0\.1:8787/);
  assert.match(localDoc, /deploy-api-mossworkflow|api\.mossworkflow\.dev/i);
  assert.match(localDoc, /VITE_MOSS_USE_LOCAL_API/);
  const wxt = fs.readFileSync(path.join(root, "apps/extension/wxt.config.ts"), "utf8");
  assert.match(wxt, /VITE_MOSS_USE_LOCAL_API/);
  assert.match(wxt, /allowLocalApi/);
  assert.doesNotMatch(wxt, /host_permissions:\s*\[API_ORIGIN,\s*UPLOAD_ORIGIN,\s*LOCAL_API_ORIGIN\]/);
});
