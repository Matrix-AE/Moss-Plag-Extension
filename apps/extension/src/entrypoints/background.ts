import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";

import { createExtensionRouter, createExtensionStateStore } from "../shared/messages";

type SidePanelApi = {
  setPanelBehavior: (behavior: { openPanelOnActionClick: boolean }) => Promise<void>;
};

function getSidePanel(): SidePanelApi | undefined {
  return (browser as unknown as { sidePanel?: SidePanelApi }).sidePanel;
}

// Distrust worker memory: every request reloads from storage.local via the state store.
// The router is created once, but the store never treats in-worker scratch as authoritative.
export default defineBackground(() => {
  const store = createExtensionStateStore();
  const sidePanel = getSidePanel();
  const handleMessage = createExtensionRouter(store, {
    openWorkspace: async () => {
      // Popup is the product surface — never open workspace.html in a tab.
      // Toolbar click already opens default_popup; this path is intentionally a no-op.
    },
  });

  // Demote Side Panel if Chromium still exposes the API from a leftover build.
  void sidePanel
    ?.setPanelBehavior({ openPanelOnActionClick: false })
    .catch(() => {
      // Older Chromium builds without sidePanel should not crash the worker.
    });

  browser.runtime.onInstalled.addListener(async () => {
    // Seed / migrate schema on install and upgrade. load() writes empty state if needed.
    await store.load();
    void sidePanel?.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);
  });

  // Alarms re-check purge after suspension instead of holding timers in memory.
  browser.alarms.create("state-purge", { periodInMinutes: 60 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "state-purge") {
      void store.forcePurge();
    }
  });

  browser.runtime.onMessage.addListener((message: unknown) => handleMessage(message));
});
