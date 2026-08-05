import { browser } from "wxt/browser";
import * as mossId from "@moss/ui/moss-id";
import { API_ORIGIN, isAllowedOrigin } from "./origins";
import { ensureDeviceId, loadAuthSession } from "./account-session";

export type PlanId = "trial" | "pair" | "batch";

/** Sold / demo packages shown after signup (local entitlement until Paddle). */
export const PLANS = Object.freeze({
  trial: Object.freeze({
    id: "trial" as const,
    name: "Free demo",
    priceUsd: 0,
    runs: 1,
    maxFilesPerRun: 2,
    mode: "pair" as const,
    allowsDirectory: false,
    headline: "One free Pair Check",
    blurb: "One two-file check on this PC. New accounts on the same computer cannot claim again.",
  }),
  pair: Object.freeze({
    id: "pair" as const,
    name: "Pair",
    priceUsd: 15,
    runs: 15,
    maxFilesPerRun: 2,
    mode: "pair" as const,
    allowsDirectory: false,
    headline: "Two-file Pair Check",
    blurb: "Compare exactly two files per run.",
  }),
  batch: Object.freeze({
    id: "batch" as const,
    name: "Batch",
    priceUsd: 50,
    runs: 50,
    maxFilesPerRun: 50,
    mode: "batch" as const,
    allowsDirectory: true,
    headline: "Multi-file & folder runs",
    blurb: "Multi-file or folder/directory selection per run.",
  }),
});

/** Paid packages on the pricing screen (trial is offered separately). */
export const PLAN_LIST = Object.freeze([PLANS.pair, PLANS.batch]);

/** @deprecated Prefer PLANS.pair — kept so older copy/tests still resolve the $15 Pair offer. */
export const OFFER = Object.freeze({
  priceUsd: PLANS.pair.priceUsd,
  runs: PLANS.pair.runs,
  maxFilesPerRun: PLANS.pair.maxFilesPerRun,
  note: "Offer display uses 15 runs / max 2 files per run (updated from the Prompt 006 40-check model). Batch is a separate $50 / 50-run package. New PCs may claim one free demo Pair Check.",
});

/**
 * Deterministic local demo login (seeded into chrome.storage.local).
 * Not a production credential — for unpacked extension testing only.
 */
export const DEMO_LOGIN = Object.freeze({
  email: "demo@mossworkflow.test",
  password: "DemoTest1!",
});

const ACCOUNT_KEY = "moss.demo.account";
const ACCOUNTS_KEY = "moss.demo.accounts";
const ENTITLEMENT_KEY = "moss.demo.entitlement";
/** Run references already refunded, so a reopened popup cannot release the same run twice. */
const RELEASED_RUNS_KEY = "moss.demo.releasedRuns";
const RELEASED_RUNS_MAX = 50;
/** Local-only Moss credential record — never sync; never stores plaintext userid. */
const MOSS_CRED_KEY = "moss.demo.mossCredential";
/** Local mirror of device trial claim — server is source of truth when online. */
const DEVICE_TRIAL_KEY = "moss.device.trialClaim";

export type DemoAccount = {
  email: string;
  signedInAt: number;
  userId?: string;
};

export type DemoEntitlement = {
  remaining: number;
  total: number;
  maxFilesPerRun: number;
  purchasedAt: number;
  planId: PlanId;
  mode: "pair" | "batch";
  allowsDirectory: boolean;
  /** Bound to the signed-in account so a new signup cannot inherit another user's purchase. */
  ownerUserId: string;
  ownerEmail: string;
};

export type DemoMossCredential = {
  /** Masked display only (e.g. *****0554). */
  display: string;
  connectedAt: number;
  registrationEmail: string;
  /**
   * Obfuscated local cache for demo session recovery — not plaintext digits,
   * never written to sync storage or logs.
   */
  localCipher: string;
  ownerUserId: string;
  ownerEmail: string;
};

export type DeviceTrialStatus = {
  claimed: boolean;
  claimedAt?: number | undefined;
  email?: string | undefined;
};

type StoredAccounts = Record<string, { passwordHash: string; createdAt: number }>;

function isEmail(value: string): boolean {
  return mossId.isEmail(value);
}

function normalizePlanId(value: unknown): PlanId {
  if (value === "batch") return "batch";
  if (value === "trial") return "trial";
  return "pair";
}

function normalizeEntitlement(value: Partial<DemoEntitlement> | null | undefined): DemoEntitlement | null {
  if (!value || typeof value.remaining !== "number" || typeof value.total !== "number") {
    return null;
  }
  const planId = normalizePlanId(value.planId);
  const plan = PLANS[planId];
  return {
    remaining: value.remaining,
    total: value.total,
    maxFilesPerRun:
      typeof value.maxFilesPerRun === "number" ? value.maxFilesPerRun : plan.maxFilesPerRun,
    purchasedAt: typeof value.purchasedAt === "number" ? value.purchasedAt : Date.now(),
    planId,
    mode: value.mode === "batch" ? "batch" : plan.mode,
    allowsDirectory: Boolean(value.allowsDirectory ?? plan.allowsDirectory),
    ownerUserId: typeof value.ownerUserId === "string" ? value.ownerUserId : "",
    ownerEmail: typeof value.ownerEmail === "string" ? value.ownerEmail : "",
  };
}

/** Demo-only FNV-1a style hash — not a production KDF. */
export function demoPasswordHash(password: string): string {
  let hash = 2166136261;
  const input = `moss-demo-v1:${password}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Reversible local obfuscation for demo vault cache (not server envelope encryption). */
export function obfuscateMossUserId(digits: string): string {
  const salt = "moss-local-vault-v1";
  const mixed = Array.from(String(digits), (ch, i) =>
    String.fromCharCode(ch.charCodeAt(0) ^ salt.charCodeAt(i % salt.length)),
  ).join("");
  return btoa(`${salt}:${mixed}`);
}

export function deobfuscateMossUserId(cipher: string): string | null {
  try {
    const decoded = atob(cipher);
    const prefix = "moss-local-vault-v1:";
    if (!decoded.startsWith(prefix)) return null;
    const mixed = decoded.slice(prefix.length);
    const salt = "moss-local-vault-v1";
    return Array.from(mixed, (ch, i) =>
      String.fromCharCode(ch.charCodeAt(0) ^ salt.charCodeAt(i % salt.length)),
    ).join("");
  } catch {
    return null;
  }
}

async function loadAccountsBag(): Promise<StoredAccounts> {
  const bag = await browser.storage.local.get(ACCOUNTS_KEY);
  const value = bag[ACCOUNTS_KEY] as StoredAccounts | undefined;
  return value && typeof value === "object" ? { ...value } : {};
}

/** Ensures the fixed demo account exists for immediate local testing. */
export async function ensureDemoAccountSeeded(): Promise<void> {
  const accounts = await loadAccountsBag();
  const email = DEMO_LOGIN.email;
  const expected = demoPasswordHash(DEMO_LOGIN.password);
  if (accounts[email]?.passwordHash !== expected) {
    accounts[email] = { passwordHash: expected, createdAt: Date.now() };
    await browser.storage.local.set({ [ACCOUNTS_KEY]: accounts });
  }
}

export async function loadDemoAccount(): Promise<DemoAccount | null> {
  await ensureDemoAccountSeeded();
  const bag = await browser.storage.local.get(ACCOUNT_KEY);
  const value = bag[ACCOUNT_KEY] as DemoAccount | undefined;
  if (!value || typeof value.email !== "string") return null;
  return value;
}

export async function createDemoAccount(
  email: string,
  password: string,
): Promise<{ ok: true; account: DemoAccount } | { ok: false; error: string }> {
  await ensureDemoAccountSeeded();
  const trimmed = email.trim().toLowerCase();
  if (!isEmail(trimmed)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!password || password.length < 6) {
    return { ok: false, error: "Use a password with at least 6 characters (demo only — not sent to a server)." };
  }
  const accounts = await loadAccountsBag();
  if (accounts[trimmed] && trimmed !== DEMO_LOGIN.email) {
    return { ok: false, error: "That demo account already exists. Sign in instead." };
  }
  accounts[trimmed] = { passwordHash: demoPasswordHash(password), createdAt: Date.now() };
  const account: DemoAccount = { email: trimmed, signedInAt: Date.now() };
  await browser.storage.local.set({ [ACCOUNTS_KEY]: accounts, [ACCOUNT_KEY]: account });
  return { ok: true, account };
}

export async function signInDemoAccount(
  email: string,
  password: string,
): Promise<{ ok: true; account: DemoAccount } | { ok: false; error: string }> {
  await ensureDemoAccountSeeded();
  const trimmed = email.trim().toLowerCase();
  if (!isEmail(trimmed)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!password || password.length < 6) {
    return { ok: false, error: "Use a password with at least 6 characters (demo only — not sent to a server)." };
  }
  const accounts = await loadAccountsBag();
  const record = accounts[trimmed];
  if (!record || record.passwordHash !== demoPasswordHash(password)) {
    return { ok: false, error: "Email or password does not match a local demo account." };
  }
  const account: DemoAccount = { email: trimmed, signedInAt: Date.now() };
  await browser.storage.local.set({ [ACCOUNT_KEY]: account });
  return { ok: true, account };
}

/** @deprecated Prefer createDemoAccount / signInDemoAccount — kept for older call sites. */
export async function saveDemoAccount(
  email: string,
  password = DEMO_LOGIN.password,
): Promise<{ ok: true; account: DemoAccount } | { ok: false; error: string }> {
  return createDemoAccount(email, password);
}

export async function clearDemoAccount(): Promise<void> {
  await browser.storage.local.remove([ACCOUNT_KEY, ENTITLEMENT_KEY, MOSS_CRED_KEY, RELEASED_RUNS_KEY]);
}

/**
 * Drop local purchase / Moss vault when they belong to a different account.
 * Prevents a new signup on the same PC from skipping pricing / Moss ID.
 */
export async function syncLocalStateForAccount(owner: {
  userId: string;
  email: string;
}): Promise<{ entitlement: DemoEntitlement | null; moss: DemoMossCredential | null }> {
  const ownerUserId = String(owner.userId || "").trim();
  const ownerEmail = String(owner.email || "").trim().toLowerCase();
  const [rawEntitlement, rawMoss] = await Promise.all([loadDemoEntitlement(), loadDemoMossCredential()]);

  let entitlement = rawEntitlement;
  if (
    entitlement &&
    ownerUserId &&
    entitlement.ownerUserId &&
    entitlement.ownerUserId !== ownerUserId
  ) {
    await browser.storage.local.remove([ENTITLEMENT_KEY, RELEASED_RUNS_KEY]);
    entitlement = null;
  } else if (entitlement && !entitlement.ownerUserId && ownerUserId) {
    // Legacy unscoped purchase on this device — do not inherit onto a new account.
    await browser.storage.local.remove([ENTITLEMENT_KEY, RELEASED_RUNS_KEY]);
    entitlement = null;
  }

  let moss = rawMoss;
  if (moss && ownerUserId && moss.ownerUserId && moss.ownerUserId !== ownerUserId) {
    await browser.storage.local.remove(MOSS_CRED_KEY);
    moss = null;
  } else if (moss && !moss.ownerUserId && ownerUserId) {
    await browser.storage.local.remove(MOSS_CRED_KEY);
    moss = null;
  }

  return { entitlement, moss };
}

export async function loadDemoEntitlement(): Promise<DemoEntitlement | null> {
  const bag = await browser.storage.local.get(ENTITLEMENT_KEY);
  return normalizeEntitlement(bag[ENTITLEMENT_KEY] as Partial<DemoEntitlement> | undefined);
}

async function resolveOwner(explicit?: { userId?: string | undefined; email?: string | undefined }) {
  const session = await loadAuthSession();
  const userId = String(explicit?.userId || session?.userId || "").trim();
  const email = String(explicit?.email || session?.email || "").trim().toLowerCase();
  if (!userId || !email) {
    return { ok: false as const, error: "Sign in before unlocking a plan." };
  }
  return { ok: true as const, userId, email };
}

export async function purchaseDemoEntitlement(
  planId: PlanId = "pair",
  owner?: { userId?: string | undefined; email?: string | undefined },
): Promise<DemoEntitlement> {
  if (planId === "trial") {
    throw new Error("Use claimDeviceTrial for the free demo.");
  }
  const resolved = await resolveOwner(owner);
  if (!resolved.ok) throw new Error(resolved.error);
  const plan = PLANS[planId] || PLANS.pair;
  const entitlement: DemoEntitlement = {
    remaining: plan.runs,
    total: plan.runs,
    maxFilesPerRun: plan.maxFilesPerRun,
    purchasedAt: Date.now(),
    planId: plan.id,
    mode: plan.mode,
    allowsDirectory: plan.allowsDirectory,
    ownerUserId: resolved.userId,
    ownerEmail: resolved.email,
  };
  await browser.storage.local.set({ [ENTITLEMENT_KEY]: entitlement });
  return entitlement;
}

export async function loadDeviceTrialStatus(): Promise<DeviceTrialStatus> {
  const deviceId = await ensureDeviceId();
  const local = await browser.storage.local.get(DEVICE_TRIAL_KEY);
  const localClaim = local[DEVICE_TRIAL_KEY] as DeviceTrialStatus | undefined;

  if (!isAllowedOrigin(`${API_ORIGIN}/`)) {
    return localClaim?.claimed
      ? { claimed: true, claimedAt: localClaim.claimedAt, email: localClaim.email }
      : { claimed: false };
  }

  try {
    const response = await fetch(`${API_ORIGIN}/v1/auth/device-trial?deviceId=${encodeURIComponent(deviceId)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      claimed?: boolean;
      claimedAt?: number;
      email?: string;
    };
    if (response.ok && data.ok !== false) {
      const status: DeviceTrialStatus = {
        claimed: Boolean(data.claimed),
        claimedAt: typeof data.claimedAt === "number" ? data.claimedAt : undefined,
        email: typeof data.email === "string" ? data.email : undefined,
      };
      await browser.storage.local.set({ [DEVICE_TRIAL_KEY]: status });
      return status;
    }
  } catch {
    /* fall through to local mirror */
  }

  return localClaim?.claimed
    ? { claimed: true, claimedAt: localClaim.claimedAt, email: localClaim.email }
    : { claimed: false };
}

/**
 * One free Pair Check per PC (deviceId). New accounts on the same computer cannot claim again.
 * Server records the claim when reachable; local storage mirrors it for offline UX.
 */
export async function claimDeviceTrial(owner?: {
  userId?: string | undefined;
  email?: string | undefined;
}): Promise<
  { ok: true; entitlement: DemoEntitlement } | { ok: false; error: string }
> {
  const resolved = await resolveOwner(owner);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const deviceId = await ensureDeviceId();
  const session = await loadAuthSession();

  if (isAllowedOrigin(`${API_ORIGIN}/`)) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
      const response = await fetch(`${API_ORIGIN}/v1/auth/claim-device-trial`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          deviceId,
          email: resolved.email,
          userId: resolved.userId,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        claimed?: boolean;
      };
      if (!response.ok || data.ok === false) {
        if (data.error === "device-trial-used" || data.claimed) {
          await browser.storage.local.set({
            [DEVICE_TRIAL_KEY]: {
              claimed: true,
              claimedAt: Date.now(),
              email: resolved.email,
            },
          });
          return {
            ok: false,
            error: "This PC already used its free demo check. Choose a paid plan to continue.",
          };
        }
        return {
          ok: false,
          error:
            data.error === "unauthorized"
              ? "Sign in again, then claim the free demo."
              : "Could not claim the free demo. Try again or choose a paid plan.",
        };
      }
    } catch {
      return {
        ok: false,
        error: "Cannot reach the API to claim the free demo. Check Railway, then try again.",
      };
    }
  }

  const local = await browser.storage.local.get(DEVICE_TRIAL_KEY);
  const existing = local[DEVICE_TRIAL_KEY] as DeviceTrialStatus | undefined;
  if (existing?.claimed) {
    return {
      ok: false,
      error: "This PC already used its free demo check. Choose a paid plan to continue.",
    };
  }

  const plan = PLANS.trial;
  const entitlement: DemoEntitlement = {
    remaining: plan.runs,
    total: plan.runs,
    maxFilesPerRun: plan.maxFilesPerRun,
    purchasedAt: Date.now(),
    planId: plan.id,
    mode: plan.mode,
    allowsDirectory: plan.allowsDirectory,
    ownerUserId: resolved.userId,
    ownerEmail: resolved.email,
  };
  await browser.storage.local.set({
    [ENTITLEMENT_KEY]: entitlement,
    [DEVICE_TRIAL_KEY]: {
      claimed: true,
      claimedAt: Date.now(),
      email: resolved.email,
    },
  });
  return { ok: true, entitlement };
}

export async function consumeDemoRun(): Promise<
  { ok: true; entitlement: DemoEntitlement } | { ok: false; error: string }
> {
  const current = await loadDemoEntitlement();
  if (!current) {
    return { ok: false, error: "Purchase required before starting a run." };
  }
  if (current.remaining < 1) {
    return { ok: false, error: "No runs remaining. Purchase again when billing is live." };
  }
  const entitlement: DemoEntitlement = {
    ...current,
    remaining: current.remaining - 1,
  };
  await browser.storage.local.set({ [ENTITLEMENT_KEY]: entitlement });
  return { ok: true, entitlement };
}

async function loadReleasedRuns(): Promise<string[]> {
  const bag = await browser.storage.local.get(RELEASED_RUNS_KEY);
  const value = bag[RELEASED_RUNS_KEY];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/**
 * Give a consumed run back when the attempt ended without anything being submitted.
 * Releases are keyed by run reference so a recovered terminal job never refunds twice.
 */
export async function releaseDemoRun(
  runRef: string,
): Promise<{ ok: true; entitlement: DemoEntitlement } | { ok: false; error: string }> {
  const current = await loadDemoEntitlement();
  if (!current) {
    return { ok: false, error: "No entitlement to credit." };
  }
  const key = String(runRef || "").trim();
  if (!key) {
    return { ok: false, error: "A run reference is required to release a run." };
  }
  const released = await loadReleasedRuns();
  if (released.includes(key)) {
    return { ok: true, entitlement: current };
  }
  const entitlement: DemoEntitlement = {
    ...current,
    remaining: Math.min(current.total, current.remaining + 1),
  };
  await browser.storage.local.set({
    [ENTITLEMENT_KEY]: entitlement,
    [RELEASED_RUNS_KEY]: [...released, key].slice(-RELEASED_RUNS_MAX),
  });
  return { ok: true, entitlement };
}

/** Active package with at least one run left — exhausted packages return to pricing. */
export function isEntitled(entitlement: DemoEntitlement | null): boolean {
  return Boolean(entitlement && entitlement.remaining > 0 && entitlement.total > 0);
}

export async function loadDemoMossCredential(): Promise<DemoMossCredential | null> {
  const bag = await browser.storage.local.get(MOSS_CRED_KEY);
  const value = bag[MOSS_CRED_KEY] as DemoMossCredential | undefined;
  if (!value || typeof value.display !== "string" || !value.localCipher) return null;
  return value;
}

export function isMossConnected(credential: DemoMossCredential | null): boolean {
  return Boolean(credential && credential.display && credential.localCipher);
}

/**
 * Persist a BYO Moss userid using local vault-style storage:
 * masked display + obfuscated cipher only — never sync, never log plaintext.
 */
export async function saveDemoMossCredential(
  mossUserId: string,
  registrationEmail: string,
  owner?: { userId?: string | undefined; email?: string | undefined },
): Promise<{ ok: true; credential: DemoMossCredential } | { ok: false; error: string }> {
  const masked = mossId.maskMossUserId(mossUserId);
  if (!masked.ok) {
    return { ok: false, error: masked.error || "Invalid Moss User ID." };
  }
  if (!isEmail(registrationEmail)) {
    return { ok: false, error: "Enter the email you used for Moss registration." };
  }
  const resolved = await resolveOwner(owner);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const credential: DemoMossCredential = {
    display: masked.masked,
    connectedAt: Date.now(),
    registrationEmail: registrationEmail.trim(),
    localCipher: obfuscateMossUserId(masked.digits),
    ownerUserId: resolved.userId,
    ownerEmail: resolved.email,
  };
  await browser.storage.local.set({ [MOSS_CRED_KEY]: credential });
  return { ok: true, credential };
}

export async function clearDemoMossCredential(): Promise<void> {
  await browser.storage.local.remove(MOSS_CRED_KEY);
}
