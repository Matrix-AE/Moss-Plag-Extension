"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const security = require(path.join(root, "apps/api/security/boundaries"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/security-boundaries.md"), "utf8");
const wxt = fs.readFileSync(path.join(root, "apps/extension/wxt.config.ts"), "utf8");

test("P064-T01 module validation", () => assert.equal(security.validateSecurityBoundariesModule().ok, true));

test("P064-T02 extension permission and CSP review", () => {
  const review = security.reviewExtensionManifest({
    permissions: ["storage", "alarms"],
    optional_permissions: [],
    host_permissions: [
      "https://api.mossworkflow.dev/",
      "https://uploads.mossworkflow.dev/",
    ],
    csp: "script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; connect-src 'self' https://api.mossworkflow.dev https://uploads.mossworkflow.dev",
  });
  assert.equal(review.ok, true);
  assert.equal(review.unnecessaryPermissions.length, 0);

  const bad = security.reviewExtensionManifest({
    permissions: ["storage", "alarms", "tabs", "history", "scripting"],
    optional_permissions: ["<all_urls>"],
    host_permissions: ["https://api.mossworkflow.dev/", "<all_urls>"],
    csp: "script-src 'self' 'unsafe-eval'",
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.unnecessaryPermissions.includes("tabs"));
  assert.ok(bad.unnecessaryPermissions.includes("history"));
  assert.match(wxt, /content_security_policy/);
  assert.doesNotMatch(wxt, /history|webRequest|<all_urls>|unsafe-eval/);
});

test("P064-T03 api abuse idor rate limit egress telemetry", () => {
  const gate = security.createSecurityGate({
    apiOrigins: ["https://api.mossworkflow.dev"],
    uploadOrigins: ["https://uploads.mossworkflow.dev"],
  });

  assert.equal(gate.checkCors({ origin: "https://evil.test", authenticated: true }).ok, false);
  assert.equal(gate.checkCors({ origin: "chrome-extension://abc", authenticated: true }).ok, true);

  const capped = gate.checkRequestCap({ bytes: 60 * 1024 * 1024 });
  assert.equal(capped.ok, false);

  const limited = [];
  for (let i = 0; i < 5; i++) limited.push(gate.checkRateLimit({ tenantId: "t1", route: "/jobs" }));
  assert.ok(limited.every((r) => r.ok));
  let denied = false;
  for (let i = 0; i < 200; i++) {
    const r = gate.checkRateLimit({ tenantId: "t1", route: "/jobs" });
    if (!r.ok) {
      denied = true;
      break;
    }
  }
  assert.equal(denied, true);

  assert.equal(gate.checkIdor({ resourceOwnerId: "u1", requesterId: "u2" }).ok, false);
  assert.equal(gate.checkIdor({ resourceOwnerId: "u1", requesterId: "u1" }).ok, true);

  assert.equal(gate.checkEgress({ target: "https://moss.stanford.edu", stage: "intake" }).ok, false);
  assert.equal(gate.checkEgress({ target: "https://moss.stanford.edu", stage: "submission" }).ok, true);

  const tel = gate.redactTelemetry({
    event: "job_done",
    filename: "secret.py",
    code: "print(1)",
    credential: "12345",
    reportUrl: "https://mock.local/r/1",
    jobId: "job_1",
  });
  assert.equal(tel.filename, undefined);
  assert.equal(tel.code, undefined);
  assert.equal(tel.credential, undefined);
  assert.equal(tel.reportUrl, undefined);
  assert.equal(tel.jobId, "job_1");

  const threats = security.listThreatMitigations();
  assert.ok(threats.every((t) => t.status === "implemented" || t.status === "risk-accepted"));
  assert.match(doc, /no unnecessary permission/i);
  assert.match(doc, /redacted telemetry/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./security/boundaries"], "./security/boundaries.js");
});
