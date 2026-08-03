export type RunPhase =
  | "validate"
  | "upload"
  | "queue"
  | "submit"
  | "wait"
  | "success"
  | "failure"
  | "cancelled"
  | "timeout";

export interface RunState {
  phase: RunPhase;
  mode: string;
  comparison: "pair" | "batch";
  language: string | null;
  jobId: string | null;
  idempotencyKey: string | null;
  startedAt: number;
  updatedAt: number;
  deadlineAt: number;
  deadlineMs: number;
  submitted: boolean;
  resultRef: string | null;
  failureCode: string | null;
}

export interface RunErrorView {
  code: string;
  copy: { title: string; body: string };
  retryEligible: boolean;
  requiresDeliberateResubmit: boolean;
  actions: Array<{ id: string; label: string }>;
  terminalExplanation: string | null;
  correlationId: string | null;
}

export interface RunView {
  ok: boolean;
  state: RunPhase;
  title: string;
  detail: string;
  action: string | null;
  reportUrl: string | null;
  autoOpen: boolean;
  fabricatePercent: boolean;
  diagnosticId: string | null;
  caveats: string[];
  isTerminal: boolean;
  isDemo: boolean;
  demoLabel: string | null;
  demoNotice: string | null;
  resultRef: string | null;
  remainingMs: number;
  releasesRunCredit: boolean;
  error: RunErrorView | null;
}

export const RUN_LIFECYCLE_VERSION: number;
export const RUN_DEADLINE_MS: number;
export const DEMO_STEP_MS: number;
export const LOCAL_DEMO_LABEL: string;
export const LOCAL_DEMO_NOTICE: string;
export const TERMINAL_PHASES: readonly RunPhase[];

export function isTerminalPhase(phase: string): boolean;
export function createDemoResultRef(seed?: string): string;
export function demoReportPath(ref: string): `/report.html#${string}`;
export function remainingMs(state: RunState | null, now?: number): number;
export function jobStatusForRun(state: RunState | null): string | null;
export function shouldReleaseRunCredit(state: RunState | null): boolean;

export function createRunState(input?: {
  now?: number;
  mode?: string;
  comparison?: "pair" | "batch";
  language?: string | null;
  jobId?: string | null;
  idempotencyKey?: string | null;
  deadlineMs?: number;
}): RunState;

export function advanceRunState(
  state: RunState,
  options?: {
    now?: number;
    event?: "next" | "fail" | "cancel" | "timeout" | "retry";
    failureCode?: string | null;
    resultRef?: string | null;
  },
): { ok: boolean; error?: string; state: RunState; changed: boolean; deadlineExceeded: boolean };

export function recoverRunState(
  job: unknown,
  options?: { now?: number; deadlineMs?: number; mode?: string },
): { ok: boolean; error?: string; state: RunState | null; recovered?: boolean; deadlineExceeded?: boolean };

export function describeRun(
  state: RunState | null,
  options?: { reportUrl?: string | null; etaMinutes?: number | null },
): RunView;

export function validateRunLifecycleModule(): { ok: boolean; errors: string[]; version: number };
