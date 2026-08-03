export function ingestSelection(
  rawEntries: unknown,
  options?: { existing?: unknown[]; asBase?: boolean; consentGranted?: boolean },
): {
  ok: boolean;
  sourceType: string;
  items: Array<{
    id?: string;
    key?: string;
    displayName: string;
    size?: number;
    bytes?: number;
    status: string;
    reason?: string;
    sourceType?: string;
    role?: string;
    relativePath?: string;
    webkitRelativePath?: string;
    groupingHint?: string | null;
    localOnly?: boolean;
  }>;
  summary: unknown;
  uploaded: boolean;
  error?: string;
};
