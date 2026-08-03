export const DEFAULTS: {
  resultCount: number;
  commonMatchThreshold: number;
  reportLabel: string;
  experimental: boolean;
  directoryMode: string;
  fileExtensions: readonly string[];
};
export const BOUNDS: {
  resultCount: { min: number; max: number };
  commonMatchThreshold: { min: number; max: number };
  reportLabelMax: number;
  fileExtensionsMax: number;
};
export function createSettings(capabilities?: Record<string, unknown>): {
  ok: boolean;
  settings: {
    resultCount: number;
    commonMatchThreshold: number;
    reportLabel: string;
    experimental: boolean;
    directoryMode: string;
    fileExtensions: string[];
  };
  available: Record<string, boolean>;
  bounds: typeof BOUNDS;
};
export function deriveDirectoryMode(draft: { groups?: Array<{ files?: unknown[] }> }): "project" | "flat";
export function updateSetting(
  settings: {
    resultCount: number;
    commonMatchThreshold: number;
    reportLabel: string;
    experimental: boolean;
    directoryMode: string;
    fileExtensions: string[];
  },
  key: string,
  value: unknown,
  options?: { capabilities?: Record<string, unknown> },
): {
  ok: boolean;
  error?: string;
  settings: {
    resultCount: number;
    commonMatchThreshold: number;
    reportLabel: string;
    experimental: boolean;
    directoryMode: string;
    fileExtensions: string[];
  };
};
export function resetSettings(capabilities?: Record<string, unknown>): {
  ok: boolean;
  settings: {
    resultCount: number;
    commonMatchThreshold: number;
    reportLabel: string;
    experimental: boolean;
    directoryMode: string;
    fileExtensions: string[];
  };
};
export function maskProviderId(value: unknown): {
  ok: boolean;
  error?: string;
  masked: string;
  digits: string;
};
