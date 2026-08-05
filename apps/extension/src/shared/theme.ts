import { browser } from "wxt/browser";

export type ThemePreference = "system" | "light" | "dark";

const THEME_KEY = "moss.ui.theme";

export function applyTheme(preference: ThemePreference): void {
  if (preference === "system") {
    document.documentElement.removeAttribute("data-theme");
    return;
  }
  document.documentElement.setAttribute("data-theme", preference);
}

export async function loadThemePreference(): Promise<ThemePreference> {
  const bag = await browser.storage.local.get(THEME_KEY);
  const value = bag[THEME_KEY];
  return value === "light" || value === "dark" ? value : "system";
}

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  await browser.storage.local.set({ [THEME_KEY]: preference });
  applyTheme(preference);
}

export function nextThemePreference(preference: ThemePreference): ThemePreference {
  if (preference === "system") return "light";
  if (preference === "light") return "dark";
  return "system";
}
