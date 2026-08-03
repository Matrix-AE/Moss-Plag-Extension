import { useCallback, useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import type { InputHTMLAttributes } from "react";

import * as intake from "@moss/ui/intake";
import * as language from "@moss/ui/language";
import * as grouping from "@moss/ui/grouping";
import * as modeSelector from "@moss/ui/mode-selector";
import * as settingsMod from "@moss/ui/settings";
import * as review from "@moss/ui/review";
import * as preflight from "@moss/ui/preflight";
import * as baseCode from "@moss/ui/base-code";

import { sendShellMessage } from "../shell-client";
import type { PersistedState } from "../state-types";

const STAGES = [
  "Select",
  "Group",
  "Configure",
  "Review",
  "Paywall",
  "Progress",
  "Result",
] as const;

type ComparisonMode = "pair" | "batch";

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

export function WorkflowApp() {
  const capsPayload = useMemo(
    () => language.normalizeCapabilities(language.createMossCapabilitiesFixture()).capabilities,
    [],
  );
  const [persisted, setPersisted] = useState<PersistedState | null>(null);
  const [note, setNote] = useState("Loading recoverable state…");
  const [stageIndex, setStageIndex] = useState(0);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("pair");
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
  const [entitled, setEntitled] = useState(false);
  const [warningsAck, setWarningsAck] = useState(false);
  const [gateMessage, setGateMessage] = useState(
    "Local preview is free through Review. Upload requires purchase and both consents.",
  );
  const [modeHint, setModeHint] = useState(
    "Pair Check compares exactly two logical submissions before you can continue.",
  );

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
    [comparisonMode, languageCode, languageConfirmed, groups, baseItems, settings],
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
    () => review.buildReviewSummary(draftSnapshot, { retentionHours: 24 }),
    [draftSnapshot],
  );

  const rebuildGroups = useCallback(
    (items: LocalItem[], mode: ComparisonMode) => {
      const accepted = items.filter((item) => item.status === "accepted" || item.status === "base");
      const nextGroups = grouping.suggestGroups(accepted, { mode });
      setGroups(nextGroups);
      return nextGroups;
    },
    [],
  );

  const resetConsent = useCallback(() => {
    setOwnership(false);
    setSensitiveLink(false);
    setWarningsAck(false);
  }, []);

  const refresh = useCallback(async () => {
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
      setStageIndex(5);
    } else if (next?.draft) {
      setNote(`Recovered draft ${next.draft.draftId} (${next.draft.mode}). Reselect files after restart.`);
      setComparisonMode(next.draft.mode === "batch" ? "batch" : "pair");
      if (next.draft.language) {
        setLanguageCode(String(next.draft.language));
        setLanguageConfirmed(false);
      }
      setStageIndex(0);
    } else {
      setNote("No draft or active job on this device.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const persistDraftShell = useCallback(async () => {
    await sendShellMessage("state/save-draft", {
      draftId: crypto.randomUUID(),
      mode: comparisonMode,
      language: languageCode || "python",
      groupCount: Math.max(groups.length, comparisonMode === "pair" ? 2 : 2),
      flags: { includeBaseCode: baseItems.length > 0 },
    });
    await refresh();
  }, [refresh, comparisonMode, languageCode, groups.length, baseItems.length]);

  const discard = useCallback(async () => {
    await sendShellMessage("state/discard-draft");
    setStageIndex(0);
    setSourceItems([]);
    setBaseItems([]);
    setGroups([]);
    setLanguageCode("");
    setLanguageConfirmed(false);
    setSettings(createInitialSettings());
    setProviderIdInput("");
    setProviderIdMasked("");
    setProviderIdError("");
    resetConsent();
    await refresh();
  }, [refresh, resetConsent]);

  const onModeChange = (next: ComparisonMode) => {
    const switched = modeSelector.selectMode(
      { mode: comparisonMode, groups, language: languageCode || null, languageConfirmed, baseFiles: baseItems, settings },
      next,
      { confirm: true },
    );
    setComparisonMode(next);
    setModeHint(
      next === "pair"
        ? "Pair Check compares exactly two logical submissions before you can continue."
        : "Batch Check needs at least two logical submissions; folders and approved archives are supported.",
    );
    if (switched.ok && switched.draft?.groups) {
      setGroups(switched.draft.groups);
    } else {
      rebuildGroups(sourceItems, next);
    }
    resetConsent();
    setStageIndex(0);
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
    const result = intake.ingestSelection(files, {
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
    const nextSources = [...sourceItems, ...accepted];
    setSourceItems(nextSources);
    const nextGroups = rebuildGroups(nextSources, comparisonMode);
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
      `Added ${accepted.length} local file(s). Group preview has ${nextGroups.length} submission(s). Nothing uploaded.`,
    );
    resetConsent();
    setStageIndex(Math.max(stageIndex, 1));
  };

  const removeSource = (index: number) => {
    const next = sourceItems.filter((_, i) => i !== index);
    setSourceItems(next);
    rebuildGroups(next, comparisonMode);
    resetConsent();
  };

  const onBaseFiles = (files: File[]) => {
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

  const goReview = () => {
    if (!languageCode || !languageConfirmed) {
      setGateMessage("Confirm a language from capabilities before Review.");
      setStageIndex(2);
      return;
    }
    if (!preflightResult.canProceed && preflightResult.errors.length > 0) {
      setGateMessage("Resolve blocking preflight findings before Review.");
      setStageIndex(2);
      return;
    }
    if (preflightResult.warnings.length && !warningsAck) {
      setGateMessage("Acknowledge preflight warnings before Review.");
      setStageIndex(2);
      return;
    }
    setStageIndex(3);
    setGateMessage("Review the groups. Payment appears only after both consents. Review → Paywall.");
  };

  const tryPaywall = () => {
    if (!ownership || !sensitiveLink) {
      setGateMessage("Paywall blocked — grant both consents on Review first.");
      return;
    }
    setStageIndex(4);
    setGateMessage("Paywall — files have not been uploaded yet.");
  };

  const tryStartJob = () => {
    if (!entitled) {
      setGateMessage("Entitlement required before upload/job creation.");
      return;
    }
    if (!ownership || !sensitiveLink) {
      setGateMessage("Consents required before upload.");
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
    setStageIndex(5);
    setGateMessage("Job started locally in the progress phase. No fabricated percent is shown.");
  };

  const primaryAction = () => {
    if (stageIndex < 3) {
      goReview();
      return;
    }
    if (stageIndex === 3) {
      tryPaywall();
      return;
    }
    if (stageIndex === 4) {
      tryStartJob();
      return;
    }
  };

  const primaryLabel =
    stageIndex < 3 ? "Continue to Review" : stageIndex === 3 ? "Open paywall" : stageIndex === 4 ? "Start job" : "Working…";

  return (
    <div className="shell shell--sidepanel">
      <header className="sidepanel-header" role="banner">
        <div className="row">
          <h1>Code Similarity</h1>
          <span className="badge" role="status">
            {entitled ? "Entitled" : "Local preview"}
          </span>
        </div>
        <p className="status" role="status">
          {note}
        </p>
      </header>

      <nav className="rail rail--compact" aria-label="Workspace steps" role="navigation">
        {STAGES.map((step, index) => (
          <span key={step} aria-current={index === stageIndex ? "step" : undefined}>
            {step}
          </span>
        ))}
      </nav>

      <main className="sidepanel-main" role="main">
        <section className="card" aria-labelledby="mode-heading">
          <div className="row section-head">
            <h2 id="mode-heading">Comparison mode</h2>
            <InfoTip label="About comparison modes">
              Pair Check needs exactly two logical submissions. Batch Check needs two or more and supports folders and approved archives.
            </InfoTip>
          </div>
          <div className="segmented" role="radiogroup" aria-labelledby="mode-heading">
            <label className={comparisonMode === "pair" ? "segmented__option is-active" : "segmented__option"}>
              <input
                type="radio"
                name="comparison-mode"
                value="pair"
                checked={comparisonMode === "pair"}
                onChange={() => onModeChange("pair")}
              />
              Pair Check
            </label>
            <label className={comparisonMode === "batch" ? "segmented__option is-active" : "segmented__option"}>
              <input
                type="radio"
                name="comparison-mode"
                value="batch"
                checked={comparisonMode === "batch"}
                onChange={() => onModeChange("batch")}
              />
              Batch Check
            </label>
          </div>
          <p className="status" role="status">
            {modeHint}
          </p>
        </section>

        <section className="card" aria-labelledby="language-heading">
          <div className="row section-head">
            <h2 id="language-heading">Language</h2>
            <InfoTip label="About language selection">
              Available languages come from server capabilities. Extension-based suggestions stay unconfirmed until you accept them.
            </InfoTip>
          </div>
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
            <span className="type-label">Programming language</span>
            <select
              id="workspace-language"
              aria-label="Programming language"
              value={languageCode}
              onChange={(event) => applyLanguage(event.target.value)}
            >
              <option value="">Select a language…</option>
              {languageOptions.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </label>
          <div className="row">
            <p className="status" role="status">
              {languageHint}
            </p>
            <button
              type="button"
              className="secondary"
              disabled={!languageCode || languageConfirmed}
              onClick={() => applyLanguage(languageCode, { confirm: true })}
            >
              Confirm language
            </button>
          </div>
        </section>

        <section className="card" aria-labelledby="intake-heading">
          <h2 id="intake-heading">Source files</h2>
          <div className="intake-dropzone" role="region" aria-label="File drop zone" data-local-only="true">
            <p>Drop files, folders, or approved archives. Selections stay local-only until review and consent.</p>
            <div className="row wrap">
              <label className="file-button">
                Browse files
                <input
                  type="file"
                  multiple
                  aria-label="Browse files"
                  onChange={(event) => {
                    onSourceFiles(fileListFromInput(event));
                    event.target.value = "";
                  }}
                />
              </label>
              <label className="file-button">
                Browse folder
                <input
                  type="file"
                  {...({ webkitdirectory: "" } as InputHTMLAttributes<HTMLInputElement>)}
                  aria-label="Browse folder"
                  onChange={(event) => {
                    onSourceFiles(fileListFromInput(event));
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
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
        </section>

        <section className="card" aria-labelledby="base-heading">
          <div className="row section-head">
            <h2 id="base-heading">Base code</h2>
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
        </section>

        <section className="card" aria-labelledby="grouping-heading">
          <h2 id="grouping-heading">Group preview</h2>
          <div className="grouping-preview" role="region" aria-label="Comparison preview" data-mode={comparisonMode}>
            {groups.length === 0 ? (
              <p>
                {comparisonMode === "pair"
                  ? "Pair Check preview: exactly two logical submissions required."
                  : "Batch Check preview: at least two logical submissions required."}
              </p>
            ) : (
              <ul>
                {groups.map((group: any) => (
                  <li key={group.id}>
                    <strong>{group.label}</strong> — {(group.files || []).length} file(s)
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="status">
            Directory mode: <strong>{directoryMode}</strong> (derived from grouping — not a protocol toggle).
          </p>
        </section>

        <section className="card settings-panel" aria-labelledby="settings-heading">
          <button
            type="button"
            className="disclosure"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((value) => !value)}
          >
            <h2 id="settings-heading">Advanced options</h2>
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
                  aria-describedby="file-restrict-help"
                />
              </label>
              <p id="file-restrict-help" className="status">
                Validated extension allowlist. Leave empty to keep intake defaults.
              </p>
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
                {entitled
                  ? providerIdMasked
                    ? `Masked on device: ${providerIdMasked}`
                    : "Enter the numeric ID, then leave the field to mask it."
                  : "Available after purchase / entitlement."}
              </p>
              {providerIdError ? (
                <p className="status status--danger" role="alert">
                  {providerIdError}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="card" aria-labelledby="preflight-heading">
          <h2 id="preflight-heading">Preflight</h2>
          <div className="preflight" role="region" aria-label="Preflight findings">
            {preflightResult.errors.length === 0 && preflightResult.warnings.length === 0 ? (
              <p>Blocking and warning findings appear here before upload.</p>
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

        <section className="card" aria-labelledby="recoverable">
          <h2 id="recoverable">Recoverable state</h2>
          <p className="status">{note}</p>
          {persisted?.activeJob ? (
            <ol>
              <li>Job id: {persisted.activeJob.jobId}</li>
              <li>Status: {persisted.activeJob.status}</li>
              <li>Idempotency key: {persisted.activeJob.submissionIdempotencyKey}</li>
            </ol>
          ) : null}
          {persisted?.draft ? (
            <ol>
              <li>Draft id: {persisted.draft.draftId}</li>
              <li>
                Mode: {persisted.draft.mode}, groups: {persisted.draft.groupCount}, language:{" "}
                {persisted.draft.language}
              </li>
            </ol>
          ) : null}
        </section>

        <section className="card" aria-labelledby="review-gate">
          <h2 id="review-gate">Review consents</h2>
          <p className="status">{gateMessage}</p>
          <div className="review-summary" aria-label="Review summary">
            <p>
              {reviewSummary.mode} · {reviewSummary.language || "language unset"} ·{" "}
              {reviewSummary.groups?.length || 0} groups · {reviewSummary.totalBytes || 0} bytes
            </p>
          </div>
          <label className="row">
            <input
              type="checkbox"
              checked={ownership}
              onChange={(event) => setOwnership(event.target.checked)}
            />
            <span>I confirm I have the right to submit these files.</span>
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={sensitiveLink}
              onChange={(event) => setSensitiveLink(event.target.checked)}
            />
            <span>I understand the report link is sensitive like a password.</span>
          </label>
          <div className="row wrap" style={{ marginTop: 12 }}>
            <button type="button" className="secondary" onClick={goReview}>
              Go to Review
            </button>
            <button type="button" className="secondary" onClick={tryPaywall}>
              Open paywall
            </button>
            <button type="button" className="secondary" onClick={() => setEntitled(true)}>
              Simulate purchase
            </button>
            <button type="button" onClick={tryStartJob}>
              Start job
            </button>
            <button type="button" className="secondary" disabled>
              Confirm and continue
            </button>
          </div>
          <p className="status">
            Upload transfer starts only after entitlement and recorded consent. Progress reports completed objects
            only — no fabricated percent. Restart requires file reselection unless upload already completed.
          </p>
          <p className="status">
            Server intake, fair queues, and provider submission run in the API workers with the mock loopback adapter
            in tests — the extension never opens raw provider TCP.
          </p>
        </section>

        <section className="card" aria-labelledby="demo-controls">
          <h2 id="demo-controls">Local draft controls</h2>
          <p>Demo only — no titles, paths, hashes, or source are persisted.</p>
          <div className="row wrap" style={{ marginTop: 12 }}>
            <button type="button" onClick={() => void persistDraftShell()}>
              Save demo draft
            </button>
            <button type="button" className="secondary" onClick={() => void discard()}>
              Discard draft
            </button>
            <button type="button" className="secondary" onClick={() => void refresh()}>
              Reload state
            </button>
          </div>
        </section>
      </main>

      <footer role="contentinfo" className="sidepanel-footer sticky-cta">
        <button type="button" onClick={primaryAction} disabled={stageIndex >= 5}>
          {primaryLabel}
        </button>
        <button type="button" className="secondary" onClick={() => void discard()}>
          Discard draft
        </button>
      </footer>
    </div>
  );
}
