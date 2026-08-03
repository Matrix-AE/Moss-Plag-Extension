"use strict";

/**
 * Result experience completion screen (Prompt 067).
 * Centered on opening/protecting the provider-hosted similarity report.
 */

const RESULT_UX_VERSION = 1;

const REVIEW_GUIDANCE = Object.freeze([
  "Similarity highlights support human review; they are not a plagiarism verdict.",
  "Matched regions need instructor judgment in context.",
  "Do not treat estimated availability as a guarantee.",
]);

const WARNINGS_BASE = Object.freeze([
  "The report link is a bearer secret — anyone with the URL may view submitted code.",
  "Copying may leave the link in clipboard history; opening may leave it in browser history.",
  "Forget removes the product copy of the link; it does not revoke provider, browser, or clipboard copies.",
]);

function buildResultExperience({
  completedAt,
  language,
  mode,
  availabilityEstimate = null,
  reportUrl = null,
  urlForgotten = false,
  now = Date.now(),
} = {}) {
  const pastEstimate =
    availabilityEstimate?.availableUntil != null && availabilityEstimate.availableUntil < now;
  const linkAvailable = !urlForgotten && !!reportUrl;
  const warnings = [...WARNINGS_BASE];
  if (pastEstimate) {
    warnings.push("The availability estimate has passed; the provider report may already be unavailable.");
  }
  if (urlForgotten) {
    warnings.push("This record’s link was forgotten in the product.");
  }

  const actions = {
    open: { id: "open", label: "Open report", disabled: !linkAvailable },
    copy: { id: "copy", label: "Copy link", disabled: !linkAvailable },
    rerun: { id: "rerun", label: "Rerun with same settings", disabled: false },
    forget: { id: "forget", label: "Forget link", disabled: urlForgotten || !reportUrl },
  };

  return {
    ok: true,
    completedAt,
    language,
    mode,
    availabilityEstimate,
    pastEstimate,
    reportUrl: linkAvailable ? reportUrl : null,
    autoOpen: false,
    fabricatePercent: false,
    impliesMisconduct: false,
    callsLinkPrivate: false,
    forgetRevokesProvider: false,
    open: {
      href: linkAvailable ? reportUrl : null,
      rel: "noreferrer noopener",
      target: "_blank",
    },
    actions,
    warnings,
    reviewGuidance: [...REVIEW_GUIDANCE],
    a11y: {
      role: "region",
      ariaLabel: "Similarity report ready",
      live: "polite",
      keyboardOrder: ["open", "copy", "rerun", "forget"],
    },
  };
}

function performAction(vm, actionId) {
  if (!vm?.ok) return { ok: false, error: "invalid-view" };
  const action = vm.actions?.[actionId];
  if (!action) return { ok: false, error: "unknown-action" };
  if (action.disabled) return { ok: false, error: "blocked" };

  if (actionId === "open") {
    return {
      ok: true,
      url: vm.reportUrl,
      rel: vm.open.rel,
      target: vm.open.target,
    };
  }
  if (actionId === "copy") {
    return { ok: true, copied: true, url: vm.reportUrl };
  }
  if (actionId === "rerun") {
    return { ok: true, restore: "settings-only", sourceCleared: true };
  }
  if (actionId === "forget") {
    return {
      ok: true,
      forgotten: true,
      claimsProviderRevocation: false,
      claimsBrowserRevocation: false,
      claimsClipboardRevocation: false,
    };
  }
  return { ok: false, error: "unknown-action" };
}

function validateResultExperienceModule() {
  const errors = [];
  const vm = buildResultExperience({
    completedAt: "2026-08-03T12:00:00Z",
    language: "python",
    mode: "pair",
    reportUrl: "https://mock.local/results/ok",
    availabilityEstimate: { availableUntil: Date.now() + 10000 },
  });
  if (!vm.ok || vm.autoOpen || vm.fabricatePercent || vm.impliesMisconduct) errors.push("flags");
  if (vm.open.rel !== "noreferrer noopener") errors.push("rel");
  if (!performAction(vm, "open").ok || !performAction(vm, "copy").ok) errors.push("actions");

  const past = buildResultExperience({
    completedAt: "t",
    language: "java",
    mode: "batch",
    reportUrl: "https://mock.local/r",
    availabilityEstimate: { availableUntil: 1 },
    now: 100,
  });
  if (!past.pastEstimate) errors.push("past");

  const forgotten = buildResultExperience({
    completedAt: "t",
    language: "python",
    mode: "pair",
    urlForgotten: true,
  });
  if (performAction(forgotten, "open").ok) errors.push("blocked");
  if (!forgotten.a11y.keyboardOrder.includes("forget")) errors.push("a11y");
  if (vm.callsLinkPrivate || vm.forgetRevokesProvider) errors.push("claims");

  return { ok: errors.length === 0, errors, version: RESULT_UX_VERSION };
}

module.exports = {
  RESULT_UX_VERSION,
  REVIEW_GUIDANCE,
  WARNINGS_BASE,
  buildResultExperience,
  performAction,
  validateResultExperienceModule,
};
