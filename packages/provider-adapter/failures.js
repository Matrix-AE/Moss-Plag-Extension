"use strict";

/**
 * Typed upstream failures and safe retry rules (Prompt 060).
 */

const FAILURES_VERSION = 1;

const PHASES = Object.freeze([
  "before-connect",
  "connected",
  "authenticated",
  "uploading",
  "query-sent",
  "awaiting-url",
  "completed",
]);

const URL_ALLOWLIST = Object.freeze([/^https:\/\/mock\.local\//i, /^https:\/\/[a-z0-9.-]+\.moss\.stanford\.edu\//i]);

function classifyFailure({ phase, cause, rawMessage = "" }) {
  const redacted = redact(rawMessage);
  const code = mapCause(cause, phase, rawMessage);
  const retryable = isRetryable(phase, code);
  const quotaAction = quotaActionFor(phase, code);
  const terminal = !retryable || code === "uncertain-query" || code === "ambiguous";
  return {
    ok: false,
    code,
    phase,
    retryable,
    requiresDeliberateResubmit: code === "uncertain-query" || code === "ambiguous" || phase === "query-sent" || phase === "awaiting-url",
    quotaAction,
    terminal,
    message: safeMessage(code),
    redacted,
  };
}

function mapCause(cause, phase, raw) {
  const text = `${cause} ${raw}`.toLowerCase();
  if (/credential|userid|unauthorized|auth/.test(text)) return "credential";
  if (/language|unknown language/.test(text)) return "language";
  if (/quota|limit|exceeded|no queries/.test(text)) return "quota";
  if (/overload|busy|try again later|503/.test(text)) return "overload";
  if (/timeout|deadline|etimedout/.test(text)) return "timeout";
  if (/ambiguous|try again|uncertain/.test(text)) return "uncertain-query";
  if (/url|http/.test(text) && phase === "awaiting-url") {
    if (!isAllowedResultUrl(raw)) return "invalid-url";
  }
  if (cause === "invalid-url") return "invalid-url";
  if (cause === "uncertain-query" || cause === "ambiguous") return "uncertain-query";
  return "generic-failure";
}

function isRetryable(phase, code) {
  // Automatic retry only before any upstream side effect
  if (phase === "query-sent" || phase === "awaiting-url" || phase === "completed") return false;
  if (code === "uncertain-query" || code === "ambiguous" || code === "invalid-url") return false;
  if (code === "credential" || code === "language" || code === "quota") return false;
  if (phase === "before-connect" || phase === "connected") {
    return code === "timeout" || code === "overload" || code === "generic-failure";
  }
  if (phase === "authenticated" || phase === "uploading") {
    return code === "timeout" || code === "overload";
  }
  return false;
}

function quotaActionFor(phase, code) {
  if (phase === "before-connect" || phase === "connected" || phase === "authenticated" || phase === "uploading") {
    return "release"; // query not confirmed
  }
  if (phase === "query-sent" || phase === "awaiting-url") {
    if (code === "uncertain-query") return "hold"; // do not infer reset; do not auto-release
    return "consume"; // side effect may have occurred
  }
  if (code === "quota") return "none";
  return "none";
}

function isAllowedResultUrl(url) {
  const text = String(url || "").trim();
  return URL_ALLOWLIST.some((re) => re.test(text));
}

function redact(value) {
  return String(value || "")
    .replace(/userid\s+\d+/gi, "userid [redacted]")
    .replace(/https?:\/\/\S+/gi, "[url-redacted]")
    .replace(/[A-Za-z]:\\[^\s]+/g, "[path-redacted]");
}

function safeMessage(code) {
  const map = {
    credential: "Provider credentials were rejected.",
    language: "The selected language is not accepted by the provider.",
    quota: "Provider numeric allowance was exceeded.",
    overload: "Provider is temporarily overloaded.",
    timeout: "The provider connection timed out.",
    "uncertain-query": "Provider outcome is uncertain — resubmit deliberately.",
    "invalid-url": "Provider returned a result URL that is not allowlisted.",
    "generic-failure": "The provider request failed.",
  };
  return map[code] || map["generic-failure"];
}

function advancePhase(current, event) {
  const idx = PHASES.indexOf(current);
  const next = {
    connect: "connected",
    auth: "authenticated",
    upload: "uploading",
    query: "query-sent",
    url: "awaiting-url",
    done: "completed",
  }[event];
  if (!next) return { ok: false, error: "unknown-event" };
  const nextIdx = PHASES.indexOf(next);
  if (nextIdx < idx) return { ok: false, error: "phase-regression" };
  return { ok: true, phase: next };
}

function validateFailuresModule() {
  const errors = [];
  for (const phase of PHASES) {
    const f = classifyFailure({ phase, cause: "timeout", rawMessage: "ETIMEDOUT userid 999" });
    if (!f.message || /999/.test(f.redacted)) errors.push(`redact-${phase}`);
  }

  const before = classifyFailure({ phase: "before-connect", cause: "timeout" });
  if (!before.retryable || before.quotaAction !== "release") errors.push("before");

  const after = classifyFailure({ phase: "query-sent", cause: "timeout" });
  if (after.retryable || after.quotaAction !== "consume") errors.push("after-query");

  const uncertain = classifyFailure({ phase: "awaiting-url", cause: "ambiguous", rawMessage: "TRY AGAIN" });
  if (!uncertain.requiresDeliberateResubmit || uncertain.quotaAction !== "hold") errors.push("ambiguous");

  const badUrl = classifyFailure({ phase: "awaiting-url", cause: "invalid-url", rawMessage: "http://evil.test/x" });
  if (badUrl.code !== "invalid-url" || badUrl.retryable) errors.push("url");

  if (!isAllowedResultUrl("https://mock.local/results/1")) errors.push("allow");
  if (isAllowedResultUrl("http://evil/x")) errors.push("deny");

  const dup = classifyFailure({ phase: "before-connect", cause: "timeout" });
  if (dup.code !== before.code) errors.push("dup");

  if (!advancePhase("before-connect", "connect").ok) errors.push("advance");
  if (advancePhase("query-sent", "connect").ok) errors.push("regression");

  return { ok: errors.length === 0, errors };
}

module.exports = {
  FAILURES_VERSION,
  PHASES,
  URL_ALLOWLIST,
  classifyFailure,
  isAllowedResultUrl,
  advancePhase,
  validateFailuresModule,
};
