import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import { browser } from "wxt/browser";

import * as intake from "@moss/ui/intake";
import * as language from "@moss/ui/language";
import * as grouping from "@moss/ui/grouping";
import * as settingsMod from "@moss/ui/settings";
import * as mossId from "@moss/ui/moss-id";
import * as review from "@moss/ui/review";
import * as preflight from "@moss/ui/preflight";
import * as baseCode from "@moss/ui/base-code";
import * as runLifecycle from "@moss/ui/run-lifecycle";
import * as resultUx from "@moss/ui/result-experience";
import type { RunState } from "@moss/ui/run-lifecycle";

import { sendShellMessage } from "../shell-client";
import type { PersistedState } from "../state-types";
import {
  DEMO_LOGIN,
  OFFER,
  clearDemoAccount,
  clearDemoMossCredential,
  consumeDemoRun,
  createDemoAccount,
  deobfuscateMossUserId,
  isEntitled,
  isMossConnected,
  loadDemoAccount,
  loadDemoEntitlement,
  loadDemoMossCredential,
  purchaseDemoEntitlement,
  releaseDemoRun,
  saveDemoMossCredential,
  signInDemoAccount,
  type DemoAccount,
  type DemoEntitlement,
  type DemoMossCredential,
} from "../entitlement-demo";
import * as apiClient from "../api-client";
import {
  clearResultHistory,
  forgetHistoryEntry,
  loadResultHistory,
  rememberResult,
  type ResultHistoryEntry,
} from "../result-history";

type Gate = "loading" | "auth" | "paywall" | "moss-id" | "portal";
type AuthMode = "signin" | "create";
type MossIdStep = "register" | "enter-id";

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

/** Phase rail shown while a run is in flight — labels only, never a synthetic percentage. */
const RUN_STEPS: ReadonlyArray<{ phase: string; label: string }> = [
  { phase: "validate", label: "Check files" },
  { phase: "upload", label: "Upload" },
  { phase: "queue", label: "Queue" },
  { phase: "submit", label: "Submit" },
  { phase: "wait", label: "Wait for report" },
];

function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState<string>(DEMO_LOGIN.email);
  const [password, setPassword] = useState("");
  const [account, setAccount] = useState<DemoAccount | null>(null);
  const [entitlement, setEntitlement] = useState<DemoEntitlement | null>(null);
  const [mossCredential, setMossCredential] = useState<DemoMossCredential | null>(null);
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
  /** Browser File handles kept only in memory for upload — never persisted. */
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [baseItems, setBaseItems] = useState<LocalItem[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [settings, setSettings] = useState<DraftSettings>(createInitialSettings);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [providerIdInput, setProviderIdInput] = useState("");
  const [providerIdMasked, setProviderIdMasked] = useState("");
  const [providerIdError, setProviderIdError] = useState("");
  const [mossRegEmail, setMossRegEmail] = useState("");
  const [mossAck, setMossAck] = useState(false);
  const [mossIdStep, setMossIdStep] = useState<MossIdStep>("register");
  const [mossIdError, setMossIdError] = useState("");
  const [settingError, setSettingError] = useState("");
  const [ownership, setOwnership] = useState(false);
  const [sensitiveLink, setSensitiveLink] = useState(false);
  const [warningsAck, setWarningsAck] = useState(false);
  const [gateMessage, setGateMessage] = useState(
    "Sign in and purchase before files leave this device.",
  );
  const [run, setRun] = useState<RunState | null>(null);
  const [reportUrl, setReportUrl] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [linkForgotten, setLinkForgotten] = useState(false);
  /** When the hosted API is unreachable, user may opt into the offline demo path. */
  const [allowOfflineDemo, setAllowOfflineDemo] = useState(false);
  const [apiMeta, setApiMeta] = useState<{ submitMode?: string; livePublicTcp?: boolean } | null>(
    null,
  );
  const [resultHistory, setResultHistory] = useState<ResultHistoryEntry[]>([]);
  const syncedRunRef = useRef("");
  const pollInFlightRef = useRef(false);
  const rememberedJobsRef = useRef<Set<string>>(new Set());

  const comparisonMode = "pair" as const;
  const runPhase = run?.phase ?? null;
  const runTerminal = runPhase ? runLifecycle.isTerminalPhase(runPhase) : false;
  const progressPhase = Boolean(run) && !runTerminal;
  const runView = run ? runLifecycle.describeRun(run, { reportUrl: reportUrl || null }) : null;
  const entitled = isEntitled(entitlement);
  const mossConnected = isMossConnected(mossCredential);
  const runsLeft = entitlement?.remaining ?? 0;
  const registrationHelp = useMemo(
    () => mossId.buildRegistrationInstructions(mossRegEmail || account?.email || ""),
    [mossRegEmail, account?.email],
  );
  const canEnterId = mossId.canEnterMossUserId({
    email: mossRegEmail || account?.email || "",
    acknowledged: mossAck,
  });

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

  const resultView = useMemo(() => {
    if (!run || run.phase !== "success") return null;
    return resultUx.buildResultExperience({
      completedAt: new Date(run.updatedAt).toISOString(),
      language: run.language,
      mode: run.comparison,
      reportUrl: linkForgotten ? null : reportUrl || null,
      urlForgotten: linkForgotten,
    });
  }, [run, reportUrl, linkForgotten]);

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

  const resolveGate = useCallback(
    (
      nextAccount: DemoAccount | null,
      nextEntitlement: DemoEntitlement | null,
      nextMoss: DemoMossCredential | null,
    ) => {
      const next = mossId.resolveOnboardingGate({
        account: nextAccount,
        entitled: isEntitled(nextEntitlement),
        mossConnected: isMossConnected(nextMoss),
      });
      setGate(next);
    },
    [],
  );

  const refreshSession = useCallback(async () => {
    const [nextAccount, nextEntitlement, nextMoss, nextHistory] = await Promise.all([
      loadDemoAccount(),
      loadDemoEntitlement(),
      loadDemoMossCredential(),
      loadResultHistory(),
    ]);
    setAccount(nextAccount);
    setEntitlement(nextEntitlement);
    setMossCredential(nextMoss);
    setResultHistory(nextHistory);
    if (nextMoss?.display) {
      setProviderIdMasked(nextMoss.display);
    }
    if (nextMoss?.registrationEmail) {
      setMossRegEmail(nextMoss.registrationEmail);
    } else if (nextAccount?.email) {
      setMossRegEmail(nextAccount.email);
    }
    resolveGate(nextAccount, nextEntitlement, nextMoss);
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
      // A closed popup stops the local ticker, so recovery re-applies the deadline instead of
      // resuming a spinner that can never end.
      const isLiveJob = String(next.activeJob.jobId || "").startsWith("job_");
      const recoverOpts: { now?: number; deadlineMs?: number; mode?: string } = {
        now: Date.now(),
        mode: isLiveJob ? "live" : "demo",
      };
      if (isLiveJob) recoverOpts.deadlineMs = 180_000;
      const recovered = runLifecycle.recoverRunState(next.activeJob, recoverOpts);
      if (recovered.ok && recovered.state) {
        setRun(recovered.state);
        setNote(
          recovered.deadlineExceeded
            ? `Run ${next.activeJob.jobId} made no progress before its deadline. It is now closed as unresolved.`
            : `Recovered run ${next.activeJob.jobId} (${next.activeJob.status}).`,
        );
      } else {
        setNote(`Recovered active job ${next.activeJob.jobId} (${next.activeJob.status}).`);
      }
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

  const stepDemoRun = useCallback(() => {
    setRun((current) => {
      if (!current || current.mode !== "demo" || runLifecycle.isTerminalPhase(current.phase)) {
        return current;
      }
      const advanced = runLifecycle.advanceRunState(current, { now: Date.now() });
      if (!advanced.ok) {
        return { ...current, phase: "failure", failureCode: "worker", updatedAt: Date.now() };
      }
      return advanced.state;
    });
  }, []);

  const pollLiveRun = useCallback(async () => {
    if (pollInFlightRef.current) return;
    const current = run;
    if (!current || current.mode !== "live" || !current.jobId || !account?.email) return;
    if (runLifecycle.isTerminalPhase(current.phase)) return;

    const now = Date.now();
    if (now >= current.deadlineAt) {
      setRun((prev) => {
        if (!prev || prev.mode !== "live") return prev;
        const expired = runLifecycle.advanceRunState(prev, { now, event: "fail", failureCode: "uncertain-query" });
        // Prefer deadline expire path when still non-terminal.
        if (now >= prev.deadlineAt) {
          return {
            ...prev,
            phase: "timeout",
            failureCode: prev.submitted ? "uncertain-query" : "provider",
            updatedAt: now,
          };
        }
        return expired.ok ? expired.state : prev;
      });
      return;
    }

    pollInFlightRef.current = true;
    try {
      const status = await apiClient.getJobStatus({
        ownerUserId: account.email,
        jobId: current.jobId,
      });
      if (!status.ok) {
        // Keep waiting; network blips should not invent failure before the deadline.
        return;
      }
      const job = status.data["job"] as
        | {
            status?: string;
            reportUrlRef?: string;
            failureCode?: string;
            submitted?: boolean;
          }
        | undefined;
      const nextPhase = apiClient.phaseFromJobStatus(job?.status);
      if (!nextPhase) return;

      setRun((prev) => {
        if (!prev || prev.mode !== "live" || prev.jobId !== current.jobId) return prev;
        if (runLifecycle.isTerminalPhase(prev.phase)) return prev;
        return {
          ...prev,
          phase: nextPhase as RunState["phase"],
          updatedAt: Date.now(),
          submitted: Boolean(prev.submitted || job?.submitted || nextPhase === "wait" || nextPhase === "success"),
          resultRef: job?.reportUrlRef || prev.resultRef,
          failureCode: job?.failureCode || prev.failureCode,
        };
      });

      if (nextPhase === "success" && job?.reportUrlRef) {
        const revealed = await apiClient.revealJobResult({
          ownerUserId: account.email,
          jobId: current.jobId,
        });
        if (revealed.ok && typeof revealed.data["reportUrl"] === "string") {
          setReportUrl(String(revealed.data["reportUrl"]));
        }
      }
    } finally {
      pollInFlightRef.current = false;
    }
  }, [run, account?.email]);

  // Drive the run forward: demo ticks locally; live polls the loopback API. Deadline always wins.
  useEffect(() => {
    if (!run || runLifecycle.isTerminalPhase(run.phase)) return undefined;
    if (run.mode === "live") {
      const tick = window.setTimeout(() => void pollLiveRun(), 900);
      const deadline = window.setTimeout(() => void pollLiveRun(), runLifecycle.remainingMs(run, Date.now()) + 50);
      return () => {
        window.clearTimeout(tick);
        window.clearTimeout(deadline);
      };
    }
    const tick = window.setTimeout(stepDemoRun, runLifecycle.DEMO_STEP_MS);
    const deadline = window.setTimeout(stepDemoRun, runLifecycle.remainingMs(run, Date.now()) + 50);
    return () => {
      window.clearTimeout(tick);
      window.clearTimeout(deadline);
    };
  }, [run, stepDemoRun, pollLiveRun]);

  // Persist each phase, publish the result link, and refund a run only when nothing was submitted.
  useEffect(() => {
    if (!run || !run.jobId) return;
    const key = `${run.jobId}:${run.phase}`;
    if (syncedRunRef.current === key) return;
    syncedRunRef.current = key;
    void (async () => {
      const payload: Record<string, unknown> = {
        jobId: run.jobId,
        status: runLifecycle.jobStatusForRun(run),
      };
      if (run.phase === "success" && run.resultRef) {
        payload["reportUrlRef"] = run.resultRef;
      }
      const saved = await sendShellMessage("state/update-job", payload);
      if (!saved.ok) {
        setNote("Run status could not be saved locally. The run still resolves in this window.");
      }
      if (run.phase === "success" && run.resultRef && run.mode === "demo") {
        setReportUrl(browser.runtime.getURL(runLifecycle.demoReportPath(run.resultRef)));
      }
      if (runLifecycle.shouldReleaseRunCredit(run)) {
        const released = await releaseDemoRun(run.jobId ?? "");
        if (released.ok) {
          setEntitlement(released.entitlement);
        }
      }
    })();
  }, [run]);

  // Persist successful report links into local past-results history (device-only, never sync).
  useEffect(() => {
    if (!run || run.phase !== "success" || !run.jobId || !reportUrl) return;
    if (rememberedJobsRef.current.has(run.jobId)) return;
    rememberedJobsRef.current.add(run.jobId);
    void (async () => {
      const saved = await rememberResult({
        jobId: run.jobId!,
        reportUrl,
        language: run.language,
        label: settings.reportLabel || "Pair Check",
        mode: run.mode === "live" ? "live" : "demo",
      });
      if (saved.ok) setResultHistory(saved.entries);
    })();
  }, [run, reportUrl, settings.reportLabel]);

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

  /** Close out the current run locally so the next Start is not blocked by a bound job. */
  const clearRun = useCallback(async () => {
    if (run && !runLifecycle.isTerminalPhase(run.phase)) {
      await sendShellMessage("state/update-job", { jobId: run.jobId, status: "cancelled" });
    }
    syncedRunRef.current = "";
    setRun(null);
    setReportUrl("");
    setLinkNote("");
    setLinkForgotten(false);
  }, [run]);

  const discard = useCallback(async () => {
    await sendShellMessage("state/discard-draft");
    setSourceItems([]);
    setSourceFiles([]);
    setBaseItems([]);
    setGroups([]);
    setLanguageCode("");
    setLanguageConfirmed(false);
    setSettings(createInitialSettings());
    setProviderIdInput("");
    setProviderIdError("");
    await clearRun();
    resetConsent();
    await refreshState();
  }, [clearRun, refreshState, resetConsent]);

  const onAuthSubmit = async () => {
    setAuthError("");
    const saved =
      authMode === "create"
        ? await createDemoAccount(email, password)
        : await signInDemoAccount(email, password);
    if (!saved.ok) {
      setAuthError(saved.error);
      return;
    }
    setAccount(saved.account);
    setPassword("");
    setMossRegEmail(saved.account.email);
    const [nextEntitlement, nextMoss] = await Promise.all([
      loadDemoEntitlement(),
      loadDemoMossCredential(),
    ]);
    setEntitlement(nextEntitlement);
    setMossCredential(nextMoss);
    if (nextMoss?.display) setProviderIdMasked(nextMoss.display);
    resolveGate(saved.account, nextEntitlement, nextMoss);
    const nextGate = mossId.resolveOnboardingGate({
      account: saved.account,
      entitled: isEntitled(nextEntitlement),
      mossConnected: isMossConnected(nextMoss),
    });
    setGateMessage(
      nextGate === "portal"
        ? "Account ready. Pair Check is unlocked."
        : nextGate === "moss-id"
          ? "Purchase complete path: connect your Moss User ID before Pair Check."
          : "Account ready. Purchase unlocks 15 Pair Check runs.",
    );
  };

  const onPurchase = async () => {
    const next = await purchaseDemoEntitlement();
    setEntitlement(next);
    setMossIdStep("register");
    setMossAck(false);
    setMossIdError("");
    if (!mossRegEmail && account?.email) setMossRegEmail(account.email);
    setGate("moss-id");
    setGateMessage(
      `Demo entitlement active — ${next.remaining} of ${next.total} runs. Connect your Moss User ID next. Files are not uploaded yet.`,
    );
  };

  const onSaveMossUserId = async () => {
    setMossIdError("");
    if (!canEnterId) {
      setMossIdError("Acknowledge that you emailed Moss (or already have an ID) before continuing.");
      return;
    }
    const regEmail = (mossRegEmail || account?.email || "").trim();
    const saved = await saveDemoMossCredential(providerIdInput, regEmail);
    if (!saved.ok) {
      setMossIdError(saved.error);
      setProviderIdError(saved.error);
      return;
    }
    setMossCredential(saved.credential);
    setProviderIdMasked(saved.credential.display);
    setProviderIdInput("");
    setProviderIdError("");
    setGate("portal");
    setGateMessage(
      `Moss User ID connected (${saved.credential.display}). Pair Check is ready — ${runsLeft || entitlement?.remaining || OFFER.runs} runs available.`,
    );
  };

  const onDisconnectMossId = async () => {
    await clearDemoMossCredential();
    setMossCredential(null);
    setProviderIdInput("");
    setProviderIdMasked("");
    setProviderIdError("");
    setMossAck(false);
    setMossIdStep("register");
    setGate("moss-id");
    setGateMessage("Connect Moss ID to unlock the comparison portal.");
  };

  const onSignOut = async () => {
    await clearDemoAccount();
    setAccount(null);
    setEntitlement(null);
    setMossCredential(null);
    setProviderIdMasked("");
    setMossAck(false);
    setMossIdStep("register");
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
    if (!mossConnected) {
      setNote("Connect Moss ID before selecting files.");
      setGate("moss-id");
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
    const matchedFiles: File[] = [];
    for (const item of accepted) {
      const byKey = capped.find((entry) => {
        const displayName = String(entry.name || "")
          .replace(/[<>:"|?*\u0000-\u001f]/g, "_")
          .replace(/\\/g, "/")
          .split("/")
          .pop()
          ?.slice(0, 180);
        return `${displayName}::${entry.size}` === item.key;
      });
      if (byKey) matchedFiles.push(byKey);
    }
    setSourceItems(nextSources);
    setSourceFiles((prev) => [...prev, ...matchedFiles].slice(0, OFFER.maxFilesPerRun));
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
    setSourceFiles((prev) => prev.filter((_, i) => i !== index));
    rebuildGroups(next);
    resetConsent();
  };

  const onBaseFiles = (files: File[]) => {
    if (!entitled || !mossConnected) return;
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
    const masked = mossId.maskMossUserId(providerIdInput);
    if (!masked.ok) {
      setProviderIdError(masked.error || "Invalid Moss User ID");
      return;
    }
    // Keep raw digits only in component memory until saved to local vault — never sync/log.
    setProviderIdInput(masked.digits);
    setProviderIdError("");
  };

  const tryStartJob = async (options: { forceOfflineDemo?: boolean } = {}) => {
    if (!entitled || runsLeft < 1) {
      setGateMessage("Entitlement required before upload/job creation.");
      return;
    }
    if (!mossConnected || !mossCredential) {
      setGateMessage("Connect Moss ID before starting a Pair Check.");
      setGate("moss-id");
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
    if (sourceFiles.length !== OFFER.maxFilesPerRun) {
      setGateMessage("Reselect both files in this session before starting — file bytes are not kept after restart.");
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

    const useOfflineDemo = Boolean(options.forceOfflineDemo || allowOfflineDemo);
    let health: Awaited<ReturnType<typeof apiClient.probeApi>> = {
      ok: false,
      origin: apiClient.resolveApiOrigin(),
    };
    if (!useOfflineDemo) {
      health = await apiClient.probeApi();
      if (!health.ok) {
        setGateMessage(
          `Hosted API at ${health.origin} is unreachable. Check that Railway is online (see docs/engineering/deploy-railway.md), then try again — or use offline demo for UI-only testing.`,
        );
        setAllowOfflineDemo(false);
        return;
      }
      const nextMeta: { submitMode?: string; livePublicTcp?: boolean } = {};
      if (health.submitMode !== undefined) nextMeta.submitMode = health.submitMode;
      if (health.livePublicTcp !== undefined) nextMeta.livePublicTcp = health.livePublicTcp;
      setApiMeta(nextMeta);
    }

    const mossUserId = deobfuscateMossUserId(mossCredential.localCipher);
    if (!useOfflineDemo && (!mossUserId || !/^[0-9]{3,}$/.test(mossUserId))) {
      setGateMessage("Saved Moss User ID could not be unlocked. Reconnect Moss ID, then try again.");
      setGate("moss-id");
      return;
    }

    const consumed = await consumeDemoRun();
    if (!consumed.ok) {
      setGateMessage(consumed.error);
      return;
    }
    setEntitlement(consumed.entitlement);

    const jobId = useOfflineDemo ? `job-${crypto.randomUUID()}` : "";
    const idempotencyKey = `idem-${crypto.randomUUID()}`;

    if (useOfflineDemo) {
      const bound = await sendShellMessage("state/bind-job", {
        jobId,
        status: "ready",
        mode: comparisonMode,
        language: languageCode,
        submissionIdempotencyKey: idempotencyKey,
      });
      if (!bound.ok) {
        const released = await releaseDemoRun(jobId);
        if (released.ok) setEntitlement(released.entitlement);
        setGateMessage(
          bound.error === "active-job-exists"
            ? "An earlier run is still unresolved. Close it below, then start again — your run was not used."
            : "The background worker did not accept the run. Your run was not used; try again.",
        );
        await refreshState();
        return;
      }
      syncedRunRef.current = "";
      setReportUrl("");
      setLinkNote("");
      setLinkForgotten(false);
      setRun(
        runLifecycle.createRunState({
          now: Date.now(),
          jobId,
          language: languageCode,
          comparison: comparisonMode,
          mode: "demo",
        }),
      );
      setGateMessage(
        `Offline demo started. ${consumed.entitlement.remaining} of ${consumed.entitlement.total} runs remaining. No files leave this device.`,
      );
      await refreshState();
      return;
    }

    // Live / mock API path
    setRun(
      runLifecycle.createRunState({
        now: Date.now(),
        jobId: "pending",
        language: languageCode,
        comparison: comparisonMode,
        mode: "live",
        deadlineMs: 180_000,
      }),
    );
    setReportUrl("");
    setLinkNote("");
    setLinkForgotten(false);
    syncedRunRef.current = "";

    const ownerUserId = account?.email || "local-owner";
    const created = await apiClient.createPairJob({
      ownerUserId,
      language: languageCode,
      idempotencyKey,
      settings: {
        commonMatchThreshold: settings.commonMatchThreshold,
        resultCount: settings.resultCount,
        reportLabel: settings.reportLabel || "pair-check",
      },
    });
    if (!created.ok) {
      const released = await releaseDemoRun(`failed-create-${Date.now()}`);
      if (released.ok) setEntitlement(released.entitlement);
      setRun(null);
      setGateMessage("Could not create a job on the hosted API. Your run was not used.");
      return;
    }
    const apiJob = created.data["job"] as { jobId?: string } | undefined;
    const remoteJobId = String(apiJob?.jobId || "");
    if (!remoteJobId) {
      const released = await releaseDemoRun(`failed-create-${Date.now()}`);
      if (released.ok) setEntitlement(released.entitlement);
      setRun(null);
      setGateMessage("Hosted API returned no job id. Your run was not used.");
      return;
    }

    const bound = await sendShellMessage("state/bind-job", {
      jobId: remoteJobId,
      status: "uploading",
      mode: comparisonMode,
      language: languageCode,
      submissionIdempotencyKey: idempotencyKey,
    });
    if (!bound.ok) {
      const released = await releaseDemoRun(remoteJobId);
      if (released.ok) setEntitlement(released.entitlement);
      setRun(null);
      setGateMessage(
        bound.error === "active-job-exists"
          ? "An earlier run is still unresolved. Close it below, then start again — your run was not used."
          : "The background worker did not accept the run. Your run was not used; try again.",
      );
      await refreshState();
      return;
    }

    setRun((prev) =>
      prev
        ? { ...prev, jobId: remoteJobId, phase: "upload", updatedAt: Date.now() }
        : prev,
    );

    const cred = await apiClient.attachMossCredential({
      ownerUserId,
      jobId: remoteJobId,
      mossUserId: mossUserId!,
    });
    if (!cred.ok) {
      const released = await releaseDemoRun(remoteJobId);
      if (released.ok) setEntitlement(released.entitlement);
      setRun({
        ...runLifecycle.createRunState({
          now: Date.now(),
          jobId: remoteJobId,
          language: languageCode,
          comparison: comparisonMode,
          mode: "live",
        }),
        phase: "failure",
        failureCode: "credential",
      });
      setGateMessage("Moss User ID handoff to the hosted API failed. Your run was released.");
      return;
    }

    const encoded = await Promise.all(
      sourceFiles.map(async (file, index) => ({
        displayName: sourceItems[index]?.displayName || file.name,
        bytesBase64: await apiClient.fileToBase64(file),
      })),
    );
    const uploaded = await apiClient.uploadPairFiles({
      ownerUserId,
      jobId: remoteJobId,
      files: encoded,
    });
    if (!uploaded.ok) {
      const released = await releaseDemoRun(remoteJobId);
      if (released.ok) setEntitlement(released.entitlement);
      setRun((prev) =>
        prev
          ? { ...prev, phase: "failure", failureCode: "upload", updatedAt: Date.now() }
          : prev,
      );
      setGateMessage("Upload to the hosted API failed before MOSS submission. Your run was released.");
      return;
    }

    setRun((prev) => (prev ? { ...prev, phase: "queue", updatedAt: Date.now() } : prev));
    const finalized = await apiClient.finalizeJob({ ownerUserId, jobId: remoteJobId });
    if (!finalized.ok) {
      const released = await releaseDemoRun(remoteJobId);
      if (released.ok) setEntitlement(released.entitlement);
      setRun((prev) =>
        prev
          ? { ...prev, phase: "failure", failureCode: "worker", updatedAt: Date.now() }
          : prev,
      );
      setGateMessage("Finalize failed before MOSS submission. Your run was released.");
      return;
    }

    setRun((prev) =>
      prev
        ? { ...prev, phase: "submit", submitted: true, updatedAt: Date.now() }
        : prev,
    );
    setGateMessage(
      health.livePublicTcp
        ? `Live MOSS submission started with your userid (quota consumed). ${consumed.entitlement.remaining} of ${consumed.entitlement.total} runs remaining.`
        : `Local mock MOSS submission started. ${consumed.entitlement.remaining} of ${consumed.entitlement.total} runs remaining.`,
    );
    await refreshState();
  };

  const cancelRun = async () => {
    if (!run || runLifecycle.isTerminalPhase(run.phase)) return;
    const cancelled = runLifecycle.advanceRunState(run, { now: Date.now(), event: "cancel" });
    if (cancelled.ok) setRun(cancelled.state);
  };

  const startOver = async () => {
    await clearRun();
    await refreshState();
    setGateMessage(
      runsLeft > 0
        ? "Reselect files and start a new Pair Check when you are ready."
        : "No runs remaining for this local entitlement.",
    );
  };

  const onRecoveryAction = async (actionId: string) => {
    if (actionId === "settings") {
      openSettings();
      return;
    }
    if (actionId === "support" || actionId === "history" || actionId === "fix-draft") {
      setLinkNote(
        `Share reference ${run?.jobId ?? "unknown"} with support. No file contents or IDs are included.`,
      );
      return;
    }
    await startOver();
  };

  const copyReportLink = async () => {
    if (!reportUrl) return;
    try {
      await navigator.clipboard.writeText(reportUrl);
      setLinkNote("Link copied. Clipboard history may keep a copy — treat it like a password.");
    } catch {
      setLinkNote("Copy was blocked by the browser. Use the link below manually.");
    }
  };

  const forgetReportLink = () => {
    setLinkForgotten(true);
    setReportUrl("");
    setLinkNote(
      "Link forgotten in this popup. This does not revoke browser history, clipboard copies, or the provider report.",
    );
    if (run?.mode === "live" && run.jobId && account?.email) {
      void apiClient.forgetJobResult({ ownerUserId: account.email, jobId: run.jobId });
    }
  };

  const removeHistoryEntry = async (id: string) => {
    const next = await forgetHistoryEntry(id);
    setResultHistory(next.entries);
    setLinkNote("Removed from past results on this device. The MOSS report itself is unchanged.");
  };

  const clearHistory = async () => {
    await clearResultHistory();
    setResultHistory([]);
    setLinkNote("Cleared past results from this device.");
  };

  const openSettings = () => {
    void browser.runtime.openOptionsPage();
  };

  const statusTitle =
    gate === "auth"
      ? "Account required"
      : gate === "paywall"
        ? "Unlock Pair Check"
        : gate === "moss-id"
          ? "Connect Moss User ID"
          : runView && !runView.isTerminal
            ? runView.title
            : runsLeft < 1
              ? "No runs left"
              : "Ready to compare";

  const statusDetail =
    gate === "auth"
      ? "Create or sign in to continue. Files stay on this device until you purchase and consent."
      : gate === "paywall"
        ? `$${OFFER.priceUsd} unlocks ${OFFER.runs} runs · max ${OFFER.maxFilesPerRun} files each. Nothing is uploaded at checkout.`
        : gate === "moss-id"
          ? "After purchase, register with Moss yourself and paste only the numeric userid. We never send that email for you."
          : runView && !runView.isTerminal
            ? runView.detail
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
                <p className="status">
                  Demo account only — credentials stay on this device. Try{" "}
                  <code>{DEMO_LOGIN.email}</code> / <code>{DEMO_LOGIN.password}</code>.
                </p>
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

          {gate === "moss-id" ? (
            <div className="moss-id-panel">
              <p className="status">
                We never register Moss for you and never ask for your email password. Purchase IDs are
                not authentication.
              </p>
              <label className="stack-field" htmlFor="moss-reg-email">
                <span className="type-label">Email Address :</span>
                <input
                  id="moss-reg-email"
                  type="email"
                  autoComplete="email"
                  value={mossRegEmail}
                  onChange={(event) => {
                    setMossRegEmail(event.target.value);
                    setMossAck(false);
                    setMossIdStep("register");
                  }}
                />
              </label>
              {registrationHelp.ok ? (
                <div className="moss-register-help" aria-live="polite">
                  <p className="status">{registrationHelp.headline}</p>
                  <pre className="moss-register-body">{registrationHelp.body}</pre>
                  <p className="status">
                    Open your own email app and send that exact text to{" "}
                    <strong>{mossId.REGISTRATION_ADDRESS}</strong>. This extension does not send the
                    message.
                  </p>
                </div>
              ) : (
                <p className="status">Enter the email you will use to register with Moss.</p>
              )}
              <label className="row consent-row">
                <input
                  type="checkbox"
                  checked={mossAck}
                  disabled={!registrationHelp.ok}
                  onChange={(event) => {
                    setMossAck(event.target.checked);
                    if (event.target.checked) setMossIdStep("enter-id");
                    else setMossIdStep("register");
                  }}
                />
                <span>I sent the email / I already received my numeric Moss User ID.</span>
              </label>
              {mossIdStep === "enter-id" && canEnterId ? (
                <>
                  <label className="stack-field" htmlFor="moss-user-id">
                    <span className="type-label">Moss User ID</span>
                    <input
                      id="moss-user-id"
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="e.g. 936770554"
                      value={providerIdInput}
                      onChange={(event) => setProviderIdInput(event.target.value)}
                      onBlur={onProviderIdBlur}
                      aria-describedby="moss-user-id-help"
                    />
                  </label>
                  <p id="moss-user-id-help" className="status">
                    Paste only the numeric userid from the Moss reply. It is masked on save and never
                    used as extension login.
                  </p>
                  {mossIdError || providerIdError ? (
                    <p className="status status--danger" role="alert">
                      {mossIdError || providerIdError}
                    </p>
                  ) : null}
                  <button type="button" className="cta" onClick={() => void onSaveMossUserId()}>
                    Save Moss User ID
                  </button>
                </>
              ) : (
                <p className="status">Acknowledge the registration step to enter your Moss User ID.</p>
              )}
              <p className="status">
                <a href={mossId.OFFICIAL_INFO_URL} target="_blank" rel="noreferrer">
                  Official Moss information page
                </a>
              </p>
            </div>
          ) : null}

          {gate === "portal" ? (
            <div className="portal-cta">
              <p className="status status--notice">
                Starting a check uploads your two files to the hosted API and then to MOSS. A live run
                uses your Moss User ID and quota. The result link is sensitive — treat it like a
                password. Reports never auto-open.
              </p>
              {apiMeta?.livePublicTcp ? (
                <p className="status status--danger">
                  API is in live public MOSS mode (cleartext TCP). Production must use the approved
                  encrypted commercial path instead.
                </p>
              ) : null}
              <button
                type="button"
                className="cta"
                disabled={progressPhase || runsLeft < 1 || !mossConnected}
                onClick={() => {
                  setAllowOfflineDemo(false);
                  void tryStartJob();
                }}
              >
                {progressPhase
                  ? "Working…"
                  : !mossConnected
                    ? "Connect Moss ID"
                    : runsLeft < 1
                      ? "No runs left"
                      : "Start Pair Check"}
              </button>
              {gateMessage.includes("Hosted API") && gateMessage.includes("unreachable") ? (
                <button
                  type="button"
                  className="secondary"
                  disabled={progressPhase || runsLeft < 1}
                  onClick={() => {
                    setAllowOfflineDemo(true);
                    void tryStartJob({ forceOfflineDemo: true });
                  }}
                >
                  Run offline demo instead
                </button>
              ) : null}
              <p className="status status-inline">
                <span className="status-dot" aria-hidden="true" />
                {gateMessage}
              </p>
            </div>
          ) : null}
        </section>

        {gate === "portal" && runView && run ? (
          <section className="card run-result" aria-labelledby="run-heading">
            <div className="row section-head">
              <h2 id="run-heading">{runView.title}</h2>
              {runView.isDemo ? (
                <span className="badge badge--info">{runLifecycle.LOCAL_DEMO_LABEL}</span>
              ) : null}
            </div>
            <p className="status" role="status" aria-live="polite">
              {runView.detail}
            </p>

            {!runView.isTerminal ? (
              <>
                <ol className="run-phases" aria-label="Run phases">
                  {RUN_STEPS.map((step) => {
                    const currentIndex = RUN_STEPS.findIndex((item) => item.phase === run.phase);
                    const stepIndex = RUN_STEPS.indexOf(step);
                    const state =
                      stepIndex < currentIndex ? "done" : stepIndex === currentIndex ? "current" : "todo";
                    return (
                      <li
                        key={step.phase}
                        data-state={state}
                        {...(state === "current" ? { "aria-current": "step" as const } : {})}
                      >
                        {step.label}
                      </li>
                    );
                  })}
                </ol>
                <p className="status">
                  No progress percentage is shown because none is known. If nothing changes by{" "}
                  {formatClock(run.deadlineAt)}, this run closes itself as unresolved instead of
                  spinning.
                </p>
                <button type="button" className="secondary" onClick={() => void cancelRun()}>
                  Cancel run
                </button>
              </>
            ) : null}

            {runView.state === "success" && resultView ? (
              <div className="run-result__ready">
                {runView.demoNotice ? (
                  <p className="status status--notice">{runView.demoNotice}</p>
                ) : null}
                {resultView.reportUrl ? (
                  <p className="run-result__link">
                    <a href={resultView.reportUrl} target="_blank" rel="noreferrer noopener">
                      Open similarity report ({runView.resultRef})
                    </a>
                  </p>
                ) : (
                  <p className="status">The link was forgotten in this popup.</p>
                )}
                <div className="row wrap">
                  <button
                    type="button"
                    className="secondary"
                    disabled={resultView.actions["copy"]?.disabled ?? true}
                    onClick={() => void copyReportLink()}
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={resultView.actions["forget"]?.disabled ?? true}
                    onClick={forgetReportLink}
                  >
                    Forget link
                  </button>
                  <button type="button" className="secondary" onClick={() => void startOver()}>
                    Start another run
                  </button>
                </div>
                <ul className="run-result__warnings">
                  {resultView.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {runView.error ? (
              <div className="run-result__error" role="alert">
                <h3>{runView.error.copy.title}</h3>
                <p className="status status--danger">{runView.error.copy.body}</p>
                {runView.error.terminalExplanation ? (
                  <p className="status">{runView.error.terminalExplanation}</p>
                ) : null}
                <p className="status">
                  Reference {runView.error.correlationId ?? run.jobId} ·{" "}
                  {runView.releasesRunCredit
                    ? "Nothing was submitted, so this run was credited back."
                    : "This attempt reached submission, so it still counts against your runs."}
                </p>
                <div className="row wrap">
                  {runView.error.actions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className="secondary"
                      onClick={() => void onRecoveryAction(action.id)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {runView.state === "cancelled" ? (
              <button type="button" className="secondary" onClick={() => void startOver()}>
                Start over
              </button>
            ) : null}

            {linkNote ? <p className="status">{linkNote}</p> : null}
          </section>
        ) : null}

        {gate === "portal" ? (
          <section className="card" aria-labelledby="history-heading">
            <div className="row section-head">
              <h2 id="history-heading">Past results</h2>
              {resultHistory.length > 0 ? (
                <button type="button" className="secondary" onClick={() => void clearHistory()}>
                  Clear all
                </button>
              ) : null}
            </div>
            <p className="status">
              Saved on this device only. Treat each link like a password — anyone with it can open the
              report. Share a link with a student when you want them to review that run.
            </p>
            {resultHistory.length === 0 ? (
              <p className="status">No saved results yet. Successful Pair Checks appear here.</p>
            ) : (
              <ul className="file-list">
                {resultHistory.map((entry) => (
                  <li key={entry.id} className="file-row">
                    <div className="stack-field">
                      <span className="type-label">
                        {entry.label}
                        {entry.language ? ` · ${entry.language}` : ""}
                        {entry.mode === "demo" ? " · demo" : ""}
                      </span>
                      <span className="status">{formatClock(entry.createdAt)}</span>
                      <a href={entry.reportUrl} target="_blank" rel="noreferrer noopener">
                        Open report
                      </a>
                    </div>
                    <div className="row wrap">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          void navigator.clipboard.writeText(entry.reportUrl).then(
                            () => setLinkNote("Past result link copied. Clipboard may keep a copy."),
                            () => setLinkNote("Copy was blocked by the browser."),
                          );
                        }}
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void removeHistoryEntry(entry.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

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
                    BYO Moss User ID is connected after entitlement. It is never authentication for
                    this extension, never written to sync storage or logs, and uses local vault-style
                    storage (masked display + obfuscated cipher only).
                  </p>
                  <p className="status">
                    Connected ID:{" "}
                    <strong>{providerIdMasked || mossCredential?.display || "Not connected"}</strong>
                  </p>
                  <div className="row wrap">
                    <button type="button" className="secondary" onClick={() => void onDisconnectMossId()}>
                      Replace Moss ID
                    </button>
                    <button type="button" className="secondary" onClick={() => void onSignOut()}>
                      Sign out
                    </button>
                  </div>
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
          ) : gate === "moss-id" ? (
            <>Connect Moss ID · BYO</>
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
