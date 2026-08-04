/**
 * Local past-result history for the popup.
 * Stores allowlisted report links on this device so teachers can reopen earlier runs.
 * Links are sensitive (anyone with the URL can view the report) — never sync.
 */

import { browser } from "wxt/browser";

const HISTORY_KEY = "moss.demo.resultHistory";
const HISTORY_MAX = 40;

export type ResultHistoryEntry = {
  id: string;
  jobId: string;
  reportUrl: string;
  language: string | null;
  label: string;
  mode: "live" | "demo";
  createdAt: number;
};

function isAllowedReportUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.username || u.password) return false;
    if (u.protocol === "https:" && u.hostname === "mock.local") return true;
    if (
      (u.protocol === "http:" || u.protocol === "https:") &&
      /(^|\.)moss\.stanford\.edu$/i.test(u.hostname)
    ) {
      return true;
    }
    // Extension-local demo report pages
    if (u.protocol === "chrome-extension:" && u.pathname.endsWith("/report.html")) return true;
  } catch {
    return false;
  }
  return false;
}

export async function loadResultHistory(): Promise<ResultHistoryEntry[]> {
  const bag = await browser.storage.local.get(HISTORY_KEY);
  const value = bag[HISTORY_KEY];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ResultHistoryEntry =>
      Boolean(
        item &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          typeof item.jobId === "string" &&
          typeof item.reportUrl === "string" &&
          typeof item.createdAt === "number" &&
          isAllowedReportUrl(item.reportUrl),
      ),
  );
}

export async function rememberResult(input: {
  jobId: string;
  reportUrl: string;
  language?: string | null;
  label?: string;
  mode: "live" | "demo";
}): Promise<{ ok: true; entries: ResultHistoryEntry[] } | { ok: false; error: string }> {
  if (!input.jobId || !isAllowedReportUrl(input.reportUrl)) {
    return { ok: false, error: "invalid-result" };
  }
  const current = await loadResultHistory();
  const withoutDup = current.filter((entry) => entry.jobId !== input.jobId);
  const entry: ResultHistoryEntry = {
    id: `hist_${Date.now().toString(36)}`,
    jobId: input.jobId,
    reportUrl: input.reportUrl,
    language: input.language || null,
    label: String(input.label || "Pair Check").slice(0, 80),
    mode: input.mode,
    createdAt: Date.now(),
  };
  const entries = [entry, ...withoutDup].slice(0, HISTORY_MAX);
  await browser.storage.local.set({ [HISTORY_KEY]: entries });
  return { ok: true, entries };
}

export async function forgetHistoryEntry(
  id: string,
): Promise<{ ok: true; entries: ResultHistoryEntry[] }> {
  const current = await loadResultHistory();
  const entries = current.filter((entry) => entry.id !== id);
  await browser.storage.local.set({ [HISTORY_KEY]: entries });
  return { ok: true, entries };
}

export async function clearResultHistory(): Promise<void> {
  await browser.storage.local.remove(HISTORY_KEY);
}
