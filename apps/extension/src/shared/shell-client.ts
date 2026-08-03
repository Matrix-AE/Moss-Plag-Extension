import { browser } from "wxt/browser";

import type { MessageAction, ShellResponse } from "./messages";

export function newRequestId(): string {
  return crypto.randomUUID();
}

export async function sendShellMessage(action: MessageAction): Promise<ShellResponse> {
  try {
    return (await browser.runtime.sendMessage({ action, requestId: newRequestId() })) as ShellResponse;
  } catch {
    // A suspended worker restarts on demand; a failed round trip is recoverable, not fatal.
    return { ok: false, error: "malformed-message" };
  }
}
