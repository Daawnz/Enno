import type { MessageRequest } from "../protocol";
import { browser } from "../browser";

// Theme preference is shared by every extension page and the background
// service worker. "system" means "follow the browser"; "light" and "dark"
// intentionally override the browser theme inside extension pages and, on
// Chrome, the toolbar icon as well.
export type ThemePreference = "system" | "light" | "dark";
export const THEME_PREFERENCE_STORAGE_KEY = "themePreference";

// Toolbar icon variants. The transparent mark (no background) is the default;
// the light-background variant is applied on dark browser themes where a bare
// dark-green ring would lose contrast against the toolbar.
const ICON_SIZES = [16, 32, 48, 64, 128] as const;
const ICON_STORAGE_KEY = "darkTheme";
const SYSTEM_DARK_STORAGE_KEY = "systemDarkTheme";

function iconPath(size: number, dark: boolean): string {
  return `icons/icon${dark ? "-bg" : ""}${size}.png`;
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function effectiveDark(preference: ThemePreference, systemDark: boolean): boolean {
  switch (preference) {
    case "light":
      return false;
    case "dark":
      return true;
    case "system":
      return systemDark;
  }
}

export async function readThemePreference(): Promise<ThemePreference> {
  try {
    const stored = await browser.storage.local.get(THEME_PREFERENCE_STORAGE_KEY);
    const value = stored[THEME_PREFERENCE_STORAGE_KEY] as unknown;
    return isThemePreference(value) ? value : "system";
  }
  catch {
    // Storage failures should never block startup; default to following the
    // browser theme.
    return "system";
  }
}

export async function writeThemePreference(preference: ThemePreference): Promise<void> {
  await browser.storage.local.set({ [THEME_PREFERENCE_STORAGE_KEY]: preference });
}

export async function applyTheme(dark: boolean): Promise<void> {
  const path = Object.fromEntries(
    ICON_SIZES.map(size => [String(size), iconPath(size, dark)]),
  );
  try {
    await browser.action.setIcon({ path });
    await browser.storage.local.set({ [ICON_STORAGE_KEY]: dark });
  }
  catch {
    // Icon state is cosmetic; a sync failure must never break startup.
  }
}

// Pages call this to set <html data-theme="...">. The CSS in app/common/theme.css
// gives data-theme rules precedence over prefers-color-scheme, so a manual
// Light/Dark choice wins over the browser theme.
export async function applyThemePreferenceToDocument(preference?: ThemePreference): Promise<void> {
  const resolved = preference ?? await readThemePreference();
  const root = document.documentElement;
  if (resolved === "system")
    delete root.dataset.theme;
  else
    root.dataset.theme = resolved;
}

// Watches storage so every open extension page follows a theme preference
// change immediately, even if the change was made from another page.
export async function initPageTheme(): Promise<void> {
  await applyThemePreferenceToDocument();
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local")
      return;
    const change = changes[THEME_PREFERENCE_STORAGE_KEY];
    if (change && isThemePreference(change.newValue))
      void applyThemePreferenceToDocument(change.newValue);
  });
}

async function readSystemDark(): Promise<boolean | null> {
  try {
    const stored = await browser.storage.local.get([SYSTEM_DARK_STORAGE_KEY, ICON_STORAGE_KEY]);
    if (typeof stored[SYSTEM_DARK_STORAGE_KEY] === "boolean")
      return stored[SYSTEM_DARK_STORAGE_KEY] as boolean;
    // Backward-compatible fallback: before the manual override existed, the
    // stored icon flag was the effective system theme.
    if (typeof stored[ICON_STORAGE_KEY] === "boolean")
      return stored[ICON_STORAGE_KEY] as boolean;
  }
  catch {
    // Fall through to unknown.
  }
  return null;
}

// Chrome only. Firefox resolves light/dark toolbar icons natively through the
// manifest theme_icons key, so overriding the action icon there is intentionally
// not attempted; extension UI still honors the preference via data-theme.
export async function applyThemePreferenceToIcon(preference?: ThemePreference): Promise<void> {
  if (!browser.offscreen)
    return;
  const resolved = preference ?? await readThemePreference();
  if (resolved === "system") {
    const systemDark = await readSystemDark();
    if (systemDark !== null)
      await applyTheme(systemDark);
  }
  else {
    await applyTheme(effectiveDark(resolved, false));
  }
}

let offscreenEnsured = false;

async function ensureOffscreenDocument(): Promise<void> {
  if (offscreenEnsured || !browser.offscreen)
    return;
  // Set the flag before awaiting: the service worker restarts often and
  // initTheme can run more than once per lifetime.
  offscreenEnsured = true;
  try {
    await browser.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [browser.offscreen.Reason.MATCH_MEDIA],
      justification: "Detect prefers-color-scheme to pick the toolbar icon variant.",
    });
  }
  catch {
    // A document from a previous service-worker lifetime may still be open;
    // "Only a single offscreen document may be created" is the expected race.
  }
}

// Chrome only. Firefox resolves light/dark toolbar icons natively through the
// manifest theme_icons key, so this is a no-op there.
export async function initTheme(): Promise<void> {
  if (!browser.offscreen)
    return;
  try {
    // Re-apply the last known effective theme: the action icon state may be
    // reset to the manifest default when the service worker restarts. If the
    // user has chosen a manual override, use that instead of the browser theme.
    const preference = await readThemePreference();
    if (preference === "system") {
      const systemDark = await readSystemDark();
      if (systemDark !== null)
        await applyTheme(systemDark);
    }
    else {
      await applyTheme(effectiveDark(preference, false));
    }
  }
  catch {
    // Fall back to the manifest default_icon (light-background variant).
  }
  await ensureOffscreenDocument();
}

// Consumes theme reports from the offscreen document. The browser's actual
// dark/light state is remembered separately so a later switch from a manual
// override back to "system" can restore the correct toolbar icon.
export async function handleThemeChanged(message: MessageRequest): Promise<boolean> {
  if (message.type !== "themeChanged")
    return false;
  try {
    const systemDark = Boolean(message.dark);
    await browser.storage.local.set({ [SYSTEM_DARK_STORAGE_KEY]: systemDark });
    const preference = await readThemePreference();
    if (preference === "system")
      await applyTheme(systemDark);
    else
      await applyTheme(effectiveDark(preference, false));
  }
  catch {
    // Icon state is cosmetic; never let theme reporting break messaging.
  }
  return true;
}
