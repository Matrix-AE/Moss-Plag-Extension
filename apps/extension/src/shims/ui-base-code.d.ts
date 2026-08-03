export function explainBaseEffect(): { title: string; body: string };
export function addBaseFiles(
  draft: unknown,
  rawEntries: unknown,
  options?: { language?: string | null; capabilities?: unknown },
): { ok: boolean; draft?: { baseFiles?: Array<{ displayName: string; status: string }> }; added?: unknown[]; rejected?: unknown[]; error?: string };
