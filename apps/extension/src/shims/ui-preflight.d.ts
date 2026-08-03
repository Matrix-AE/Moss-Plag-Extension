export const DEFAULT_LIMITS: Record<string, number>;
export function runPreflight(
  draft: unknown,
  options?: { limits?: unknown; hashes?: unknown[] },
): {
  ok: boolean;
  canProceed: boolean;
  errors: Array<{ code: string; message: string; blocking?: boolean }>;
  warnings: Array<{ code: string; message: string; blocking?: boolean }>;
  acknowledgedWarnings: boolean;
};
