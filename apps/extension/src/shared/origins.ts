// Origins the production extension may contact.
// Raw provider TCP never runs in the browser (ADR-0010 / ADR-0005B).
// Override with VITE_MOSS_API_ORIGIN at build time if the Railway URL changes.

function stripTrailingSlash(value: string): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

/** Live Railway API (Chrome Store / production default). */
const DEFAULT_API = "https://mossapi-production.up.railway.app";

export const API_ORIGIN = stripTrailingSlash(
  import.meta.env.VITE_MOSS_API_ORIGIN || DEFAULT_API,
);

export const UPLOAD_ORIGIN = stripTrailingSlash(
  import.meta.env.VITE_MOSS_UPLOAD_ORIGIN || API_ORIGIN,
);

export const ALLOWED_ORIGINS = [...new Set([API_ORIGIN, UPLOAD_ORIGIN])] as readonly string[];

export function isAllowedOrigin(url: string): boolean {
  try {
    return ALLOWED_ORIGINS.includes(new URL(url).origin);
  } catch {
    return false;
  }
}
