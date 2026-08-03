import { browser } from "wxt/browser";

/** Product offer shown in the popup paywall (demo local entitlement). */
export const OFFER = Object.freeze({
  priceUsd: 15,
  runs: 15,
  maxFilesPerRun: 2,
  /** Prompt 006 historically modeled 40 checks; product UX now sells 15 runs / max 2 files. */
  note: "Offer display uses 15 runs / max 2 files per run (updated from the Prompt 006 40-check model).",
});

const ACCOUNT_KEY = "moss.demo.account";
const ENTITLEMENT_KEY = "moss.demo.entitlement";

export type DemoAccount = {
  email: string;
  signedInAt: number;
};

export type DemoEntitlement = {
  remaining: number;
  total: number;
  maxFilesPerRun: number;
  purchasedAt: number;
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function loadDemoAccount(): Promise<DemoAccount | null> {
  const bag = await browser.storage.local.get(ACCOUNT_KEY);
  const value = bag[ACCOUNT_KEY] as DemoAccount | undefined;
  if (!value || typeof value.email !== "string") return null;
  return value;
}

export async function saveDemoAccount(email: string): Promise<{ ok: true; account: DemoAccount } | { ok: false; error: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!isEmail(trimmed)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  const account: DemoAccount = { email: trimmed, signedInAt: Date.now() };
  await browser.storage.local.set({ [ACCOUNT_KEY]: account });
  return { ok: true, account };
}

export async function clearDemoAccount(): Promise<void> {
  await browser.storage.local.remove([ACCOUNT_KEY, ENTITLEMENT_KEY]);
}

export async function loadDemoEntitlement(): Promise<DemoEntitlement | null> {
  const bag = await browser.storage.local.get(ENTITLEMENT_KEY);
  const value = bag[ENTITLEMENT_KEY] as DemoEntitlement | undefined;
  if (!value || typeof value.remaining !== "number") return null;
  return value;
}

export async function purchaseDemoEntitlement(): Promise<DemoEntitlement> {
  const entitlement: DemoEntitlement = {
    remaining: OFFER.runs,
    total: OFFER.runs,
    maxFilesPerRun: OFFER.maxFilesPerRun,
    purchasedAt: Date.now(),
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

export function isEntitled(entitlement: DemoEntitlement | null): boolean {
  return Boolean(entitlement && entitlement.remaining >= 0 && entitlement.total > 0);
}
