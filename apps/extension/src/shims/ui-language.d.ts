export const LANGUAGE_VERSION: number;
export const EMPTY_CAPABILITIES: {
  fetchedAt: null;
  languages: readonly never[];
  aliases: Record<string, never>;
};
export const MOSS_LANGUAGE_CODES: readonly string[];
export function createMossCapabilitiesFixture(options?: { fetchedAt?: string }): {
  fetchedAt: string;
  languages: readonly { code: string; label: string; extensions: readonly string[] }[];
  aliases: Record<string, string>;
};
export function normalizeCapabilities(payload: unknown): {
  ok: boolean;
  error?: string;
  capabilities: {
    fetchedAt: string | null;
    languages: readonly { code: string; label: string; extensions: readonly string[] }[];
    aliases: Record<string, string>;
  };
};
export function suggestLanguage(
  files: Array<{ displayName?: string; name?: string }>,
  capabilities: unknown,
): {
  ok?: boolean;
  suggestion: { code: string; label: string } | null;
  confidence?: string;
  guidance?: string;
  requiresConfirmation: boolean;
  error?: string;
};
export function resolveManualSelection(
  input: string,
  capabilities: unknown,
): { ok: boolean; code?: string; label?: string; error?: string };
export function searchLanguages(
  query: string,
  capabilities: unknown,
): Array<{ code: string; label: string; extensions: readonly string[] }>;
export function isStale(capabilities: unknown, options?: { maxAgeMs?: number; now?: number }): boolean;
