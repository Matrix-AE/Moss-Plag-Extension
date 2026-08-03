"use strict";

/**
 * Actionable error and recovery UX (Prompt 069).
 * Map typed failures to clear copy, safe actions, and honest terminal explanations.
 */

const ERROR_UX_VERSION = 1;

const CATALOG = Object.freeze([
  {
    code: "validation",
    copy: {
      title: "Files need attention",
      body: "Fix the listed intake issues before submitting.",
    },
    retryEligible: false,
    actions: [{ id: "fix-draft", label: "Review files" }],
  },
  {
    code: "upload",
    copy: {
      title: "Upload interrupted",
      body: "The encrypted upload did not finish. You can retry the transfer.",
    },
    retryEligible: true,
    actions: [{ id: "retry", label: "Retry upload" }, { id: "reconnect", label: "Check connection" }],
  },
  {
    code: "auth",
    copy: {
      title: "Sign-in required",
      body: "Your session expired. Sign in again to continue.",
    },
    retryEligible: false,
    actions: [{ id: "settings", label: "Open account" }],
  },
  {
    code: "license",
    copy: {
      title: "Entitlement required",
      body: "This account cannot submit right now. Check your license or purchase status.",
    },
    retryEligible: false,
    actions: [{ id: "settings", label: "Open account" }, { id: "support", label: "Contact support" }],
  },
  {
    code: "quota",
    copy: {
      title: "Provider allowance used",
      body: "The linked provider identity has no remaining queries. Automatic retry is disabled.",
    },
    retryEligible: false,
    actions: [{ id: "settings", label: "Review provider ID" }, { id: "support", label: "Contact support" }],
    terminalExplanation: "Wait for the provider’s own reset; the product does not rotate identities for limits.",
  },
  {
    code: "worker",
    copy: {
      title: "Processing stalled",
      body: "A background worker failed before the provider accepted the query.",
    },
    retryEligible: true,
    actions: [{ id: "retry", label: "Retry safely" }],
  },
  {
    code: "provider",
    copy: {
      title: "Provider unavailable",
      body: "The similarity provider rejected or timed out the connection.",
    },
    retryEligible: true,
    actions: [{ id: "retry", label: "Retry" }, { id: "support", label: "Contact support" }],
  },
  {
    code: "uncertain-query",
    copy: {
      title: "Submission outcome uncertain",
      body: "The provider may already have accepted this query. Do not retry automatically — resubmit only deliberately.",
    },
    retryEligible: false,
    requiresDeliberateResubmit: true,
    actions: [{ id: "deliberate-resubmit", label: "Resubmit deliberately" }, { id: "support", label: "Contact support" }],
    terminalExplanation: "Automatic retry is blocked to protect quota.",
  },
  {
    code: "result",
    copy: {
      title: "Report link unavailable",
      body: "The product cannot open a stored report link for this job.",
    },
    retryEligible: false,
    actions: [{ id: "history", label: "Open history" }, { id: "support", label: "Contact support" }],
  },
  {
    code: "offline",
    copy: {
      title: "You appear offline",
      body: "Reconnect to continue polling job status or uploading.",
    },
    retryEligible: true,
    actions: [{ id: "reconnect", label: "Retry connection" }],
  },
  {
    code: "unknown",
    copy: {
      title: "Something went wrong",
      body: "An unexpected error occurred. Share the correlation ID with support if it continues.",
    },
    retryEligible: false,
    actions: [{ id: "support", label: "Contact support" }],
    terminalExplanation: "No safe automatic retry is offered for unknown failures.",
  },
]);

function listErrorCatalog() {
  return CATALOG.map((e) => ({
    code: e.code,
    copy: e.copy,
    retryEligible: e.retryEligible,
    action: e.actions?.[0] || null,
    terminalExplanation: e.terminalExplanation || null,
    requiresDeliberateResubmit: !!e.requiresDeliberateResubmit,
  }));
}

function resolveError({ code, correlationId = null, raw = "" } = {}) {
  void raw; // never surface raw payloads
  const found = CATALOG.find((e) => e.code === code) || CATALOG.find((e) => e.code === "unknown");
  return {
    ok: true,
    code: found.code,
    copy: { ...found.copy },
    retryEligible: found.retryEligible,
    requiresDeliberateResubmit: !!found.requiresDeliberateResubmit,
    actions: (found.actions || []).map((a) => ({ ...a })),
    terminalExplanation: found.terminalExplanation || null,
    correlationId: correlationId || null,
    a11y: {
      live: "assertive",
      focusTarget: "error-title",
      announce: `${found.copy.title}. ${found.copy.body}`,
    },
  };
}

function snapshotAllErrors() {
  return CATALOG.map((e) => ({
    code: e.code,
    title: e.copy.title,
    body: e.copy.body,
    retryEligible: e.retryEligible,
    actions: (e.actions || []).map((a) => a.id),
    correlationIdPlaceholder: "{{correlationId}}",
  }));
}

function validateErrorRecoveryModule() {
  const errors = [];
  const catalog = listErrorCatalog();
  if (catalog.length < 8) errors.push("count");
  for (const entry of catalog) {
    if (!entry.copy?.title || !entry.copy?.body) errors.push(`copy-${entry.code}`);
    if (!entry.action && !entry.terminalExplanation) errors.push(`action-${entry.code}`);
    const text = entry.copy.title + entry.copy.body;
    if (/stack|credential|userid|https?:\/\//i.test(text)) errors.push(`leak-${entry.code}`);
  }
  const uncertain = resolveError({ code: "uncertain-query", correlationId: "c" });
  if (uncertain.retryEligible || !uncertain.requiresDeliberateResubmit) errors.push("uncertain");
  const unknown = resolveError({ code: "nope", raw: "userid 123 /var/secret" });
  if (unknown.code !== "unknown") errors.push("fallback");
  if (/123|secret/.test(JSON.stringify(unknown))) errors.push("raw-leak");
  if (snapshotAllErrors().length !== CATALOG.length) errors.push("snapshot");
  return { ok: errors.length === 0, errors, version: ERROR_UX_VERSION };
}

module.exports = {
  ERROR_UX_VERSION,
  CATALOG,
  listErrorCatalog,
  resolveError,
  snapshotAllErrors,
  validateErrorRecoveryModule,
};
