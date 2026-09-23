/**
 * Hosted API client for the popup Pair Check flow.
 * Production talks only to the configured HTTPS API (Railway by default).
 */

import { API_ORIGIN, isAllowedOrigin } from "./origins";
import { loadAuthSession, refreshAuthSession } from "./account-session";

/** Production / store builds always use the hosted API origin. */
export function resolveApiOrigin(): string {
  return API_ORIGIN;
}

type Json = Record<string, unknown>;

async function apiFetch(
  path: string,
  {
    method = "GET",
    ownerUserId,
    body,
    origin = resolveApiOrigin(),
  }: {
    method?: string;
    ownerUserId: string;
    body?: unknown;
    origin?: string;
  },
): Promise<{ ok: boolean; status: number; data: Json }> {
  if (!isAllowedOrigin(`${origin}/`)) {
    return { ok: false, status: 0, data: { error: "origin-forbidden" } };
  }
  try {
    let session = await loadAuthSession();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Owner-User-Id": ownerUserId,
    };
    if (session?.accessToken) {
      headers.Authorization = `Bearer ${session.accessToken}`;
    }
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    let response = await fetch(`${origin}${path}`, init);
    if (response.status === 401 && session?.refreshToken) {
      session = await refreshAuthSession();
      if (session?.accessToken) {
        headers.Authorization = `Bearer ${session.accessToken}`;
        response = await fetch(`${origin}${path}`, { ...init, headers });
      }
    }
    const data = (await response.json().catch(() => ({}))) as Json;
    return { ok: response.ok && data.ok !== false, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "network" } };
  }
}

export async function probeApi(origin = resolveApiOrigin()): Promise<{
  ok: boolean;
  submitMode?: string;
  livePublicTcp?: boolean;
  origin: string;
}> {
  try {
    if (!isAllowedOrigin(`${origin}/`)) return { ok: false, origin };
    const response = await fetch(`${origin}/health`, { method: "GET" });
    if (!response.ok) return { ok: false, origin };
    const data = (await response.json()) as {
      ok?: boolean;
      submitMode?: string;
      livePublicTcp?: boolean;
    };
    const result: {
      ok: boolean;
      submitMode?: string;
      livePublicTcp?: boolean;
      origin: string;
    } = {
      ok: Boolean(data.ok),
      origin,
    };
    if (data.submitMode !== undefined) result.submitMode = data.submitMode;
    if (data.livePublicTcp !== undefined) result.livePublicTcp = data.livePublicTcp;
    return result;
  } catch {
    return { ok: false, origin };
  }
}

/** @deprecated Use probeApi */
export const probeLocalApi = probeApi;

/**
 * Start a Safepay hosted-checkout session for a paid plan. Returns the
 * hosted checkout URL for the caller to open in a new tab. The entitlement is
 * granted server-side by the signed webhook (or the redirect poll), then read
 * back via getServerEntitlement.
 */
export async function startSafepayCheckout(input: { ownerUserId: string; planId: string }) {
  return apiFetch("/v1/checkout/safepay/start", {
    method: "POST",
    ownerUserId: input.ownerUserId,
    body: { planId: input.planId },
  });
}

/** Read the signed-in owner's current server entitlement (source of truth). */
export async function getServerEntitlement(input: { ownerUserId: string }) {
  return apiFetch("/v1/entitlement", {
    method: "GET",
    ownerUserId: input.ownerUserId,
  });
}

export async function createPairJob(input: {
  ownerUserId: string;
  language: string;
  idempotencyKey: string;
  mode?: "pair" | "batch";
  settings?: {
    commonMatchThreshold?: number;
    resultCount?: number;
    reportLabel?: string;
  };
}) {
  return apiFetch("/v1/jobs", {
    method: "POST",
    ownerUserId: input.ownerUserId,
    body: {
      language: input.language,
      mode: input.mode || "pair",
      idempotencyKey: input.idempotencyKey,
      settings: input.settings || {},
    },
  });
}

export async function attachMossCredential(input: {
  ownerUserId: string;
  jobId: string;
  mossUserId: string;
}) {
  return apiFetch(`/v1/jobs/${encodeURIComponent(input.jobId)}/credentials`, {
    method: "POST",
    ownerUserId: input.ownerUserId,
    body: { mossUserId: input.mossUserId },
  });
}

export async function uploadPairFiles(input: {
  ownerUserId: string;
  jobId: string;
  files: Array<{ displayName: string; bytesBase64: string; submissionId?: number }>;
}) {
  return apiFetch(`/v1/jobs/${encodeURIComponent(input.jobId)}/uploads`, {
    method: "POST",
    ownerUserId: input.ownerUserId,
    body: {
      files: input.files.map((f) => ({
        displayName: f.displayName,
        bytes: f.bytesBase64,
        submissionId: f.submissionId,
      })),
    },
  });
}

export async function finalizeJob(input: { ownerUserId: string; jobId: string }) {
  return apiFetch(`/v1/jobs/${encodeURIComponent(input.jobId)}/finalize`, {
    method: "POST",
    ownerUserId: input.ownerUserId,
    body: {},
  });
}

export async function getJobStatus(input: { ownerUserId: string; jobId: string }) {
  return apiFetch(`/v1/jobs/${encodeURIComponent(input.jobId)}`, {
    method: "GET",
    ownerUserId: input.ownerUserId,
  });
}

export async function revealJobResult(input: { ownerUserId: string; jobId: string }) {
  return apiFetch(`/v1/jobs/${encodeURIComponent(input.jobId)}/result/reveal`, {
    method: "POST",
    ownerUserId: input.ownerUserId,
    body: {},
  });
}

export async function forgetJobResult(input: { ownerUserId: string; jobId: string }) {
  return apiFetch(`/v1/jobs/${encodeURIComponent(input.jobId)}/result/forget`, {
    method: "POST",
    ownerUserId: input.ownerUserId,
    body: {},
  });
}

export async function fileToBase64(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Map durable API job status onto run-lifecycle phases. */
export function phaseFromJobStatus(status: string | undefined): string | null {
  switch (status) {
    case "draft":
    case "ready":
      return "validate";
    case "uploading":
      return "upload";
    case "queued":
      return "queue";
    case "submitting":
      return "submit";
    case "waiting":
      return "wait";
    case "succeeded":
      return "success";
    case "failed":
    case "cancelled":
      return "failure";
    case "ambiguous":
      return "timeout";
    default:
      return null;
  }
}
