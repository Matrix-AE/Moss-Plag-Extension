declare module "*state/index.cjs" {
  export const STORAGE_SCHEMA_VERSION: number;
  export const DRAFT_TTL_MS: number;
  export const TERMINAL_JOB_TTL_MS: number;
  export const STORAGE_BACKEND: "local";
  export const FORBIDDEN_PERSISTED_KEYS: readonly string[];
  export const OWNERS: Record<string, string>;
  export const STATE_KEY: string;
  export const MESSAGE_ACTIONS: readonly string[];

  export function emptyState(now?: number): unknown;
  export function assertNoForbiddenKeys(value: unknown, path?: string): unknown;
  export function validateDraft(draft: unknown): { ok: boolean; value?: unknown; code?: string; message?: string };
  export function validateActiveJob(job: unknown): { ok: boolean; value?: unknown; code?: string; message?: string };
  export function validatePersistedState(input: unknown): { ok: boolean; value?: unknown; code?: string; message?: string };
  export function migrateStorage(raw: unknown, now?: number): {
    ok: boolean;
    state: unknown;
    migrated: boolean;
    log: unknown[];
  };
  export function purgeExpired(state: any, now?: number): { state: any; changed: boolean; events: unknown[] };
  export function discardDraft(state: any): { state: any; changed: boolean };
  export function createMemoryStorage(seed?: Record<string, unknown>): any;
  export function createStateStore(storage: any, options?: { now?: () => number }): any;
  export function parseMessage(value: unknown): { ok: boolean; error?: string; message?: any };
  export function createRouter(deps: { store: any; openWorkspace?: () => Promise<void> }): (raw: unknown) => Promise<any>;
}
