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
import { openRunWindow } from "../run-window";
import type { PersistedState } from "../state-types";
import {
  OFFER,
  PLAN_LIST,
  PLANS,
  applyServerEntitlement,
  claimDeviceTrial,
  clearDemoAccount,
  clearDemoMossCredential,
  consumeDemoRun,
  deobfuscateMossUserId,
  isEntitled,
  isMossConnected,
  loadDemoEntitlement,
  loadDemoMossCredential,
  loadDeviceTrialStatus,
  purchaseDemoEntitlement,
  releaseDemoRun,
  saveDemoMossCredential,
  syncLocalStateForAccount,
  type DemoAccount,
  type DemoEntitlement,
  type DemoMossCredential,
  type DeviceTrialStatus,
  type PlanId,
  type ServerEntitlement,
} from "../entitlement-demo";
import {
  clearAuthSession,
  loadAuthSession,
  loginAccount,
  loginWithSocialProvider,
  logoutAccount,
  registerAccount,
  requestPasswordReset,
  resetPassword,
  sessionToAccount,
  verifyAccountOtp,
  type SocialProvider,
} from "../account-session";
import * as apiClient from "../api-client";
import {
  clearResultHistory,
  forgetHistoryEntry,
  loadResultHistory,
  rememberResult,
  type ResultHistoryEntry,
} from "../result-history";
import {
  loadThemePreference,
  nextThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "../theme";
import { checkPassword, isStrongPassword } from "../password-policy";
import { GoogleIcon, MicrosoftIcon } from "../social-icons";

type Gate = "loading" | "auth" | "paywall" | "moss-id" | "portal";
type AuthMode = "signin" | "create";
type MossIdStep = "register" | "enter-id";
/** `popup` is the toolbar panel; `page` is the run window that survives file dialogs. */
export type Surface = "popup" | "page";

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

/** Pair Check always has exactly these two tiles, so they are declared once. */
const PAIR_SLOTS: ReadonlyArray<{ index: number; title: string; ariaLabel: string }> = [
  { index: 0, title: "File 1", ariaLabel: "Choose first file" },
  { index: 1, title: "File 2", ariaLabel: "Choose second file" },
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
      <svg viewBox="0 0 32 32" width="24" height="24" focusable="false">
        <path
          d="m13 8-6 8 6 8M19 8l6 8-6 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m12.5 16.5 2.4 2.4 5-5.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="16"
          cy="16"
          r="13"
          fill="currentColor"
          opacity="0.08"
        />
      </svg>
    </span>
  );
}

export function WorkflowApp({ surface = "popup" }: { surface?: Surface } = {}) {
  const isPopup = surface === "popup";
  const capsPayload = useMemo(
    () => language.normalizeCapabilities(language.createMossCapabilitiesFixture()).capabilities,
    [],
  );
  const [gate, setGate] = useState<Gate>("loading");
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpNonce, setOtpNonce] = useState("");
  const [otpPendingEmail, setOtpPendingEmail] = useState("");
  const [authStep, setAuthStep] = useState<"credentials" | "otp" | "forgot" | "reset">(
    "credentials",
  );
  const [account, setAccount] = useState<DemoAccount | null>(null);
  const [entitlement, setEntitlement] = useState<DemoEntitlement | null>(null);
  const [deviceTrial, setDeviceTrial] = useState<DeviceTrialStatus>({ claimed: false });
  const [mossCredential, setMossCredential] = useState<DemoMossCredential | null>(null);
  const [authError, setAuthError] = useState("");
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [persisted, setPersisted] = useState<PersistedState | null>(null);
  const [note, setNote] = useState("Loading…");
  const [languageCode, setLanguageCode] = useState("");
  const [languageConfirmed, setLanguageConfirmed] = useState(false);
  const [languageHint, setLanguageHint] = useState(
    "Pick the language of these files. Choosing it here is the confirmation.",
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

  const comparisonMode = entitlement?.mode === "batch" ? ("batch" as const) : ("pair" as const);
  const maxFilesPerRun = entitlement?.maxFilesPerRun ?? OFFER.maxFilesPerRun;
  const allowsDirectory = Boolean(entitlement?.allowsDirectory);
  const planLabel =
    entitlement?.planId === "batch"
      ? PLANS.batch.name
      : entitlement?.planId === "trial"
        ? PLANS.trial.name
        : PLANS.pair.name;
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
  const passwordChecks = useMemo(() => checkPassword(password), [password]);
  const createPasswordValid =
    isStrongPassword(password) && confirmPassword.length > 0 && password === confirmPassword;

  const directoryMode = useMemo(
    () => settingsMod.deriveDirectoryMode({ groups }),
    [groups],
  );

  const languageOptions = useMemo(
    () => language.searchLanguages("", capsPayload),
    [capsPayload],
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
        errors: [] as Array<{ code: string; message: string; blocking?: boolean }>,
        warnings: [] as Array<{ code: string; message: string; blocking?: boolean }>,
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

  const rebuildGroups = useCallback(
    (items: LocalItem[], mode: "pair" | "batch" = comparisonMode) => {
      const accepted = items.filter((item) => item.status === "accepted" || item.status === "base");
      const nextGroups = grouping.suggestGroups(accepted, { mode });
      setGroups(nextGroups);
      return nextGroups;
    },
    [comparisonMode],
  );

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
      // Each gate needs its own opening line; a stale message reads like a wrong instruction.
      setGateMessage(
        next === "auth"
          ? "Sign in or create an account. Files stay on this device until you choose a plan."
          : next === "paywall"
            ? "Choose a plan to continue. Nothing is uploaded at checkout."
            : next === "moss-id"
              ? "Connect your Moss User ID to unlock checks."
              : `${nextEntitlement?.remaining ?? 0} of ${nextEntitlement?.total ?? 0} runs left. Nothing is uploaded until you start a check.`,
      );
    },
    [],
  );

  const refreshSession = useCallback(async () => {
    const [authSession, nextHistory] = await Promise.all([loadAuthSession(), loadResultHistory()]);
    const nextAccount = authSession ? sessionToAccount(authSession) : null;
    // Trial status needs the API; never let that round trip hold the first paint on "Loading…".
    void loadDeviceTrialStatus().then(setDeviceTrial);

    let nextEntitlement: DemoEntitlement | null = null;
    let nextMoss: DemoMossCredential | null = null;
    if (nextAccount?.userId) {
      const synced = await syncLocalStateForAccount({
        userId: nextAccount.userId,
        email: nextAccount.email,
      });
      nextEntitlement = synced.entitlement;
      nextMoss = synced.moss;
      // Server entitlement is the source of truth once the API is reachable.
      try {
        const serverRes = await apiClient.getServerEntitlement({
          ownerUserId: nextAccount.userId,
        });
        if (serverRes.ok && serverRes.data) {
          const applied = await applyServerEntitlement(
            serverRes.data.entitlement as ServerEntitlement,
            { userId: nextAccount.userId, email: nextAccount.email },
          );
          if (applied) nextEntitlement = applied;
        }
      } catch {
        /* offline / unpacked build — keep the local mirror */
      }
    } else {
      nextEntitlement = await loadDemoEntitlement();
      nextMoss = await loadDemoMossCredential();
      // Signed-out browsers must not keep a previous account's portal unlock.
      if (nextEntitlement || nextMoss) {
        await clearDemoAccount();
        nextEntitlement = null;
        nextMoss = null;
      }
    }

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
      if (isLiveJob) recoverOpts.deadlineMs = 600_000;
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
      setThemePreference(await loadThemePreference());
      await refreshSession();
      await refreshState();
    })();
  }, [refreshSession, refreshState]);

  const cycleTheme = () => {
    const next = nextThemePreference(themePreference);
    setThemePreference(next);
    void saveThemePreference(next);
  };

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
    const ownerUserId = account?.userId || account?.email;
    if (!current || current.mode !== "live" || !current.jobId || !ownerUserId) return;
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
        ownerUserId,
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
            providerStage?: string;
          }
        | undefined;
      const nextPhase = apiClient.phaseFromJobStatus(job?.status);
      if (!nextPhase) return;

      if (job?.providerStage) {
        const stageLabels: Record<string, string> = {
          connecting: "Connecting to MOSS…",
          authenticated: "MOSS connection authenticated…",
          "language-accepted": "MOSS accepted the selected language…",
          "query-sent": "MOSS accepted the query…",
          "awaiting-report": "MOSS is generating the report…",
          "report-received": "MOSS report received…",
        };
        const stage = String(job.providerStage);
        setGateMessage(stageLabels[stage] || (stage.startsWith("uploaded-") ? "Files uploaded; submitting to MOSS…" : `MOSS status: ${stage}`));
      }

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
          ownerUserId,
          jobId: current.jobId,
        });
        if (revealed.ok && typeof revealed.data["reportUrl"] === "string") {
          setReportUrl(String(revealed.data["reportUrl"]));
        }
      }
    } finally {
      pollInFlightRef.current = false;
    }
  }, [run, account?.userId, account?.email]);

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
    if (authStep === "otp") {
      const verified = await verifyAccountOtp({
        nonce: otpNonce,
        code: otpCode,
        email: otpPendingEmail || email,
      });
      if (!verified.ok) {
        setAuthError(verified.error);
        return;
      }
      setAccount(sessionToAccount(verified.session));
      setPassword("");
      setOtpCode("");
      setOtpNonce("");
      setAuthStep("credentials");
      setMossRegEmail(verified.session.email);
      const synced = await syncLocalStateForAccount({
        userId: verified.session.userId,
        email: verified.session.email,
      });
      const trialStatus = await loadDeviceTrialStatus();
      setDeviceTrial(trialStatus);
      setEntitlement(synced.entitlement);
      setMossCredential(synced.moss);
      if (synced.moss?.display) setProviderIdMasked(synced.moss.display);
      resolveGate(sessionToAccount(verified.session), synced.entitlement, synced.moss);
      setGateMessage(
        synced.entitlement && isEntitled(synced.entitlement)
          ? "Welcome back. Continue where you left off."
          : `Choose a plan to continue — Free demo (1 check on this PC), Pair ($${PLANS.pair.priceUsd}), or Batch ($${PLANS.batch.priceUsd}).`,
      );
      return;
    }

    if (authMode === "create" && !createPasswordValid) {
      setAuthError(
        password !== confirmPassword
          ? "Passwords do not match."
          : "Password does not meet all security requirements.",
      );
      return;
    }

    const started =
      authMode === "create"
        ? await registerAccount(email, password)
        : await loginAccount(email, password);
    if (!started.ok) {
      setAuthError(started.error);
      return;
    }
    if ("session" in started) {
      const nextAccount = sessionToAccount(started.session);
      setAccount(nextAccount);
      setPassword("");
      setConfirmPassword("");
      setMossRegEmail(started.session.email);
      const synced = await syncLocalStateForAccount({
        userId: started.session.userId,
        email: started.session.email,
      });
      const trialStatus = await loadDeviceTrialStatus();
      setDeviceTrial(trialStatus);
      setEntitlement(synced.entitlement);
      setMossCredential(synced.moss);
      if (synced.moss?.display) setProviderIdMasked(synced.moss.display);
      resolveGate(nextAccount, synced.entitlement, synced.moss);
      setGateMessage(
        synced.entitlement && isEntitled(synced.entitlement)
          ? "Welcome back. Continue where you left off."
          : `Choose a plan to continue - Free demo (1 check on this PC), Pair ($${PLANS.pair.priceUsd}), or Batch ($${PLANS.batch.priceUsd}).`,
      );
      return;
    }
    setOtpNonce(started.nonce);
    setOtpPendingEmail(started.email);
    setAuthStep("otp");
    setGateMessage(started.message);
  };

  const onStartPasswordReset = () => {
    setAuthError("");
    setPassword("");
    setConfirmPassword("");
    setOtpCode("");
    setOtpNonce("");
    setAuthStep("forgot");
  };

  const onRequestResetCode = async () => {
    setAuthError("");
    const started = await requestPasswordReset(email);
    if (!started.ok) {
      setAuthError(started.error);
      return;
    }
    setOtpNonce(started.nonce);
    setOtpPendingEmail(started.email);
    setAuthStep("reset");
    setGateMessage(started.message);
  };

  const onSubmitNewPassword = async () => {
    setAuthError("");
    if (!createPasswordValid) {
      setAuthError(
        password !== confirmPassword
          ? "Passwords do not match."
          : "Password does not meet all security requirements.",
      );
      return;
    }
    const reset = await resetPassword({
      nonce: otpNonce,
      code: otpCode,
      newPassword: password,
    });
    if (!reset.ok) {
      setAuthError(reset.error);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setOtpCode("");
    setOtpNonce("");
    setAuthMode("signin");
    setAuthStep("credentials");
    setGateMessage(reset.message);
  };

  const onSocialSignIn = async (provider: SocialProvider) => {
    setAuthError("");
    setSocialBusy(provider);
    const signedIn = await loginWithSocialProvider(provider);
    setSocialBusy(null);
    if (!signedIn.ok) {
      setAuthError(signedIn.error);
      return;
    }
    const nextAccount = sessionToAccount(signedIn.session);
    setAccount(nextAccount);
    setMossRegEmail(signedIn.session.email);
    const synced = await syncLocalStateForAccount({
      userId: signedIn.session.userId,
      email: signedIn.session.email,
    });
    const trialStatus = await loadDeviceTrialStatus();
    setDeviceTrial(trialStatus);
    setEntitlement(synced.entitlement);
    setMossCredential(synced.moss);
    if (synced.moss?.display) setProviderIdMasked(synced.moss.display);
    resolveGate(nextAccount, synced.entitlement, synced.moss);
    setGateMessage(
      synced.entitlement && isEntitled(synced.entitlement)
        ? `Signed in with ${provider === "google" ? "Google" : "Microsoft"}.`
        : `Signed in with ${provider === "google" ? "Google" : "Microsoft"}. Choose a plan to unlock PairProof.`,
    );
  };

  const onAuthBackToCredentials = () => {
    setAuthStep("credentials");
    setOtpCode("");
    setOtpNonce("");
    setPassword("");
    setConfirmPassword("");
    setAuthError("");
  };

  const unlockPlan = (next: DemoEntitlement, planId: PlanId) => {
    setEntitlement(next);
    setSourceItems([]);
    setSourceFiles([]);
    setGroups([]);
    setMossIdStep("register");
    setMossAck(false);
    setMossIdError("");
    if (!mossRegEmail && account?.email) setMossRegEmail(account.email);
    setGate("moss-id");
    const plan = PLANS[planId];
    setGateMessage(
      `${plan.name} unlocked — ${next.remaining} of ${next.total} runs. Connect your Moss User ID next. Files are not uploaded yet.`,
    );
  };

  const refreshServerEntitlement = async (): Promise<boolean> => {
    if (!account?.userId) return false;
    try {
      const res = await apiClient.getServerEntitlement({ ownerUserId: account.userId });
      if (res.ok && res.data) {
        const applied = await applyServerEntitlement(
          res.data.entitlement as ServerEntitlement,
          { userId: account.userId, email: account.email },
        );
        if (applied) {
          setEntitlement(applied);
          return true;
        }
      }
    } catch {
      /* ignore transient errors */
    }
    return false;
  };

  // After opening the hosted checkout, poll the server until the webhook grants
  // the entitlement, then reflect it here (~3 min at 5s intervals).
  const startEntitlementPolling = () => {
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      const unlocked = await refreshServerEntitlement();
      if (unlocked) return;
      if (attempts < 36) {
        window.setTimeout(() => {
          void tick();
        }, 5000);
      }
    };
    window.setTimeout(() => {
      void tick();
    }, 5000);
  };

  const onPurchase = async (planId: PlanId) => {
    if (planId === "trial") {
      await onClaimFreeTrial();
      return;
    }
    // Real Safepay hosted checkout when signed in and the API is reachable.
    if (account?.userId) {
      const res = await apiClient.startSafepayCheckout({
        ownerUserId: account.userId,
        planId,
      });
      const checkoutUrl =
        typeof res.data.checkoutUrl === "string" ? res.data.checkoutUrl : null;
      if (res.ok && checkoutUrl) {
        await browser.tabs.create({ url: checkoutUrl });
        setGateMessage(
          `Complete your payment in the tab that just opened. Your ${PLANS[planId].name} plan unlocks here automatically once payment is confirmed.`,
        );
        startEntitlementPolling();
        return;
      }
      const err = String(res.data.error || "");
      // Only fall back to the local demo unlock when the hosted API/checkout is
      // unavailable (unpacked/dev build); otherwise surface the error.
      if (err !== "origin-forbidden" && err !== "network" && err !== "safepay-not-configured") {
        setGateMessage("Could not start checkout. Please try again.");
        return;
      }
    }
    // Fallback: local demo unlock (unpacked/testing builds with no hosted API).
    try {
      const next = await purchaseDemoEntitlement(planId, {
        userId: account?.userId,
        email: account?.email,
      });
      unlockPlan(next, planId);
    } catch (error) {
      setGateMessage(error instanceof Error ? error.message : "Could not unlock that plan.");
    }
  };

  const onClaimFreeTrial = async () => {
    const claimed = await claimDeviceTrial({
      userId: account?.userId,
      email: account?.email,
    });
    if (!claimed.ok) {
      setDeviceTrial({ claimed: true });
      setGateMessage(claimed.error);
      return;
    }
    setDeviceTrial({ claimed: true, claimedAt: Date.now(), email: account?.email });
    unlockPlan(claimed.entitlement, "trial");
  };

  const onSaveMossUserId = async () => {
    setMossIdError("");
    if (!canEnterId) {
      setMossIdError("Acknowledge that you emailed Moss (or already have an ID) before continuing.");
      return;
    }
    const regEmail = (mossRegEmail || account?.email || "").trim();
    const saved = await saveDemoMossCredential(providerIdInput, regEmail, {
      userId: account?.userId,
      email: account?.email,
    });
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
      `Moss User ID connected (${saved.credential.display}). ${planLabel} is ready — ${runsLeft || entitlement?.remaining || OFFER.runs} runs available.`,
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
    await logoutAccount();
    await clearDemoAccount();
    await clearAuthSession();
    setAccount(null);
    setEntitlement(null);
    setMossCredential(null);
    setProviderIdMasked("");
    setMossAck(false);
    setMossIdStep("register");
    setAuthStep("credentials");
    setOtpCode("");
    setOtpNonce("");
    setPassword("");
    setConfirmPassword("");
    await discard();
    setGate("auth");
    setGateMessage("Signed out. Sign in again to continue.");
  };

  /**
   * A language the customer picks from capabilities is already deliberate, so the selection
   * itself is the confirmation. Guesses from file names only ever become a hint.
   */
  const applyLanguage = (code: string) => {
    if (!code) {
      setLanguageCode("");
      setLanguageConfirmed(false);
      setLanguageHint("Pick the language of these files. Choosing it here is the confirmation.");
      resetConsent();
      return;
    }
    const resolved = language.resolveManualSelection(code, capsPayload);
    if (!resolved.ok || !resolved.code) {
      setLanguageHint(resolved.error || "Unsupported language.");
      return;
    }
    setLanguageCode(resolved.code);
    setLanguageConfirmed(true);
    setLanguageHint(`${resolved.label} selected for this check.`);
    resetConsent();
  };

  /**
   * `slot` is a Pair Check tile. Picking into a filled tile replaces that file in place so the
   * customer never has to remove one before swapping it.
   */
  const onSourceFiles = (files: File[], slot?: number) => {
    if (!entitled) {
      setNote("Purchase required before selecting files for a run.");
      return;
    }
    if (!mossConnected) {
      setNote("Connect Moss ID before selecting files.");
      setGate("moss-id");
      return;
    }
    const replacing = typeof slot === "number" && slot < sourceItems.length;
    const room = maxFilesPerRun - sourceItems.length + (replacing ? 1 : 0);
    if (room <= 0) {
      setNote(
        comparisonMode === "batch"
          ? `Batch allows max ${maxFilesPerRun} files per run.`
          : `Pair Check allows max ${maxFilesPerRun} files per run.`,
      );
      return;
    }
    const capped = files.slice(0, room);
    const keptItems = replacing ? sourceItems.filter((_, i) => i !== slot) : sourceItems;
    const result = intake.ingestSelection(capped, {
      existing: [...keptItems, ...baseItems],
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
    if (!accepted.length) {
      setNote("That selection was not accepted. Nothing changed.");
      return;
    }
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
    if (replacing && !matchedFiles.length) {
      setNote("That file could not be read. The previous choice is unchanged.");
      return;
    }
    const nextSources = replacing
      ? sourceItems.map((item, i) => (i === slot ? (accepted[0] as LocalItem) : item))
      : [...sourceItems, ...accepted].slice(0, maxFilesPerRun);
    const nextFiles = replacing
      ? sourceFiles.map((file, i) => (i === slot ? (matchedFiles[0] as File) : file))
      : [...sourceFiles, ...matchedFiles].slice(0, maxFilesPerRun);
    setSourceItems(nextSources);
    setSourceFiles(nextFiles);
    rebuildGroups(nextSources, comparisonMode);
    const suggestion = language.suggestLanguage(
      nextSources.map((item) => ({ displayName: item.displayName })),
      capsPayload,
    );
    if (suggestion.suggestion && !languageCode) {
      setLanguageHint(
        `These files look like ${suggestion.suggestion.label}. Pick it in the language list to use it.`,
      );
    }
    setNote(
      `${nextSources.length} of ${maxFilesPerRun} files chosen. Nothing has left this device.`,
    );
    resetConsent();
    if (files.length > capped.length) {
      setGateMessage(
        `Only the first ${capped.length} file(s) were kept — this plan allows ${maxFilesPerRun} per run.`,
      );
    }
  };

  const removeSource = (index: number) => {
    const next = sourceItems.filter((_, i) => i !== index);
    setSourceItems(next);
    setSourceFiles((prev) => prev.filter((_, i) => i !== index));
    rebuildGroups(next);
    resetConsent();
    setNote(`${next.length} of ${maxFilesPerRun} files chosen. Nothing has left this device.`);
  };

  const clearSources = () => {
    setSourceItems([]);
    setSourceFiles([]);
    rebuildGroups([]);
    resetConsent();
    setNote(`0 of ${maxFilesPerRun} files chosen. Nothing has left this device.`);
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
      setGateMessage("Connect Moss ID before starting a run.");
      setGate("moss-id");
      return;
    }
    if (!languageCode || !languageConfirmed) {
      setGateMessage("Choose the language of these files before starting.");
      return;
    }
    const filledGroups = groups.filter((group) => Array.isArray(group.files) && group.files.length > 0);
    if (comparisonMode === "pair") {
      if (sourceItems.length !== maxFilesPerRun || filledGroups.length !== 2) {
        setGateMessage(`Pair Check needs exactly ${maxFilesPerRun} files (two submissions).`);
        return;
      }
    } else if (sourceItems.length < 2 || filledGroups.length < 2) {
      setGateMessage("Batch needs at least two submissions (multi-file or folder selection).");
      return;
    }
    if (sourceFiles.length !== sourceItems.length) {
      setGateMessage(
        comparisonMode === "pair"
          ? "Reselect both files in this session before starting — file bytes are not kept after restart."
          : "Reselect files in this session before starting — file bytes are not kept after restart.",
      );
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
        deadlineMs: 600_000,
      }),
    );
    setReportUrl("");
    setLinkNote("");
    setLinkForgotten(false);
    syncedRunRef.current = "";

    const authSession = await loadAuthSession();
    const ownerUserId = authSession?.userId || account?.email || "local-owner";
    const created = await apiClient.createPairJob({
      ownerUserId,
      language: languageCode,
      idempotencyKey,
      mode: comparisonMode,
      settings: {
        commonMatchThreshold: settings.commonMatchThreshold,
        resultCount: settings.resultCount,
        reportLabel: settings.reportLabel || (comparisonMode === "batch" ? "batch-check" : "pair-check"),
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

    const submissionByKey = new Map<string, number>();
    filledGroups.forEach((group, groupIndex) => {
      for (const file of group.files || []) {
        const key = String(file.key || `${file.displayName}::${file.size || file.bytes || 0}`);
        submissionByKey.set(key, groupIndex + 1);
      }
    });
    const encoded = await Promise.all(
      sourceFiles.map(async (file, index) => {
        const item = sourceItems[index];
        const key = String(item?.key || `${item?.displayName || file.name}::${file.size}`);
        return {
          displayName: item?.displayName || file.name,
          bytesBase64: await apiClient.fileToBase64(file),
          submissionId: submissionByKey.get(key) || index + 1,
        };
      }),
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
    const ownerUserId = account?.userId || account?.email;
    if (run?.mode === "live" && run.jobId && ownerUserId) {
      void apiClient.forgetJobResult({ ownerUserId, jobId: run.jobId });
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
        ? "Choose a plan"
        : gate === "moss-id"
          ? "Connect Moss User ID"
          : runView && !runView.isTerminal
            ? runView.title
            : runsLeft < 1
              ? "No runs left"
              : "Ready to compare";

  const statusDetail =
    gate === "auth"
      ? "Create or sign in to continue. Files stay on this device until you choose a plan and consent."
      : gate === "paywall"
        ? deviceTrial.claimed
          ? `This PC already used its free demo. Pair $${PLANS.pair.priceUsd} · ${PLANS.pair.runs} runs, or Batch $${PLANS.batch.priceUsd} · ${PLANS.batch.runs} runs.`
          : `Free demo · 1 Pair Check on this PC · or Pair $${PLANS.pair.priceUsd} · Batch $${PLANS.batch.priceUsd}. Complete a plan before Moss ID and runs.`
        : gate === "moss-id"
          ? "After you unlock a plan, register with Moss yourself and paste only the numeric userid. We never send that email for you."
          : runView && !runView.isTerminal
            ? runView.detail
            : runsLeft < 1
              ? "No runs left on this plan. Return to pricing to unlock more."
              : `${runsLeft} of ${entitlement?.total ?? OFFER.runs} runs left · ${planLabel} · max ${maxFilesPerRun} files`;

  const onOpenRunWindow = async () => {
    const opened = await openRunWindow();
    setGateMessage(
      opened.ok
        ? "Run window opened. Pick your files there — this panel can be closed."
        : opened.error || "Could not open the run window.",
    );
  };

  const filledGroupCount = groups.filter((group) => Array.isArray(group.files) && group.files.length > 0).length;
  const filesReady =
    comparisonMode === "pair"
      ? sourceItems.length === maxFilesPerRun && filledGroupCount === 2
      : sourceItems.length >= 2 && filledGroupCount >= 2;
  const consentsReady = ownership && sensitiveLink;
  const blockingPreflight = preflightResult.errors.find((error) => error.blocking);
  const warningsReady = preflightResult.warnings.length === 0 || warningsAck;
  const startBlocker = !mossConnected
    ? "Connect your Moss User ID first."
    : runsLeft < 1
      ? "No runs left on this plan."
      : !filesReady
        ? comparisonMode === "pair"
          ? `Choose ${maxFilesPerRun} files (${sourceItems.length} chosen).`
          : filledGroupCount < 2
            ? `Batch needs at least 2 submissions (${filledGroupCount} ready).`
            : `Choose at least 2 files (${sourceItems.length} chosen).`
        : !languageConfirmed
          ? "Choose the language of these files."
          : blockingPreflight
            ? `Resolve preflight block: ${blockingPreflight.message}`
          : !consentsReady
            ? "Tick both confirmations below."
            : !warningsReady
              ? "Acknowledge the preflight warnings."
              : "";

  const startLabel = progressPhase
    ? "Working…"
    : comparisonMode === "batch"
      ? "Start Batch Check"
      : "Start Pair Check";

  /** Same action at the top of the run window and again under the consents. */
  const renderStartButton = (position: "header" | "footer") => (
    <div className="start-block" data-start-position={position}>
      <button
        type="button"
        className="cta cta--primary"
        disabled={progressPhase || Boolean(startBlocker)}
        onClick={() => {
          setAllowOfflineDemo(false);
          void tryStartJob();
        }}
      >
        {startLabel}
      </button>
      {startBlocker && !progressPhase ? <p className="status">{startBlocker}</p> : null}
    </div>
  );

  /** Device-only result history — shown last in the run window, first in the popup. */
  const historyCard = (
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
  );

  if (gate === "loading") {
    return (
      <div className="shell shell--popup" role="status">
        <p className="status">Loading account…</p>
      </div>
    );
  }

  return (
    <div
      className={isPopup ? "shell shell--popup" : "shell shell--page"}
      data-gate={gate}
      data-surface={surface}
    >
      <header className="popup-header" role="banner">
        <div className="brand-row">
          <BrandMark />
          <div className="brand-copy">
            <h1>PairProof</h1>
            <p className="brand-kicker">{isPopup ? "SIMILARITY, VERIFIED" : "RUN WINDOW"}</p>
          </div>
          <button
            type="button"
            className="theme-toggle"
            onClick={cycleTheme}
            title={`Theme: ${themePreference}. Click for next mode.`}
            aria-label={`Theme: ${themePreference}. Change theme.`}
          >
            {themePreference === "dark" ? "☾" : themePreference === "light" ? "☀" : "◐"}
          </button>
        </div>
      </header>

      <main className={isPopup ? "popup-main" : "page-main"} role="main">
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
              {authStep === "credentials" ? (
                <>
                  <div className="social-auth">
                    <button
                      type="button"
                      className="social-auth__button"
                      disabled={socialBusy !== null}
                      onClick={() => void onSocialSignIn("google")}
                    >
                      <GoogleIcon />
                      {socialBusy === "google" ? "Connecting…" : "Google"}
                    </button>
                    <button
                      type="button"
                      className="social-auth__button"
                      disabled={socialBusy !== null}
                      onClick={() => void onSocialSignIn("microsoft")}
                    >
                      <MicrosoftIcon />
                      {socialBusy === "microsoft" ? "Connecting…" : "Outlook"}
                    </button>
                  </div>
                  <div className="auth-divider">
                    <span>or use email</span>
                  </div>
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
                      placeholder="you@company.com"
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
                      placeholder={authMode === "create" ? "Create a strong password" : "Your password"}
                    />
                  </label>
                  {authMode === "create" ? (
                    <>
                      <label className="stack-field" htmlFor="account-confirm-password">
                        <span className="type-label">Confirm password</span>
                        <input
                          id="account-confirm-password"
                          type="password"
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="Enter password again"
                        />
                      </label>
                      <ul className="password-rules" aria-label="Password requirements">
                        <li data-valid={passwordChecks.length}>10+ characters</li>
                        <li data-valid={passwordChecks.uppercase}>Uppercase letter</li>
                        <li data-valid={passwordChecks.lowercase}>Lowercase letter</li>
                        <li data-valid={passwordChecks.number}>Number</li>
                        <li data-valid={passwordChecks.symbol}>Symbol</li>
                        <li data-valid={passwordChecks.noWhitespace}>No spaces</li>
                        <li data-valid={confirmPassword.length > 0 && password === confirmPassword}>
                          Passwords match
                        </li>
                      </ul>
                    </>
                  ) : null}
                  {authError ? (
                    <p className="status status--danger" role="alert">
                      {authError}
                    </p>
                  ) : (
                    <p className="status">
                      We email a one-time code from Matrix AE to confirm your account. Google and Outlook
                      connect come next.
                    </p>
                  )}
                  <button
                    type="button"
                    className="cta"
                    disabled={authMode === "create" && !createPasswordValid}
                    onClick={() => void onAuthSubmit()}
                  >
                    {authMode === "create" ? "Create account" : "Sign in"}
                  </button>
                  {authMode === "signin" ? (
                    <button type="button" className="link-button" onClick={onStartPasswordReset}>
                      Forgot password?
                    </button>
                  ) : null}
                </>
              ) : authStep === "forgot" ? (
                <>
                  <p className="status">
                    Enter your account email and we will send a 6-digit code to reset the password.
                  </p>
                  <label className="stack-field" htmlFor="reset-email">
                    <span className="type-label">Email</span>
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@company.com"
                    />
                  </label>
                  {authError ? (
                    <p className="status status--danger" role="alert">
                      {authError}
                    </p>
                  ) : null}
                  <button type="button" className="cta" onClick={() => void onRequestResetCode()}>
                    Send reset code
                  </button>
                  <button type="button" className="secondary" onClick={onAuthBackToCredentials}>
                    Back
                  </button>
                </>
              ) : authStep === "reset" ? (
                <>
                  <p className="status">
                    Enter the code sent to <strong>{otpPendingEmail || email}</strong> and choose a new
                    password.
                  </p>
                  <label className="stack-field" htmlFor="reset-otp">
                    <span className="type-label">Verification code</span>
                    <input
                      id="reset-otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                    />
                  </label>
                  <label className="stack-field" htmlFor="reset-password">
                    <span className="type-label">New password</span>
                    <input
                      id="reset-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Create a strong password"
                    />
                  </label>
                  <label className="stack-field" htmlFor="reset-confirm-password">
                    <span className="type-label">Confirm new password</span>
                    <input
                      id="reset-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Enter password again"
                    />
                  </label>
                  <ul className="password-rules" aria-label="Password requirements">
                    <li data-valid={passwordChecks.length}>10+ characters</li>
                    <li data-valid={passwordChecks.uppercase}>Uppercase letter</li>
                    <li data-valid={passwordChecks.lowercase}>Lowercase letter</li>
                    <li data-valid={passwordChecks.number}>Number</li>
                    <li data-valid={passwordChecks.symbol}>Symbol</li>
                    <li data-valid={passwordChecks.noWhitespace}>No spaces</li>
                    <li data-valid={confirmPassword.length > 0 && password === confirmPassword}>
                      Passwords match
                    </li>
                  </ul>
                  {authError ? (
                    <p className="status status--danger" role="alert">
                      {authError}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="cta"
                    disabled={!createPasswordValid || otpCode.length !== 6}
                    onClick={() => void onSubmitNewPassword()}
                  >
                    Update password
                  </button>
                  <button type="button" className="secondary" onClick={onAuthBackToCredentials}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <p className="status">
                    Enter the 6-digit code sent to <strong>{otpPendingEmail || email}</strong>.
                  </p>
                  <label className="stack-field" htmlFor="account-otp">
                    <span className="type-label">Verification code</span>
                    <input
                      id="account-otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                    />
                  </label>
                  {authError ? (
                    <p className="status status--danger" role="alert">
                      {authError}
                    </p>
                  ) : null}
                  <button type="button" className="cta" onClick={() => void onAuthSubmit()}>
                    Verify email
                  </button>
                  <button type="button" className="secondary" onClick={onAuthBackToCredentials}>
                    Back
                  </button>
                </>
              )}
            </div>
          ) : null}

          {gate === "paywall" ? (
            <div className="paywall-panel">
              <div className="plan-grid">
                <article className="plan-card" data-plan="trial">
                  <div className="plan-card__head">
                    <h3>{PLANS.trial.name}</h3>
                    <p className="plan-price">
                      <strong>$0</strong>
                      <span> this PC</span>
                    </p>
                  </div>
                  <p className="status">
                    {PLANS.trial.runs} Pair Check · {PLANS.trial.blurb}
                  </p>
                  <button
                    type="button"
                    className="cta"
                    disabled={deviceTrial.claimed}
                    onClick={() => void onClaimFreeTrial()}
                  >
                    {deviceTrial.claimed ? "Free demo used on this PC" : "Start free demo"}
                  </button>
                </article>
                {PLAN_LIST.map((plan) => (
                  <article key={plan.id} className="plan-card" data-plan={plan.id}>
                    <div className="plan-card__head">
                      <h3>{plan.name}</h3>
                      <p className="plan-price">
                        <strong>${plan.priceUsd}</strong>
                        <span> once</span>
                      </p>
                    </div>
                    <p className="status">
                      {plan.runs} runs · max {plan.maxFilesPerRun} files per run · {plan.blurb}
                    </p>
                    <button
                      type="button"
                      className={plan.id === "batch" ? "cta" : "secondary"}
                      onClick={() => void onPurchase(plan.id)}
                    >
                      Unlock {plan.name} · ${plan.priceUsd}
                    </button>
                  </article>
                ))}
              </div>
              <p className="status">
                Complete a plan first. Then connect Moss User ID. Files have not been uploaded yet.
              </p>
              <p className="status">
                Paid unlocks are simulated for local demo — no payment-processor charge yet.
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
              {isPopup ? (
                <>
                  <p className="status">
                    Choose files and start the check in the run window. Chrome closes this small panel
                    the moment a file chooser opens, so the run gets its own window that stays put.
                  </p>
                  <button type="button" className="cta cta--primary" onClick={() => void onOpenRunWindow()}>
                    Open run window
                  </button>
                  <p className="status">
                    Moss User ID connected · {mossCredential?.display || providerIdMasked}
                  </p>
                </>
              ) : (
                <>
                  <p className="status status--notice">
                    Starting a check uploads your files to the hosted API and then to MOSS. A live run
                    uses your Moss User ID and quota. The result link is sensitive — treat it like a
                    password. Reports never auto-open.
                  </p>
                  {apiMeta?.livePublicTcp ? (
                    <p className="status status--notice">
                      Hosted BYO mode: the API submits to Stanford MOSS over public TCP using your
                      Moss User ID and quota. Treat result links as sensitive. An encrypted commercial
                      route is not available from Stanford for this product yet.
                    </p>
                  ) : null}
                  {renderStartButton("header")}
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
                </>
              )}
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

        {gate === "portal" && isPopup ? historyCard : null}

        {gate === "portal" && !isPopup ? (
          <>
            <section className="card step-card" aria-labelledby="step-language">
              <div className="row section-head">
                <h2 id="step-language">
                  <span className="step-badge" aria-hidden="true">
                    1
                  </span>
                  Language
                </h2>
                <span className="badge" data-ready={languageConfirmed}>
                  {languageConfirmed ? languageCode : "not set"}
                </span>
              </div>
              <label className="stack-field" htmlFor="workspace-language">
                <span className="type-label">Programming language</span>
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
              <p className="status">{languageHint}</p>
            </section>

            <section className="card step-card" aria-labelledby="step-files">
              <div className="row section-head">
                <h2 id="step-files">
                  <span className="step-badge" aria-hidden="true">
                    2
                  </span>
                  {comparisonMode === "batch" ? "Files or folder" : "Two files"}
                </h2>
                <span className="badge" data-ready={filesReady}>
                  {sourceItems.length}/{maxFilesPerRun}
                </span>
              </div>
              <p className="status">
                {comparisonMode === "batch"
                  ? `Batch mode · multi-file or folder · max ${maxFilesPerRun} files. Files stay on this device until you start.`
                  : `Pair Check compares exactly two files. Files stay on this device until you start.`}
              </p>

              <div className="file-pickers">
                {comparisonMode === "pair" ? (
                  <>
                    {PAIR_SLOTS.map((slot) => (
                      <label
                        key={slot.index}
                        className="file-button file-button--drop"
                        data-filled={Boolean(sourceItems[slot.index])}
                      >
                        <span className="file-button__title">{slot.title}</span>
                        <span className="file-button__name">
                          {sourceItems[slot.index]?.displayName || "Choose a file"}
                        </span>
                        <span className="file-button__hint">
                          {sourceItems[slot.index] ? "Click to replace" : "No file yet"}
                        </span>
                        <input
                          type="file"
                          aria-label={slot.ariaLabel}
                          onChange={(event) => {
                            onSourceFiles(fileListFromInput(event), slot.index);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    ))}
                  </>
                ) : (
                  <>
                    <label className="file-button file-button--drop">
                      <span className="file-button__title">Files</span>
                      <span className="file-button__name">Choose several files</span>
                      <input
                        type="file"
                        multiple
                        aria-label="Choose multiple files"
                        disabled={sourceItems.length >= maxFilesPerRun}
                        onChange={(event) => {
                          onSourceFiles(fileListFromInput(event));
                          event.target.value = "";
                        }}
                      />
                    </label>
                    {allowsDirectory ? (
                      <label className="file-button file-button--drop">
                        <span className="file-button__title">Folder</span>
                        <span className="file-button__name">Choose a folder</span>
                        <input
                          type="file"
                          multiple
                          aria-label="Choose a folder or directory"
                          disabled={sourceItems.length >= maxFilesPerRun}
                          ref={(node) => {
                            if (node) node.setAttribute("webkitdirectory", "");
                          }}
                          onChange={(event) => {
                            onSourceFiles(fileListFromInput(event));
                            event.target.value = "";
                          }}
                        />
                      </label>
                    ) : null}
                  </>
                )}
              </div>
              {comparisonMode === "pair" ? null : (
                <ul className="file-list" aria-label="Selected source files">
                  {sourceItems.map((item, index) => (
                    <li key={`${item.displayName}-${index}`} className="file-row">
                      <span>{item.displayName}</span>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => removeSource(index)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {comparisonMode === "pair" && sourceItems.length ? (
                <div className="row wrap">
                  <button type="button" className="secondary" onClick={() => clearSources()}>
                    Clear both files
                  </button>
                </div>
              ) : null}
              <p className="status">{note}</p>
            </section>

            <section className="card step-card" aria-labelledby="step-start">
              <div className="row section-head">
                <h2 id="step-start">
                  <span className="step-badge" aria-hidden="true">
                    3
                  </span>
                  Review consents and start
                </h2>
                <InfoTip label={comparisonMode === "batch" ? "About Batch Check" : "About Pair Check"}>
                  {comparisonMode === "batch"
                    ? "Batch compares multiple files or folder/directory selections in one run. Pair stays limited to two files."
                    : "This plan compares exactly two files per run. Batch adds multi-file and folder selection."}
                </InfoTip>
              </div>
              <div className="review-summary" aria-label="Review summary">
                <p className="status">
                  {reviewSummary.mode} · {reviewSummary.language || "language unset"} ·{" "}
                  {reviewSummary.groups?.length || 0} submissions · {runsLeft} runs left
                </p>
              </div>

              <div className="preflight" role="region" aria-label="Preflight findings">
                <h3>Preflight</h3>
                {!filesReady ? (
                  <p className="status">Findings appear once your files are selected.</p>
                ) : preflightResult.errors.length === 0 && preflightResult.warnings.length === 0 ? (
                  <p className="status">No blocking findings. Nothing has been uploaded yet.</p>
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
                <label className="row consent-row">
                  <input
                    type="checkbox"
                    checked={warningsAck}
                    onChange={(event) => setWarningsAck(event.target.checked)}
                  />
                  <span>
                    I acknowledge these warnings. Acknowledgements reset after material changes.
                  </span>
                </label>
              ) : null}

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
                Upload starts only after entitlement and recorded consent.
                {" The extension never opens raw provider TCP."}
              </p>
              {renderStartButton("footer")}
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

        {gate === "portal" && !isPopup ? historyCard : null}

        {gate === "portal" ? (
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
