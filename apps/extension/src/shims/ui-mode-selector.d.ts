export function selectMode(
  currentDraft: unknown,
  mode: string,
  options?: { confirm?: boolean },
): { ok: boolean; draft?: { groups?: Array<{ id: string; label: string; files: unknown[] }> }; changed?: boolean; needsConfirm?: boolean; error?: string };
