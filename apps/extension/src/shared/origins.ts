// Single source of truth for the only two remote origins the extension may contact.
// Anything else must go through the hosted relay (ADR-0010).
export const API_ORIGIN = "https://api.mossworkflow.dev";
export const UPLOAD_ORIGIN = "https://uploads.mossworkflow.dev";

export const ALLOWED_ORIGINS = [API_ORIGIN, UPLOAD_ORIGIN] as const;

export function isAllowedOrigin(url: string): boolean {
  try {
    return ALLOWED_ORIGINS.includes(new URL(url).origin as (typeof ALLOWED_ORIGINS)[number]);
  } catch {
    return false;
  }
}
