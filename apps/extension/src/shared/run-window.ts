import { browser } from "wxt/browser";

const RUN_WINDOW_KEY = "moss.runWindowId";
const RUN_PAGE = "workspace.html";

/** Only the window fields this module needs — avoids depending on @types/chrome. */
type WindowsApi = {
  create?: (options: {
    url: string;
    type?: string;
    width?: number;
    height?: number;
  }) => Promise<{ id?: number } | undefined>;
  update?: (
    windowId: number,
    options: { focused?: boolean; drawAttention?: boolean },
  ) => Promise<unknown>;
};

/**
 * Chrome tears down a browser-action popup as soon as the OS file chooser takes focus, which
 * loses the picked files and leaves an empty panel. File selection and runs therefore live in
 * a normal extension window that survives dialogs.
 */
export async function openRunWindow(): Promise<{ ok: boolean; error?: string }> {
  const url = browser.runtime.getURL(`/${RUN_PAGE}`);
  const windows = (browser as unknown as { windows?: WindowsApi }).windows;

  if (windows?.create) {
    try {
      const bag = await browser.storage.local.get(RUN_WINDOW_KEY);
      const existingId = bag[RUN_WINDOW_KEY];
      if (typeof existingId === "number" && windows.update) {
        try {
          await windows.update(existingId, { focused: true, drawAttention: true });
          return { ok: true };
        } catch {
          await browser.storage.local.remove(RUN_WINDOW_KEY);
        }
      }
      const created = await windows.create({ url, type: "popup", width: 620, height: 900 });
      if (typeof created?.id === "number") {
        await browser.storage.local.set({ [RUN_WINDOW_KEY]: created.id });
      }
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not open the run window.",
      };
    }
  }

  const opened = window.open(url, "_blank");
  return opened
    ? { ok: true }
    : { ok: false, error: "Chrome blocked the run window. Open it from the extensions menu." };
}
