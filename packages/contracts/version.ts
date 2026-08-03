export type ApiVersion = "v1";

export const DEFAULT_CONSENT_POLICY_VERSION = "1.0.0" as const;

export function isApiVersion(value: string): value is ApiVersion {
  return value === "v1";
}
