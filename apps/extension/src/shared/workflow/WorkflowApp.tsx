import { useCallback, useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import { browser } from "wxt/browser";

import * as intake from "@moss/ui/intake";
import * as language from "@moss/ui/language";
import * as grouping from "@moss/ui/grouping";
import * as settingsMod from "@moss/ui/settings";
import * as review from "@moss/ui/review";
import * as preflight from "@moss/ui/preflight";
import * as baseCode from "@moss/ui/base-code";

import { sendShellMessage } from "../shell-client";
import type { PersistedState } from "../state-types";
import {
  OFFER,
  clearDemoAccount,
  consumeDemoRun,
  isEntitled,
  loadDemoAccount,
  loadDemoEntitlement,
  purchaseDemoEntitlement,
  saveDemoAccount,
  type DemoAccount,
  type DemoEntitlement,
} from "../entitlement-demo";

type Gate = "loading" | "auth" | "paywall" | "portal";
type AuthMode = "signin" | "create";

type LocalItem = {
  id?: string;
  key?: string;
  displayName: string;
  size?: number;
  bytes?: number;
  status: string;
  reason?: string;
  sourceType?: string;
  role?: string;
  relativePath?: string;
  webkitRelativePath?: string;
  groupingHint?: string | null;
  localOnly?: boolean;
};

type DraftSettings = {
  resultCount: number;
  commonMatchThreshold: number;
  reportLabel: string;
  experimental: boolean;
  directoryMode: string;
  fileExtensions: string[];
};

function createInitialSettings(): DraftSettings {
  return {
    ...settingsMod.DEFAULTS,
    fileExtensions: [],
  };
}

function fileListFromInput(event: ChangeEvent<HTMLInputElement>): File[] {
  return event.target.files ? Array.from(event.target.files) : [];
}

function InfoTip({ label, children }: { label: string; children: string }) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="info-tip">
      <button
        type="button"
        className="info-tip__button"
        aria-expanded={open}
        aria-controls={tipId}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        i
      </button>
      {open ? (
        <span id={tipId} className="info-tip__pop" role="note">
          {children}
        </span>
      ) : null}
    </span>
  );
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
        <path
          d="M7 5h3v14H7zm7 0h3v14h-3z"
          fill="currentColor"
          opacity="0.9"
        />
        <path d="M5 8h4v2H5zm10 6h4v2h-4z" fill="currentColor" />
      </svg>
    </span>
  );
}

export function WorkflowApp() {
  const capsPayload = useMemo(
    () => language.normalizeCapabilities(language.createMossCapabilitiesFixture()).capabilities,
    [],
  );
  const [gate, setGate] = useState<Gate>("loading");
  const [authMode, setAuthMode] = useState<AuthMode>("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [account, setAccount] = useState<DemoAccount | null>(null);
  const [entitlement, setEntitlement] = useState<DemoEntitlement | null>(null);
  const [authError, setAuthError] = useState("");
  const [persisted, setPersisted] = useState<PersistedState | null>(null);
  const [note, setNote] = useState("Loading…");
  const [languageQuery, setLanguageQuery] = useState("");
  const [languageCode, setLanguageCode] = useState("");
  const [languageConfirmed, setLanguageConfirmed] = useState(false);
  const [languageHint, setLanguageHint] = useState(
    "Languages come from server capabilities. Suggestions still need confirmation.",
  );
  const [sourceItems, setSourceItems] = useState<LocalItem[]>([]);
  const [baseItems, setBaseItems] = useState<LocalItem[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [settings, setSettings] = useState<DraftSettings>(createInitialSettings);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [providerIdInput, setProviderIdInput] = useState("");
  const [providerIdMasked, setProviderIdMasked] = useState("");
  const [providerIdError, setProviderIdError] = useState("");
  const [settingError, setSettingError] = useState("");
  const [ownership, setOwnership] = useState(false);
  const [sensitiveLink, setSensitiveLink] = useState(false);
  const [warningsAck, setWarningsAck] = useState(false);
  const [gateMessage, setGateMessage] = useState(
    "Sign in and purchase before files leave this device.",
  );
  const [progressPhase, setProgressPhase] = useState(false);

  const comparisonMode = "pair" as const;
  const entitled = isEntitled(entitlement);
  const runsLeft = entitlement?.remaining ?? 0;

  const directoryMode = useMemo(
    () => settingsMod.deriveDirectoryMode({ groups }),
    [groups],
  );

  const languageOptions = useMemo(
    () => language.searchLanguages(languageQuery, capsPayload),
    [languageQuery, capsPayload],
  );

  const draftSnapshot = useMemo(
    () => ({
      mode: comparisonMode,
      language: languageCode || null,
      languageConfirmed,
      groups,
      baseFiles: baseItems,
      settings: { ...settings, directoryMode: "derived", experimental: false },
      title: settings.reportLabel || "Untitled comparison",
    }),
    [languageCode, languageConfirmed, groups, baseItems, settings],
  );

  const preflightResult = useMemo(() => {
    if (!groups.length) {
      return {
        ok: true,
        canProceed: false,
        errors: [] as Array<{ code: string; message: string }>,
        warnings: [] as Array<{ code: string; message: string }>,
      };
    }
    return preflight.runPreflight(draftSnapshot, { limits: preflight.DEFAULT_LIMITS });
  }, [draftSnapshot, groups.length]);

  const reviewSummary = useMemo(
    () =>
      review.buildReviewSummary(draftSnapshot, {
        entitlement: entitlement ? { remaining: entitlement.remaining } : null,
        retentionHours: 24,
      }),
    [draftSnapshot, entitlement],
  );

  const rebuildGroups = useCallback((items: LocalItem[]) => {
    const accepted = items.filter((item) => item.status === "accepted" || item.status === "base");
    const nextGroups = grouping.suggestGroups(accepted, { mode: "pair" });
    setGroups(nextGroups);
    return nextGroups;
  }, []);

  const resetConsent = useCallback(() => {
    setOwnership(false);
    setSensitiveLink(false);
    setWarningsAck(false);
  }, []);

  const resolveGate = useCallback((nextAccount: DemoAccount | null, nextEntitlement: DemoEntitlement | null) => {
    if (!nextAccount) {
      setGate("auth");
      return;
    }
    if (!isEntitled(nextEntitlement)) {
      setGate("paywall");
      return;
    }
    setGate("portal");
  }, []);

  const refreshSession = useCallback(async () => {
    const [nextAccount, nextEntitlement] = await Promise.all([loadDemoAccount(), loadDemoEntitlement()]);
    setAccount(nextAccount);
    setEntitlement(nextEntitlement);
    resolveGate(nextAccount, nextEntitlement);
  }, [resolveGate]);

  const refreshState = useCallback(async () => {
    const response = await sendShellMessage("state/get");
    if (!response.ok) {
      setNote("Waiting for the background worker to answer.");
      setPersisted(null);
      return;
    }
    const next = (response.payload?.["state"] as PersistedState) ?? null;
    setPersisted(next);
    if (response.payload?.["migrated"]) {
      setNote("Storage migrated to the current schema.");
    } else if (Array.isArray(response.payload?.["purged"]) && (response.payload["purged"] as unknown[]).length) {
      setNote("Expired draft or job references were purged.");
    } else if (next?.activeJob) {
      setNote(`Recovered active job ${next.activeJob.jobId} (${next.activeJob.status}).`);
      setProgressPhase(true);
    } else if (next?.draft) {
      setNote(`Recovered draft ${next.draft.draftId}. Reselect files after restart.`);
      if (next.draft.language) {
        setLanguageCode(String(next.draft.language));
        setLanguageConfirmed(false);
      }
    } else {
      setNote("Local preview stays on this device until consent and a run start.");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refreshSession();
      await refreshState();
    })();
  }, [refreshSession, refreshState]);

  const persistDraftShell = useCallback(async () => {
    await sendShellMessage("state/save-draft", {
      draftId: crypto.randomUUID(),
      mode: comparisonMode,
      language: languageCode || "python",
      groupCount: Math.max(groups.length, 2),
      flags: { includeBaseCode: baseItems.length > 0 },
    });
    await refreshState();
  }, [refreshState, languageCode, groups.length, baseItems.length]);

  const discard = useCallback(async () => {
    await sendShellMessage("state/discard-draft");
    setSourceItems([]);
    setBaseItems([]);
    setGroups([]);
    setLanguageCode("");
    setLanguageConfirmed(false);
    setSettings(createInitialSettings());
    setProviderIdInput("");
    setProviderIdMasked("");
    setProviderIdError("");
    setProgressPhase(false);
    resetConsent();
    await refreshState();
  }, [refreshState, resetConsent]);

  const onAuthSubmit = async () => {
    setAuthError("");
    if (!password || password.length < 6) {
      setAuthError("Use a password with at least 6 characters (demo only — not sent to a server).");
      return;
    }
    const saved = await saveDemoAccount(email);
    if (!saved.ok) {
      setAuthError(saved.error);
      return;
    }
    setAccount(saved.account);
    setPassword("");
    const nextEntitlement = await loadDemoEntitlement();
    setEntitlement(nextEntitlement);
    resolveGate(saved.account, nextEntitlement);
    setGateMessage(
      isEntitled(nextEntitlement)
        ? "Account ready. Pair Check is unlocked."
        : "Account ready. Purchase unlocks 15 Pair Check runs.",
    );
  };

  const onPurchase = async () => {
    const next = await purchaseDemoEntitlement();
    setEntitlement(next);
    setGate("portal");
    setGateMessage(
      `Demo entitlement active — ${next.remaining} of ${next.total} runs left. Files are not uploaded yet.`,
    );
  };

  const onSignOut = async () => {
    await clearDemoAccount();
    setAccount(null);
    setEntitlement(null);
    await discard();
    setGate("auth");
    setGateMessage("Signed out. Sign in again to continue.");
  };

  const applyLanguage = (code: string, { confirm = false } = {}) => {
    if (!code) {
      setLanguageCode("");
      setLanguageConfirmed(false);
      return;
    }
    const resolved = language.resolveManualSelection(code, capsPayload);
    if (!resolved.ok || !resolved.code) {
      setLanguageHint(resolved.error || "Unsupported language.");
      return;
    }
    setLanguageCode(resolved.code);
    setLanguageConfirmed(confirm);
    setLanguageHint(
      confirm
        ? `${resolved.label} confirmed for this check.`
        : `Selected ${resolved.label}. Confirm before continuing — guesses are never submitted silently.`,
    );
    resetConsent();
  };

  const onSourceFiles = (files: File[]) => {
    if (!entitled) {
      setNote("Purchase required before selecting files for a run.");
      return;
    }
    const room = OFFER.maxFilesPerRun - sourceItems.length;
    if (room <= 0) {
      setNote(`Pair Check allows max ${OFFER.maxFilesPerRun} files per run.`);
      return;
    }
    const capped = files.slice(0, room);
    const result = intake.ingestSelection(capped, {
      existing: [...sourceItems, ...baseItems],
      asBase: false,
      consentGranted: false,
    });
    if (!result.ok) {
      setNote(result.error || "Intake failed.");
      return;
    }
    if (result.uploaded) {
      setNote("Upload blocked during selection — files stay local-only.");
      return;
    }
    let accepted = result.items.filter((item) => item.status === "accepted") as LocalItem[];
    if (settings.fileExtensions.length) {
      accepted = accepted.filter((item) => {
        const name = item.displayName.toLowerCase();
        const ext = name.includes(".") ? `.${name.split(".").pop()}` : "";
        return settings.fileExtensions.includes(ext);
      });
    }
    accepted = accepted.slice(0, room);
    const nextSources = [...sourceItems, ...accepted].slice(0, OFFER.maxFilesPerRun);
    setSourceItems(nextSources);
    const nextGroups = rebuildGroups(nextSources);
    const suggestion = language.suggestLanguage(
      nextSources.map((item) => ({ displayName: item.displayName })),
      capsPayload,
    );
    if (suggestion.suggestion && !languageConfirmed) {
      setLanguageCode(suggestion.suggestion.code);
      setLanguageConfirmed(false);
      setLanguageHint(suggestion.guidance || "Confirm the suggested language before continuing.");
    } else if (suggestion.guidance) {
      setLanguageHint(suggestion.guidance);
    }
    setNote(
      `Added ${accepted.length} local file(s) (${nextSources.length}/${OFFER.maxFilesPerRun}). Nothing uploaded.`,
    );
    resetConsent();
    if (files.length > capped.length || nextSources.length >= OFFER.maxFilesPerRun) {
      setGateMessage(`Max ${OFFER.maxFilesPerRun} files per run for this offer.`);
    }
  };

  const removeSource = (index: number) => {
    const next = sourceItems.filter((_, i) => i !== index);
    setSourceItems(next);
    rebuildGroups(next);
    resetConsent();
  };

  const onBaseFiles = (files: File[]) => {
    if (!entitled) return;
    const result = baseCode.addBaseFiles(
      { ...draftSnapshot, baseFiles: baseItems },
      files,
      { language: languageCode || null, capabilities: capsPayload },
    );
    if (!result.ok || !result.draft) {
      setNote(result.error || "Base intake failed.");
      return;
    }
    setBaseItems(result.draft.baseFiles || []);
    setNote(`Base files updated (${(result.draft.baseFiles || []).length}). Base never counts as a group.`);
    resetConsent();
  };

  const removeBase = (index: number) => {
    setBaseItems((prev) => prev.filter((_, i) => i !== index));
    resetConsent();
  };

  const patchSetting = (key: keyof DraftSettings, value: unknown) => {
    const updated = settingsMod.updateSetting(settings, key, value);
    if (!updated.ok) {
      setSettingError(updated.error || "Invalid setting");
      return;
    }
    setSettings(updated.settings);
    setSettingError("");
    resetConsent();
  };

  const onProviderIdBlur = () => {
    const masked = settingsMod.maskProviderId(providerIdInput);
    if (!masked.ok) {
      setProviderIdError(masked.error || "Invalid provider id");
      setProviderIdMasked("");
      return;
    }
    // Keep raw digits only in component memory for later encrypted-vault wiring — never sync/log.
    setProviderIdInput(masked.digits);
    setProviderIdMasked(masked.masked);
    setProviderIdError("");
  };

  const tryStartJob = async () => {
    if (!entitled || runsLeft < 1) {
      setGateMessage("Entitlement required before upload/job creation.");
      return;
    }
    if (!languageCode || !languageConfirmed) {
      setGateMessage("Confirm a language from capabilities before starting.");
      return;
    }
    if (sourceItems.length !== OFFER.maxFilesPerRun || groups.length !== 2) {
      setGateMessage(`Pair Check needs exactly ${OFFER.maxFilesPerRun} files (two submissions).`);
      return;
    }
    if (!ownership || !sensitiveLink) {
      setGateMessage("Consents required before upload.");
      return;
    }
    if (!preflightResult.canProceed && preflightResult.errors.length > 0) {
      setGateMessage("Resolve blocking preflight findings before starting.");
      return;
    }
    if (preflightResult.warnings.length && !warningsAck) {
      setGateMessage("Acknowledge preflight warnings before starting.");
      return;
    }
    const recorded = review.recordConsent(review.createConsentState(), {
      ownership: true,
      sensitiveLink: true,
      policyVersion: review.CONSENT_POLICY_VERSION,
    });
    if (!recorded.ok) {
      setGateMessage(recorded.error || "Consent recording failed.");
      return;
    }
    const consumed = await consumeDemoRun();
    if (!consumed.ok) {
      setGateMessage(consumed.error);
      return;
    }
    setEntitlement(consumed.entitlement);
    setProgressPhase(true);
    setGateMessage(
      `Run started locally. ${consumed.entitlement.remaining} of ${consumed.entitlement.total} runs remaining. No fabricated percent is shown.`,
    );
  };

  const openSettings = () => {
    void browser.runtime.openOptionsPage();
  };

  const statusTitle =
    gate === "auth"
      ? "Account required"
      : gate === "paywall"
        ? "Unlock Pair Check"
        : progressPhase
          ? "Run in progress"
          : runsLeft < 1
            ? "No runs left"
            : "Ready to compare";

  const statusDetail =
    gate === "auth"
      ? "Create or sign in to continue. Files stay on this device until you purchase and consent."
      : gate === "paywall"
        ? `$${OFFER.priceUsd} unlocks ${OFFER.runs} runs · max ${OFFER.maxFilesPerRun} files each. Nothing is uploaded at checkout.`
        : progressPhase
          ? note
          : runsLeft < 1
            ? "Local demo entitlement is exhausted. Billing API will replace this simulate-purchase path."
            : `${runsLeft} of ${entitlement?.total ?? OFFER.runs} runs left · Pair Check · max ${OFFER.maxFilesPerRun} files`;

  if (gate === "loading") {
    return (
      <div className="shell shell--popup" role="status">
        <p className="status">Loading account…</p>
      </div>
    );
  }

  return (
    <div className="shell shell--popup">
      <header className="popup-header" role="banner">
        <div className="brand-row">
          <BrandMark />
          <div>
            <h1>Code Similarity</h1>
            <p className="brand-kicker">PAIR CHECK WORKFLOW</p>
          </div>
        </div>
      </header>

      <main className="popup-main" role="main">
        <section className="card status-card" aria-labelledby="status-heading">
          <div className="status-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h2 id="status-heading">{statusTitle}</h2>
          <p className="status">{statusDetail}</p>

          {gate === "auth" ? (
            <div className="auth-panel">
              <div className="segmented" role="tablist" aria-label="Account mode">
                <button
                  type="button"
                  className={authMode === "create" ? "segmented__chip is-active" : "segmented__chip"}
                  onClick={() => setAuthMode("create")}
                >
                  Create account
                </button>
                <button
                  type="button"
                  className={authMode === "signin" ? "segmented__chip is-active" : "segmented__chip"}
                  onClick={() => setAuthMode("signin")}
                >
                  Sign in
                </button>
              </div>
              <label className="stack-field" htmlFor="account-email">
                <span className="type-label">Email</span>
                <input
                  id="account-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className="stack-field" htmlFor="account-password">
                <span className="type-label">Password</span>
                <input
                  id="account-password"
                  type="password"
                  autoComplete={authMode === "create" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              {authError ? (
                <p className="status status--danger" role="alert">
                  {authError}
                </p>
              ) : (
                <p className="status">Demo account only — credentials stay on this device.</p>
              )}
              <button type="button" className="cta" onClick={() => void onAuthSubmit()}>
                {authMode === "create" ? "Create account" : "Sign in"}
              </button>
            </div>
          ) : null}

          {gate === "paywall" ? (
            <div className="paywall-panel">
              <ul className="offer-list">
                <li>
                  <strong>${OFFER.priceUsd}</strong> one-time personal unlock
                </li>
                <li>
                  <strong>{OFFER.runs}</strong> hosted similarity runs
                </li>
                <li>
                  Max <strong>{OFFER.maxFilesPerRun}</strong> files per run (Pair Check)
                </li>
              </ul>
              <p className="status">Files have not been uploaded yet.</p>
              <button type="button" className="cta" onClick={() => void onPurchase()}>
                Unlock {OFFER.runs} runs · ${OFFER.priceUsd}
              </button>
              <p className="status">
                Simulated purchase for local demo — no payment-processor secrets, no live charge.
              </p>
            </div>
          ) : null}

          {gate === "portal" ? (
            <div className="portal-cta">
              <button
                type="button"
                className="cta"
                disabled={progressPhase || runsLeft < 1}
                onClick={() => void tryStartJob()}
              >
                {progressPhase ? "Working…" : runsLeft < 1 ? "No runs left" : "Start Pair Check"}
              </button>
              <p className="status status-inline">
                <span className="status-dot" aria-hidden="true" />
                {gateMessage}
              </p>
            </div>
          ) : null}
        </section>

        {gate === "portal" ? (
          <>
            <section className="card controls-card" aria-labelledby="controls-heading">
              <div className="row section-head">
                <h2 id="controls-heading">Pair Check</h2>
                <InfoTip label="About Pair Check">
                  This offer compares exactly two files per run. Batch mode stays unavailable until a larger entitlement ships.
                </InfoTip>
              </div>
              <p className="status">Mode locked to Pair Check · max {OFFER.maxFilesPerRun} files.</p>

              <label className="stack-field" htmlFor="language-search">
                <span className="type-label">Search languages</span>
                <input
                  id="language-search"
                  type="search"
                  value={languageQuery}
                  onChange={(event) => setLanguageQuery(event.target.value)}
                  aria-label="Search languages"
                  autoComplete="off"
                />
              </label>
              <label className="stack-field" htmlFor="workspace-language">
                <span className="type-label">Language</span>
                <select
                  id="workspace-language"
                  aria-label="Programming language"
                  value={languageCode}
                  onChange={(event) => applyLanguage(event.target.value)}
                >
                  <option value="">Select…</option>
                  {languageOptions.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="row">
                <p className="status">{languageHint}</p>
                <button
                  type="button"
                  className="secondary"
                  disabled={!languageCode || languageConfirmed}
                  onClick={() => applyLanguage(languageCode, { confirm: true })}
                >
                  Confirm language
                </button>
              </div>

              <div className="file-pickers">
                <label className="file-button">
                  File 1
                  <input
                    type="file"
                    aria-label="Choose first file"
                    onChange={(event) => {
                      onSourceFiles(fileListFromInput(event));
                      event.target.value = "";
                    }}
                  />
                </label>
                <label className="file-button">
                  File 2
                  <input
                    type="file"
                    aria-label="Choose second file"
                    disabled={sourceItems.length >= OFFER.maxFilesPerRun}
                    onChange={(event) => {
                      onSourceFiles(fileListFromInput(event));
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
              <ul className="file-list" aria-label="Selected source files">
                {sourceItems.map((item, index) => (
                  <li key={`${item.displayName}-${index}`} className="file-row">
                    <span>{item.displayName}</span>
                    <button type="button" className="secondary" onClick={() => removeSource(index)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <p className="status">{note}</p>
            </section>

            <section className="card" aria-labelledby="advanced-heading">
              <button
                type="button"
                className="disclosure"
                aria-expanded={advancedOpen}
                onClick={() => setAdvancedOpen((value) => !value)}
              >
                <h2 id="advanced-heading">Advanced options</h2>
                <span>{advancedOpen ? "Hide" : "Show"}</span>
              </button>
              {advancedOpen ? (
                <div className="disclosure-body">
                  <p className="status">
                    Safe defaults work untouched. Experimental mode is disabled. Directory mode stays derived.
                  </p>
                  <label className="stack-field" htmlFor="common-match">
                    <span>Common-match threshold (M)</span>
                    <input
                      id="common-match"
                      type="number"
                      min={settingsMod.BOUNDS.commonMatchThreshold.min}
                      max={settingsMod.BOUNDS.commonMatchThreshold.max}
                      value={settings.commonMatchThreshold}
                      onChange={(event) => patchSetting("commonMatchThreshold", Number(event.target.value))}
                    />
                  </label>
                  <label className="stack-field" htmlFor="result-count">
                    <span>Result count (N)</span>
                    <input
                      id="result-count"
                      name="resultCount"
                      type="number"
                      min={settingsMod.BOUNDS.resultCount.min}
                      max={settingsMod.BOUNDS.resultCount.max}
                      value={settings.resultCount}
                      onChange={(event) => patchSetting("resultCount", Number(event.target.value))}
                    />
                  </label>
                  <label className="stack-field" htmlFor="report-label">
                    <span>Report label / comment (C)</span>
                    <input
                      id="report-label"
                      type="text"
                      maxLength={settingsMod.BOUNDS.reportLabelMax}
                      value={settings.reportLabel}
                      onChange={(event) => patchSetting("reportLabel", event.target.value)}
                    />
                  </label>
                  <label className="stack-field" htmlFor="file-restrict">
                    <span>Restrict file types</span>
                    <input
                      id="file-restrict"
                      type="text"
                      placeholder=".py, .java"
                      value={settings.fileExtensions.join(", ")}
                      onChange={(event) => patchSetting("fileExtensions", event.target.value)}
                    />
                  </label>
                  <label className="stack-field">
                    <span>Directory mode</span>
                    <input type="text" value={directoryMode} readOnly aria-readonly="true" />
                  </label>
                  <label className="stack-field">
                    <span>Experimental server</span>
                    <input type="text" value="Unavailable" disabled aria-disabled="true" />
                  </label>
                  <p className="status" data-experimental="locked">
                    Experimental server is unavailable — production transport policy keeps the experimental flag off.
                  </p>
                  <div className="row section-head">
                    <h3>Base code</h3>
                    <InfoTip label="About base code">{baseCode.explainBaseEffect().body}</InfoTip>
                  </div>
                  <label className="file-button">
                    Add base files
                    <input
                      type="file"
                      multiple
                      aria-label="Add base files"
                      data-role="base"
                      onChange={(event) => {
                        onBaseFiles(fileListFromInput(event));
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <ul className="file-list" aria-label="Base files">
                    {baseItems.map((item, index) => (
                      <li key={`${item.displayName}-base-${index}`} className="file-row file-row--base">
                        <span>{item.displayName} (base)</span>
                        <button type="button" className="secondary" onClick={() => removeBase(index)}>
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  {settingError ? (
                    <p className="status status--danger" role="alert">
                      {settingError}
                    </p>
                  ) : null}
                  <button type="button" className="secondary" onClick={() => setSettings(createInitialSettings())}>
                    Reset to defaults
                  </button>
                </div>
              ) : null}
            </section>

            <section className="card" aria-labelledby="account-heading">
              <button
                type="button"
                className="disclosure"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((value) => !value)}
              >
                <h2 id="account-heading">Account</h2>
                <span>{accountOpen ? "Hide" : "Show"}</span>
              </button>
              {accountOpen ? (
                <div className="disclosure-body">
                  <p className="status">Signed in as {account?.email}</p>
                  <p className="status">
                    After entitlement, connect your own numeric provider ID (BYO). It is never authentication for this
                    extension, never written to sync storage or logs, and is prepared for later encrypted-vault wiring.
                  </p>
                  <label className="stack-field" htmlFor="provider-id">
                    <span>Provider ID</span>
                    <input
                      id="provider-id"
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      value={providerIdInput}
                      disabled={!entitled}
                      onChange={(event) => setProviderIdInput(event.target.value)}
                      onBlur={onProviderIdBlur}
                      aria-describedby="provider-id-help"
                    />
                  </label>
                  <p id="provider-id-help" className="status">
                    {providerIdMasked
                      ? `Masked on device: ${providerIdMasked}`
                      : "Enter the numeric ID, then leave the field to mask it."}
                  </p>
                  {providerIdError ? (
                    <p className="status status--danger" role="alert">
                      {providerIdError}
                    </p>
                  ) : null}
                  <button type="button" className="secondary" onClick={() => void onSignOut()}>
                    Sign out
                  </button>
                </div>
              ) : null}
            </section>

            <section className="card" aria-labelledby="preflight-heading">
              <h2 id="preflight-heading">Preflight</h2>
              <div className="preflight" role="region" aria-label="Preflight findings">
                {preflightResult.errors.length === 0 && preflightResult.warnings.length === 0 ? (
                  <p className="status">Blocking and warning findings appear here before upload.</p>
                ) : (
                  <ul>
                    {preflightResult.errors.map((item) => (
                      <li key={item.code}>
                        <strong>Block:</strong> {item.message}
                      </li>
                    ))}
                    {preflightResult.warnings.map((item) => (
                      <li key={item.code}>
                        <strong>Warning:</strong> {item.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {preflightResult.warnings.length > 0 ? (
                <label className="row">
                  <input
                    type="checkbox"
                    checked={warningsAck}
                    onChange={(event) => setWarningsAck(event.target.checked)}
                  />
                  <span>I acknowledge these warnings. Acknowledgements reset after material changes.</span>
                </label>
              ) : null}
            </section>

            <section className="card" aria-labelledby="review-gate">
              <h2 id="review-gate">Review consents</h2>
              <div className="review-summary" aria-label="Review summary">
                <p className="status">
                  {reviewSummary.mode} · {reviewSummary.language || "language unset"} ·{" "}
                  {reviewSummary.groups?.length || 0} groups · {runsLeft} runs left
                </p>
              </div>
              <label className="row consent-row">
                <input
                  type="checkbox"
                  checked={ownership}
                  onChange={(event) => setOwnership(event.target.checked)}
                />
                <span>I confirm I have the right to submit these files.</span>
              </label>
              <label className="row consent-row">
                <input
                  type="checkbox"
                  checked={sensitiveLink}
                  onChange={(event) => setSensitiveLink(event.target.checked)}
                />
                <span>I understand the report link is sensitive like a password.</span>
              </label>
              <p className="status">
                Upload starts only after entitlement and recorded consent. The extension never opens raw provider TCP.
              </p>
            </section>

            {persisted?.activeJob || persisted?.draft ? (
              <section className="card" aria-labelledby="recoverable">
                <h2 id="recoverable">Recoverable state</h2>
                <p className="status">{note}</p>
                <div className="row wrap">
                  <button type="button" className="secondary" onClick={() => void persistDraftShell()}>
                    Save demo draft
                  </button>
                  <button type="button" className="secondary" onClick={() => void discard()}>
                    Discard draft
                  </button>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </main>

      <footer role="contentinfo" className="popup-footer sticky-cta">
        <p className="footer-meta">
          {gate === "portal" ? (
            <>
              <span className="kbd">{runsLeft}</span> runs left
            </>
          ) : (
            <>Local demo · no live billing</>
          )}
        </p>
        <button type="button" className="settings-chip" onClick={openSettings}>
          SETTINGS
        </button>
      </footer>
    </div>
  );
}
