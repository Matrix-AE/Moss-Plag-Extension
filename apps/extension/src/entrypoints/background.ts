import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";

import { isShellMessage, type ShellResponse } from "../shared/messages";

const WORKSPACE_PAGE = "workspace.html";

// The service worker is suspended aggressively, so it keeps no in-memory session state.
// Anything that must survive suspension goes to storage.local (Prompt 024).
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    await browser.storage.local.set({ shellInstalledAt: Date.now() });
  });

  browser.runtime.onMessage.addListener((message: unknown): Promise<ShellResponse> => {
    if (!isShellMessage(message)) {
      return Promise.resolve({ ok: false, error: "malformed-message" });
    }

    switch (message.action) {
      case "shell/ping":
        return Promise.resolve({ ok: true, action: message.action, requestId: message.requestId });
      case "shell/open-workspace":
        return browser.tabs
          .create({ url: browser.runtime.getURL(`/${WORKSPACE_PAGE}`) })
          .then(() => ({ ok: true, action: message.action, requestId: message.requestId }));
      case "shell/status":
        return browser.storage.local.get("shellInstalledAt").then((stored) => ({
          ok: true,
          action: message.action,
          requestId: message.requestId,
          payload: { installedAt: Number(stored["shellInstalledAt"] ?? 0) },
        }));
      default:
        return Promise.resolve({ ok: false, error: "unknown-action" });
    }
  });
});
