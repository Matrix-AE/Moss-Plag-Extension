export const CONSENT_POLICY_VERSION: string;
export function buildReviewSummary(
  draft: unknown,
  options?: { entitlement?: unknown; retentionHours?: number },
): {
  mode?: string;
  language?: string | null;
  groups?: unknown[];
  totalBytes?: number;
};
export function createConsentState(): {
  ownership: boolean;
  sensitiveLink: boolean;
  policyVersion: string | null;
  recordedAt: string | null;
};
export function recordConsent(
  consent: unknown,
  options: { ownership: boolean; sensitiveLink: boolean; policyVersion?: string },
): { ok: boolean; consent?: unknown; error?: string };
