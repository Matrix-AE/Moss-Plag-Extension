import { browser } from "wxt/browser";
import * as mossId from "@moss/ui/moss-id";

export type PlanId = "pair" | "batch";

/** Sold packages shown after signup (demo local entitlement until Paddle). */
export const PLANS = Object.freeze({
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

export const PLAN_LIST = Object.freeze([PLANS.pair, PLANS.batch]);

/** @deprecated Prefer PLANS.pair — kept so older copy/tests still resolve the $15 Pair offer. */
export const OFFER = Object.freeze({
  priceUsd: PLANS.pair.priceUsd,
  runs: PLANS.pair.runs,
  maxFilesPerRun: PLANS.pair.maxFilesPerRun,
  /** Prompt 006 historically modeled 40 checks; Pair package sells 15 runs / max 2 files. */
  note: "Offer display uses 15 runs / max 2 files per run (updated from the Prompt 006 40-check model). Batch is a separate $50 / 50-run package.",
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

export type DemoAccount = {
  email: string;
  signedInAt: number;
};

export type DemoEntitlement = {
  remaining: number;
  total: number;
  maxFilesPerRun: number;
  purchasedAt: number;
  planId: PlanId;
  mode: "pair" | "batch";
  allowsDirectory: boolean;
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
};

type StoredAccounts = Record<string, { passwordHash: string; createdAt: number }>;

function isEmail(value: string): boolean {
  return mossId.isEmail(value);
}

function normalizeEntitlement(value: Partial<DemoEntitlement> | null | undefined): DemoEntitlement | null {
  if (!value || typeof value.remaining !== "number" || typeof value.total !== "number") {
    return null;
  }
  const planId: PlanId = value.planId === "batch" ? "batch" : "pair";
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

export async function loadDemoEntitlement(): Promise<DemoEntitlement | null> {
  const bag = await browser.storage.local.get(ENTITLEMENT_KEY);
  return normalizeEntitlement(bag[ENTITLEMENT_KEY] as Partial<DemoEntitlement> | undefined);
}

export async function purchaseDemoEntitlement(planId: PlanId = "pair"): Promise<DemoEntitlement> {
  const plan = PLANS[planId] || PLANS.pair;
  const entitlement: DemoEntitlement = {
    remaining: plan.runs,
    total: plan.runs,
    maxFilesPerRun: plan.maxFilesPerRun,
    purchasedAt: Date.now(),
    planId: plan.id,
    mode: plan.mode,
    allowsDirectory: plan.allowsDirectory,
  };
  await browser.storage.local.set({ [ENTITLEMENT_KEY]: entitlement });
  return entitlement;
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

export function isEntitled(entitlement: DemoEntitlement | null): boolean {
  return Boolean(entitlement && entitlement.remaining >= 0 && entitlement.total > 0);
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
): Promise<{ ok: true; credential: DemoMossCredential } | { ok: false; error: string }> {
  const masked = mossId.maskMossUserId(mossUserId);
  if (!masked.ok) {
    return { ok: false, error: masked.error || "Invalid Moss User ID." };
  }
  if (!isEmail(registrationEmail)) {
    return { ok: false, error: "Enter the email you used for Moss registration." };
  }
  const credential: DemoMossCredential = {
    display: masked.masked,
    connectedAt: Date.now(),
    registrationEmail: registrationEmail.trim(),
    localCipher: obfuscateMossUserId(masked.digits),
  };
  await browser.storage.local.set({ [MOSS_CRED_KEY]: credential });
  return { ok: true, credential };
}

export async function clearDemoMossCredential(): Promise<void> {
  await browser.storage.local.remove(MOSS_CRED_KEY);
}
