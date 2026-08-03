import { browser } from "wxt/browser";

import {
  createRouter,
  createStateStore,
  MESSAGE_ACTIONS,
  parseMessage,
  STORAGE_BACKEND,
  STATE_KEY,
} from "../../state/index.cjs";
import type { MessageAction, PersistedState } from "./state-types";

export type ShellError = "unknown-action" | "malformed-message" | string;

export interface ShellMessage {
  action: MessageAction;
  requestId: string;
  payload?: Record<string, unknown>;
}

export interface ShellResponse {
  ok: boolean;
  action?: MessageAction;
  requestId?: string;
  error?: ShellError;
  payload?: Record<string, unknown>;
}

export function isShellMessage(value: unknown): value is ShellMessage {
  const parsed = parseMessage(value);
  return parsed.ok;
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

function createChromeLocalStorage() {
  return {
    backend: STORAGE_BACKEND,
    async get(keys: string | string[] | null) {
      if (keys == null) {
        return browser.storage.local.get(null);
      }
      return browser.storage.local.get(keys);
    },
    async set(values: Record<string, unknown>) {
      await browser.storage.local.set(values);
    },
    async remove(keys: string | string[]) {
      await browser.storage.local.remove(keys);
    },
    async clear() {
      await browser.storage.local.clear();
    },
  };
}

export function createExtensionStateStore() {
  return createStateStore(createChromeLocalStorage());
}

export function createExtensionRouter(store = createExtensionStateStore()) {
  return createRouter({
    store,
    openWorkspace: async () => {
      await browser.tabs.create({ url: browser.runtime.getURL("/workspace.html") });
    },
  });
}

export async function sendShellMessage(
  action: MessageAction,
  payload?: Record<string, unknown>,
): Promise<ShellResponse> {
  try {
    const message: ShellMessage = { action, requestId: newRequestId() };
    if (payload !== undefined) {
      message.payload = payload;
    }
    return (await browser.runtime.sendMessage(message)) as ShellResponse;
  } catch {
    return { ok: false, error: "malformed-message" };
  }
}

export async function getPersistedState(): Promise<PersistedState | null> {
  const response = await sendShellMessage("state/get");
  if (!response.ok || !response.payload?.["state"]) {
    return null;
  }
  return response.payload["state"] as PersistedState;
}

export { MESSAGE_ACTIONS, STATE_KEY, parseMessage };
