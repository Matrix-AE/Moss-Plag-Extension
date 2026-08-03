// Origins the extension may contact. Hosted relay + local loopback API for BYO MOSS testing.
// Raw provider TCP never runs in the browser (ADR-0010 / ADR-0005B).
export const API_ORIGIN = "https://api.mossworkflow.dev";
export const UPLOAD_ORIGIN = "https://uploads.mossworkflow.dev";
export const LOCAL_API_ORIGIN = "http://127.0.0.1:8787";

export const ALLOWED_ORIGINS = [API_ORIGIN, UPLOAD_ORIGIN, LOCAL_API_ORIGIN] as const;

export function isAllowedOrigin(url: string): boolean {
  try {
    return ALLOWED_ORIGINS.includes(new URL(url).origin as (typeof ALLOWED_ORIGINS)[number]);
  } catch {
    return false;
  }
}
