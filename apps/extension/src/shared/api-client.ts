/**
 * Hosted API client for the popup Pair Check flow.
 * Production talks only to https://api.mossworkflow.dev.
 * Loopback is available only in explicit local-dev builds (VITE_MOSS_USE_LOCAL_API=1).
 */

import { API_ORIGIN, LOCAL_API_ORIGIN, USE_LOCAL_API, isAllowedOrigin } from "./origins";

export { LOCAL_API_ORIGIN, USE_LOCAL_API };

/** Production / store builds always use the hosted API. */
export function resolveApiOrigin(): string {
  if (USE_LOCAL_API) return LOCAL_API_ORIGIN;
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
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Owner-User-Id": ownerUserId,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
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
    return {
      ok: Boolean(data.ok),
      submitMode: data.submitMode,
      livePublicTcp: data.livePublicTcp,
      origin,
    };
  } catch {
    return { ok: false, origin };
  }
}

/** @deprecated Use probeApi — kept as alias during the production cutover. */
export const probeLocalApi = probeApi;

export async function createPairJob(input: {
  ownerUserId: string;
  language: string;
  idempotencyKey: string;
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
      mode: "pair",
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
  files: Array<{ displayName: string; bytesBase64: string }>;
}) {
  return apiFetch(`/v1/jobs/${encodeURIComponent(input.jobId)}/uploads`, {
    method: "POST",
    ownerUserId: input.ownerUserId,
    body: {
      files: input.files.map((f) => ({
        displayName: f.displayName,
        bytes: f.bytesBase64,
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
