"use strict";

const POPUP_SIZE = Object.freeze({ width: 320, height: 520 });
const WORKSPACE_SIZE = Object.freeze({ width: 880, height: 720 });

const STEPS = Object.freeze([
  "select",
  "group",
  "configure",
  "review",
  "paywall",
  "progress",
  "result",
  "failure",
]);

const WIREFRAMES = Object.freeze([
  "WF-01",
  "WF-02",
  "WF-03",
  "WF-04",
  "WF-05",
  "WF-06",
  "WF-07",
  "WF-08",
  "WF-09",
  "WF-10",
  "WF-11",
  "WF-12",
]);

const SCENARIOS = Object.freeze({
  "first-use": {
    surface: "popup",
    wireframe: "WF-01",
    entry: "install → action icon",
    recovery: "reopen popup → Open workspace",
    primaryAction: "Open workspace",
    allowsPayment: false,
    body: "Start a Pair or Batch check in the workspace.",
    card: "No active check",
  },
  "return-draft": {
    surface: "popup",
    wireframe: "WF-02",
    entry: "popup status card",
    recovery: "Resume in workspace",
    primaryAction: "Resume in workspace",
    allowsPayment: false,
    body: "A metadata-safe draft is waiting on this device.",
    card: "Draft saved — pair · 2 groups",
  },
  "free-demo": {
    surface: "workspace",
    wireframe: "WF-03",
    entry: "Load demo fixtures",
    recovery: "Discard / stay local",
    primaryAction: "Continue",
    allowsPayment: false,
    localOnly: true,
    step: "select",
    body: "Demo fixtures loaded. No upload or payment in this path.",
  },
  "local-draft": {
    surface: "workspace",
    wireframe: "WF-03",
    entry: "Open workspace → Select",
    recovery: "Discard draft text button",
    primaryAction: "Continue",
    allowsPayment: false,
    localOnly: true,
    step: "select",
    body: "Select supported source files. Titles/paths are not persisted.",
  },
  pair: {
    surface: "workspace",
    wireframe: "WF-04",
    entry: "Mode → Pair",
    recovery: "E-ONE / E-EMPTY banners",
    primaryAction: "Continue",
    allowsPayment: false,
    step: "group",
    body: "Exactly two submission groups for Pair Check.",
  },
  batch: {
    surface: "workspace",
    wireframe: "WF-05",
    entry: "Mode → Batch",
    recovery: "Add group / E-FLAT",
    primaryAction: "Continue",
    allowsPayment: false,
    step: "group",
    body: "Two or more groups. Multi-file projects stay together.",
  },
  configure: {
    surface: "workspace",
    wireframe: "WF-06",
    entry: "Group → Continue",
    recovery: "Unmark base code text control",
    primaryAction: "Continue to review",
    allowsPayment: false,
    step: "configure",
    body: "One language. Optional base-code disclosure.",
  },
  review: {
    surface: "workspace",
    wireframe: "WF-07",
    entry: "Configure → Continue",
    recovery: "Back; E-CONSENT blocks Continue",
    primaryAction: "Continue to payment",
    requiresConsent: true,
    allowsPayment: false,
    step: "review",
    body: "Review groups, language, and disclosures before any transfer.",
  },
  paywall: {
    surface: "workspace",
    wireframe: "WF-08",
    entry: "Review with both consents",
    recovery: "Back to review (no upload)",
    primaryAction: "Pay & unlock upload",
    allowsPayment: true,
    uploadStarted: false,
    step: "paywall",
    body: "$15 unlock. Files have not been uploaded yet.",
  },
  accounts: {
    surface: "settings",
    wireframe: "WF-09",
    entry: "Settings → Similarity account",
    recovery: "Disconnect text action",
    primaryAction: "Connect account",
    allowsPayment: false,
    body: "After purchase, connect your numeric Moss userid (BYO).",
  },
  processing: {
    surface: "workspace",
    wireframe: "WF-10",
    entry: "Paywall → Pay & unlock upload",
    recovery: "E-TIMEOUT / E-OFFLINE panels",
    primaryAction: "Working…",
    allowsPayment: false,
    step: "progress",
    body: "Opaque job id in progress. Popup only shows status.",
  },
  results: {
    surface: "workspace",
    wireframe: "WF-11",
    entry: "Progress → succeeded",
    recovery: "Forget link text button",
    primaryAction: "Open report",
    allowsPayment: false,
    step: "result",
    body: "Similarity report link with bearer-secret and human-review warnings.",
  },
  failures: {
    surface: "workspace",
    wireframe: "WF-12",
    entry: "Any blocked or provider failure",
    recovery: "Labeled primary recovery action",
    primaryAction: "Safe recovery action",
    allowsPayment: false,
    step: "failure",
    body: "Offline-before-send and sent-without-result are distinct. No blind retry.",
  },
});

const REQUIREMENT_MAP = Object.freeze([
  { id: "R-001", entry: "Workspace mode → Pair", recovery: "WF-04; E-ONE banner", wireframe: "WF-04" },
  { id: "R-002", entry: "Workspace mode → Batch", recovery: "WF-05; add group", wireframe: "WF-05" },
  { id: "R-003", entry: "Group step", recovery: "E-FLAT keep groups", wireframe: "WF-05" },
  { id: "R-004", entry: "Configure disclosure", recovery: "Unmark via text control", wireframe: "WF-06" },
  { id: "R-005", entry: "Configure", recovery: "E-MIXED block", wireframe: "WF-06" },
  { id: "R-006", entry: "Review step", recovery: "Back to Group/Configure", wireframe: "WF-07" },
  { id: "R-007", entry: "Review checkboxes", recovery: "E-CONSENT block", wireframe: "WF-07" },
  { id: "R-008", entry: "Result step", recovery: "Forget-link text action", wireframe: "WF-11" },
  { id: "R-009", entry: "All result copy", recovery: "—", wireframe: "WF-11" },
  { id: "R-010", entry: "Progress/Failure", recovery: "Distinct panels; no blind retry", wireframe: "WF-12" },
  { id: "R-011", entry: "Select", recovery: "E-INVALID reject", wireframe: "WF-03" },
  { id: "R-014", entry: "Popup resume", recovery: "Discard draft text", wireframe: "WF-02" },
  { id: "R-015", entry: "Action icon / Open", recovery: "WF-01/02", wireframe: "WF-01" },
  { id: "US-08", entry: "Load demo fixtures", recovery: "No upload/payment", wireframe: "WF-03" },
  { id: "Paywall", entry: "WF-08 only after Review", recovery: "Back; no upload", wireframe: "WF-08" },
  { id: "Account", entry: "Settings", recovery: "Disconnect text", wireframe: "WF-09" },
]);

function canEnterPaywall({ consentAuthority, consentProcessing, step }) {
  return step === "review" && consentAuthority === true && consentProcessing === true;
}

function primaryActionVisible(frame) {
  return typeof frame.primaryAction === "string" && frame.primaryAction.length > 0;
}

function paymentOnlyBeforeUpload(scenario) {
  if (scenario.allowsPayment) {
    return scenario.uploadStarted === false && scenario.wireframe === "WF-08";
  }
  return true;
}

function sizeFor(surface) {
  return surface === "popup" ? POPUP_SIZE : WORKSPACE_SIZE;
}

function createSession(scenarioId) {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) {
    throw new Error(`unknown scenario ${scenarioId}`);
  }
  return {
    scenarioId,
    scenario,
    step: scenario.step || (scenario.surface === "workspace" ? "select" : null),
    consentAuthority: false,
    consentProcessing: false,
    size: sizeFor(scenario.surface),
  };
}

function advance(session, action) {
  const next = {
    ...session,
    scenario: session.scenario,
  };
  if (action === "grant-consent") {
    next.consentAuthority = true;
    next.consentProcessing = true;
    next.step = "review";
    return { ok: true, session: next };
  }
  if (action === "continue-to-payment") {
    if (!canEnterPaywall(next)) {
      return { ok: false, code: "consent-required", session: next };
    }
    next.step = "paywall";
    return { ok: true, session: next };
  }
  if (action === "open-paywall-early") {
    return { ok: false, code: "paywall-too-early", session: next };
  }
  return { ok: false, code: "unknown-action", session: next };
}

function walkChecklist() {
  return Object.keys(SCENARIOS).map((id) => {
    const session = createSession(id);
    return {
      id,
      wireframe: session.scenario.wireframe,
      surface: session.scenario.surface,
      size: session.size,
      primaryAction: session.scenario.primaryAction,
      paymentOnlyBeforeUpload: paymentOnlyBeforeUpload(session.scenario),
      primaryVisible: primaryActionVisible(session.scenario),
      entry: session.scenario.entry,
      recovery: session.scenario.recovery,
    };
  });
}

const api = {
  POPUP_SIZE,
  WORKSPACE_SIZE,
  STEPS,
  WIREFRAMES,
  SCENARIOS,
  REQUIREMENT_MAP,
  canEnterPaywall,
  primaryActionVisible,
  paymentOnlyBeforeUpload,
  createSession,
  advance,
  walkChecklist,
  sizeFor,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
}
if (typeof window !== "undefined") {
  window.MossIA = api;
}
