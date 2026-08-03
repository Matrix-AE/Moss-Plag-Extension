"use strict";

/**
 * Extension and API security boundaries (Prompt 064).
 * Defense in depth: CSP, exact hosts, CORS, caps, rate limits, egress, telemetry redaction.
 */

const SECURITY_VERSION = 1;

const FORBIDDEN_PERMISSIONS = Object.freeze([
  "tabs",
  "history",
  "scripting",
  "webRequest",
  "webNavigation",
  "debugger",
  "clipboardRead",
  "clipboardWrite",
  "pageCapture",
  "management",
  "proxy",
  "dns",
]);

const ALLOWED_PERMISSIONS = Object.freeze(["storage", "alarms"]);

const MAX_REQUEST_BYTES = 32 * 1024 * 1024;
const DEFAULT_RATE = 60; // per window
const RATE_WINDOW_MS = 60_000;

function reviewExtensionManifest(manifest) {
  const unnecessaryPermissions = [];
  for (const p of manifest.permissions || []) {
    if (FORBIDDEN_PERMISSIONS.includes(p) || !ALLOWED_PERMISSIONS.includes(p)) {
      unnecessaryPermissions.push(p);
    }
  }
  for (const p of manifest.optional_permissions || []) {
    unnecessaryPermissions.push(`optional:${p}`);
  }
  for (const h of manifest.host_permissions || []) {
    if (h.includes("all_urls") || h === "<all_urls>" || h === "*://*/*") {
      unnecessaryPermissions.push(`host:${h}`);
    }
  }
  const cspIssues = [];
  const csp = String(manifest.csp || "");
  if (/unsafe-eval|unsafe-inline/i.test(csp)) cspIssues.push("unsafe-script");
  if (!/object-src 'none'/.test(csp)) cspIssues.push("object-src");
  if (!/script-src 'self'/.test(csp)) cspIssues.push("script-src");

  return {
    ok: unnecessaryPermissions.length === 0 && cspIssues.length === 0,
    unnecessaryPermissions,
    cspIssues,
  };
}

function createSecurityGate({
  apiOrigins = ["https://api.mossworkflow.dev"],
  uploadOrigins = ["https://uploads.mossworkflow.dev"],
  providerEgressAllow = [/^https:\/\/([a-z0-9.-]+\.)?moss\.stanford\.edu$/i, /^https:\/\/mock\.local$/i],
  now = () => Date.now(),
  maxRequestBytes = MAX_REQUEST_BYTES,
  rateLimit = DEFAULT_RATE,
} = {}) {
  const buckets = new Map();

  function checkCors({ origin, authenticated }) {
    if (!authenticated) return { ok: false, error: "unauthenticated-cors" };
    if (!origin) return { ok: false, error: "missing-origin" };
    if (origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://")) {
      return { ok: true };
    }
    const allowed = new Set([...apiOrigins, ...uploadOrigins]);
    try {
      const o = new URL(origin).origin;
      if (allowed.has(o) || [...allowed].some((a) => a === o)) return { ok: true };
    } catch {
      return { ok: false, error: "bad-origin" };
    }
    return { ok: false, error: "cors-denied" };
  }

  function checkRequestCap({ bytes }) {
    if (!Number.isFinite(bytes) || bytes < 0) return { ok: false, error: "invalid-size" };
    if (bytes > maxRequestBytes) return { ok: false, error: "request-too-large" };
    return { ok: true };
  }

  function checkRateLimit({ tenantId, route }) {
    const key = `${tenantId}:${route}`;
    const t = now();
    let bucket = buckets.get(key);
    if (!bucket || t - bucket.windowStart >= RATE_WINDOW_MS) {
      bucket = { windowStart: t, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > rateLimit) return { ok: false, error: "rate-limited" };
    return { ok: true, remaining: rateLimit - bucket.count };
  }

  function checkIdor({ resourceOwnerId, requesterId }) {
    if (!resourceOwnerId || !requesterId) return { ok: false, error: "missing-identity" };
    if (resourceOwnerId !== requesterId) return { ok: false, error: "idor-denied" };
    return { ok: true };
  }

  function checkEgress({ target, stage }) {
    if (stage === "intake" || stage === "public-api") {
      return { ok: false, error: "egress-denied-for-stage" };
    }
    if (stage !== "submission") return { ok: false, error: "unknown-stage" };
    let host;
    try {
      host = new URL(target).origin;
    } catch {
      return { ok: false, error: "bad-target" };
    }
    if (providerEgressAllow.some((re) => re.test(host))) return { ok: true };
    return { ok: false, error: "egress-denied" };
  }

  function redactTelemetry(event) {
    const blocked = new Set(["filename", "filenames", "code", "source", "credential", "credentials", "reportUrl", "url", "mossUserId"]);
    const out = {};
    for (const [k, v] of Object.entries(event || {})) {
      if (blocked.has(k)) continue;
      if (typeof v === "string" && /https?:\/\//i.test(v)) continue;
      out[k] = v;
    }
    return out;
  }

  function checkSupplyChain({ advisories = [] }) {
    const high = advisories.filter((a) => a.severity === "high" || a.severity === "critical");
    return { ok: high.length === 0, blocked: high };
  }

  return {
    checkCors,
    checkRequestCap,
    checkRateLimit,
    checkIdor,
    checkEgress,
    redactTelemetry,
    checkSupplyChain,
    apiOrigins,
    uploadOrigins,
  };
}

function listThreatMitigations() {
  return Object.freeze([
    { id: "csp", status: "implemented", summary: "Extension pages CSP without unsafe-eval" },
    { id: "exact-hosts", status: "implemented", summary: "API and dedicated upload origins only" },
    { id: "no-broad-permissions", status: "implemented", summary: "No history/all-sites/page-content" },
    { id: "authenticated-cors", status: "implemented", summary: "CORS requires authenticated extension/API origin" },
    { id: "request-caps", status: "implemented", summary: "Upload/request size caps" },
    { id: "rate-limits", status: "implemented", summary: "Per-tenant route rate limits" },
    { id: "stage-egress", status: "implemented", summary: "Provider egress only from submission workers" },
    { id: "telemetry-redaction", status: "implemented", summary: "No filenames/code/credentials/report URLs" },
    { id: "idor", status: "implemented", summary: "Owner-scoped resource checks" },
    { id: "supply-chain", status: "implemented", summary: "High/critical advisory gate" },
    {
      id: "payment-isolation",
      status: "risk-accepted",
      summary: "Payment provider integration deferred to commerce phase; non-launch until Prompt 071+",
    },
  ]);
}

function validateSecurityBoundariesModule() {
  const errors = [];
  const good = reviewExtensionManifest({
    permissions: ["storage", "alarms"],
    optional_permissions: [],
    host_permissions: ["https://api.mossworkflow.dev/", "https://uploads.mossworkflow.dev/"],
    csp: "script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  });
  if (!good.ok) errors.push("good-manifest");

  const bad = reviewExtensionManifest({
    permissions: ["storage", "history"],
    optional_permissions: [],
    host_permissions: ["<all_urls>"],
    csp: "script-src 'self' 'unsafe-eval'",
  });
  if (bad.ok) errors.push("bad-manifest");

  const gate = createSecurityGate({ rateLimit: 3 });
  if (gate.checkCors({ origin: "https://evil.test", authenticated: true }).ok) errors.push("cors");
  if (gate.checkRequestCap({ bytes: MAX_REQUEST_BYTES + 1 }).ok) errors.push("cap");
  gate.checkRateLimit({ tenantId: "t", route: "/x" });
  gate.checkRateLimit({ tenantId: "t", route: "/x" });
  gate.checkRateLimit({ tenantId: "t", route: "/x" });
  if (gate.checkRateLimit({ tenantId: "t", route: "/x" }).ok) errors.push("rate");
  if (gate.checkIdor({ resourceOwnerId: "a", requesterId: "b" }).ok) errors.push("idor");
  if (gate.checkEgress({ target: "https://moss.stanford.edu", stage: "intake" }).ok) errors.push("egress-intake");
  if (!gate.checkEgress({ target: "https://moss.stanford.edu", stage: "submission" }).ok) errors.push("egress-sub");
  const tel = gate.redactTelemetry({ jobId: "j", filename: "a.py", reportUrl: "https://x" });
  if (tel.filename || tel.reportUrl || !tel.jobId) errors.push("tel");
  const threats = listThreatMitigations();
  if (!threats.every((t) => t.status === "implemented" || t.status === "risk-accepted")) errors.push("threats");

  return { ok: errors.length === 0, errors, version: SECURITY_VERSION };
}

module.exports = {
  SECURITY_VERSION,
  FORBIDDEN_PERMISSIONS,
  ALLOWED_PERMISSIONS,
  MAX_REQUEST_BYTES,
  reviewExtensionManifest,
  createSecurityGate,
  listThreatMitigations,
  validateSecurityBoundariesModule,
};
