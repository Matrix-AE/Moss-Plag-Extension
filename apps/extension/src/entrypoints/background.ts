import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";

import { createExtensionRouter, createExtensionStateStore } from "../shared/messages";

// Distrust worker memory: every request reloads from storage.local via the state store.
// The router is created once, but the store never treats in-worker scratch as authoritative.
export default defineBackground(() => {
  const store = createExtensionStateStore();
  const handleMessage = createExtensionRouter(store);

  browser.runtime.onInstalled.addListener(async () => {
    // Seed / migrate schema on install and upgrade. load() writes empty state if needed.
    await store.load();
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
