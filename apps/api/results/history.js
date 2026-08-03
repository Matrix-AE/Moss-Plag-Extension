"use strict";

/**
 * Owner-scoped result history (Prompt 068).
 * Searchable recent jobs without source or plaintext URLs in lists.
 */

const HISTORY_VERSION = 1;

function createHistoryService({ now = () => Date.now() } = {}) {
  const rows = new Map();

  function record(entry) {
    if (!entry?.jobId || !entry.ownerUserId) return { ok: false, error: "invalid" };
    const row = {
      jobId: entry.jobId,
      ownerUserId: entry.ownerUserId,
      title: sanitizeTitle(entry.title),
      mode: entry.mode || null,
      language: entry.language || null,
      state: entry.state || "succeeded",
      completedAt: entry.completedAt ?? now(),
      estimate: entry.estimate || null,
      hasReportUrl: !!entry.hasReportUrl,
      urlForgotten: false,
      settings: entry.settings ? { ...entry.settings } : null,
      updatedAt: now(),
    };
    rows.set(entry.jobId, row);
    return { ok: true, jobId: row.jobId };
  }

  function list({
    ownerUserId,
    limit = 20,
    offset = 0,
    mode = null,
    language = null,
    state = null,
  } = {}) {
    let items = [...rows.values()].filter((r) => r.ownerUserId === ownerUserId);
    if (mode) items = items.filter((r) => r.mode === mode);
    if (language) items = items.filter((r) => r.language === language);
    if (state) items = items.filter((r) => r.state === state);
    items.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    const total = items.length;
    const page = items.slice(offset, offset + limit).map(projectListItem);
    return { ok: true, items: page, total, limit, offset };
  }

  function get(jobId, { ownerUserId } = {}) {
    const row = rows.get(jobId);
    if (!row) return { ok: false, error: "not-found" };
    if (row.ownerUserId !== ownerUserId) return { ok: false, error: "tenant-isolation" };
    return {
      ok: true,
      ...projectListItem(row),
      historyRetained: true,
    };
  }

  function forgetLink(jobId, { ownerUserId } = {}) {
    const row = rows.get(jobId);
    if (!row) return { ok: false, error: "not-found" };
    if (row.ownerUserId !== ownerUserId) return { ok: false, error: "tenant-isolation" };
    row.hasReportUrl = false;
    row.urlForgotten = true;
    row.updatedAt = now();
    return {
      ok: true,
      claimsProviderRevocation: false,
      message: "Link forgotten; minimal history retained.",
    };
  }

  function deleteHistory(jobId, { ownerUserId } = {}) {
    const row = rows.get(jobId);
    if (!row) return { ok: false, error: "not-found" };
    if (row.ownerUserId !== ownerUserId) return { ok: false, error: "tenant-isolation" };
    if (!isTerminal(row.state)) return { ok: false, error: "active-job" };
    rows.delete(jobId);
    return { ok: true, message: "History entry deleted." };
  }

  function prepareRerun(jobId, { ownerUserId } = {}) {
    const row = rows.get(jobId);
    if (!row) return { ok: false, error: "not-found" };
    if (row.ownerUserId !== ownerUserId) return { ok: false, error: "tenant-isolation" };
    return {
      ok: true,
      restore: {
        title: row.title,
        mode: row.mode,
        language: row.language,
        settings: row.settings ? { ...row.settings } : {},
        sourceCleared: true,
        mandatoryReselection: true,
        files: undefined,
        paths: undefined,
      },
    };
  }

  function purgeOwner(ownerUserId) {
    let removed = 0;
    for (const [id, row] of rows) {
      if (row.ownerUserId === ownerUserId) {
        rows.delete(id);
        removed += 1;
      }
    }
    return { ok: true, removed };
  }

  function persistencePolicy() {
    return {
      browserSync: false,
      plaintextUrlsInLists: false,
      sourcePreviews: false,
      originalPaths: false,
    };
  }

  return {
    record,
    list,
    get,
    forgetLink,
    deleteHistory,
    prepareRerun,
    purgeOwner,
    persistencePolicy,
    HISTORY_VERSION,
  };
}

function projectListItem(row) {
  return {
    jobId: row.jobId,
    title: row.title,
    mode: row.mode,
    language: row.language,
    date: row.completedAt,
    state: row.state,
    estimate: row.estimate,
    hasReportUrl: row.hasReportUrl && !row.urlForgotten,
    urlForgotten: !!row.urlForgotten,
    // Explicitly omitted: ownerUserId, reportUrl, originalPath, sourcePreview, filenames
  };
}

function sanitizeTitle(title) {
  return String(title || "Untitled").replace(/[<>\u0000-\u001f]/g, "").slice(0, 120);
}

function isTerminal(state) {
  return state === "succeeded" || state === "failed" || state === "canceled";
}

function validateResultHistoryModule() {
  const errors = [];
  const h = createHistoryService();
  h.record({
    jobId: "a",
    ownerUserId: "u",
    title: "A",
    mode: "pair",
    language: "python",
    state: "succeeded",
    completedAt: 2,
    hasReportUrl: true,
  });
  h.record({
    jobId: "b",
    ownerUserId: "u",
    title: "B",
    mode: "batch",
    language: "java",
    state: "failed",
    completedAt: 1,
    hasReportUrl: false,
  });
  h.record({
    jobId: "c",
    ownerUserId: "other",
    title: "C",
    mode: "pair",
    language: "python",
    state: "succeeded",
    completedAt: 3,
    hasReportUrl: true,
  });

  const page = h.list({ ownerUserId: "u", limit: 1 });
  if (page.total !== 2 || page.items.length !== 1) errors.push("page");
  if (page.items[0].reportUrl != null || page.items[0].ownerUserId != null) errors.push("projection");

  h.forgetLink("a", { ownerUserId: "u" });
  if (h.get("a", { ownerUserId: "u" }).hasReportUrl) errors.push("forget");

  h.record({
    jobId: "live",
    ownerUserId: "u",
    title: "Live",
    mode: "pair",
    language: "python",
    state: "queued",
    hasReportUrl: false,
  });
  if (h.deleteHistory("live", { ownerUserId: "u" }).error !== "active-job") errors.push("active");
  if (!h.deleteHistory("b", { ownerUserId: "u" }).ok) errors.push("delete");

  const rerun = h.prepareRerun("a", { ownerUserId: "u" });
  if (!rerun.restore.mandatoryReselection || rerun.restore.files) errors.push("rerun");

  if (h.list({ ownerUserId: "u" }).items.some((i) => i.jobId === "c")) errors.push("tenant");
  if (h.persistencePolicy().browserSync) errors.push("sync");

  return { ok: errors.length === 0, errors, version: HISTORY_VERSION };
}

module.exports = {
  HISTORY_VERSION,
  createHistoryService,
  validateResultHistoryModule,
};
