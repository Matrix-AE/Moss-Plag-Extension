// Origins the production extension may contact.
// Raw provider TCP never runs in the browser (ADR-0010 / ADR-0005B).
// Loopback is opt-in for `wxt dev` only — never the store / production default.

export const API_ORIGIN = "https://api.mossworkflow.dev";
export const UPLOAD_ORIGIN = "https://uploads.mossworkflow.dev";
export const LOCAL_API_ORIGIN = "http://127.0.0.1:8787";

/** True only when VITE_MOSS_USE_LOCAL_API=1 (developer opt-in; never store default). */
export const USE_LOCAL_API = import.meta.env.VITE_MOSS_USE_LOCAL_API === "1";

export const ALLOWED_ORIGINS = (
  USE_LOCAL_API ? [API_ORIGIN, UPLOAD_ORIGIN, LOCAL_API_ORIGIN] : [API_ORIGIN, UPLOAD_ORIGIN]
) as readonly string[];

export function isAllowedOrigin(url: string): boolean {
  try {
    return ALLOWED_ORIGINS.includes(new URL(url).origin);
  } catch {
    return false;
  }
}
