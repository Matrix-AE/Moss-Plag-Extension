import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";

import { createExtensionRouter, createExtensionStateStore } from "../shared/messages";

type SidePanelApi = {
  setPanelBehavior: (behavior: { openPanelOnActionClick: boolean }) => Promise<void>;
  open?: (options: { windowId?: number }) => Promise<void>;
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
      // Side Panel is the product surface — never open workspace.html in a tab.
      // openPanelOnActionClick already covers toolbar clicks; this path is a no-op recovery hook.
      if (sidePanel?.open) {
        try {
          await sidePanel.open({});
        } catch {
          // Opening without a user gesture can fail; toolbar click remains the primary path.
        }
      }
    },
  });

  void sidePanel
    ?.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {
      // Older Chromium builds without sidePanel should not crash the worker.
    });

  browser.runtime.onInstalled.addListener(async () => {
    // Seed / migrate schema on install and upgrade. load() writes empty state if needed.
    await store.load();
    void sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
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
