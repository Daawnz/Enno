import { browser } from "../browser";

// Theme preference is shared by every extension page and the background
// service worker. There is deliberately no "follow browser" mode: the popup
// defaults to Light and users can optionally force Dark. This keeps extension
// appearance predictable even when the OS/browser themes disagree.
export type ThemePreference = "light" | "dark";
export const THEME_PREFERENCE_STORAGE_KEY = "themePreference";
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "light";

// Toolbar icon variants. The transparent mark (no background) is the light
// theme variant; the light-background variant is used for the dark theme so
// the ring stays legible on dark toolbars.
const ICON_SIZES = [16, 32, 48, 64, 128] as const;
const ICON_STORAGE_KEY = "darkTheme";

function iconPath(size: number, dark: boolean): string {
  return `icons/icon${dark ? "-bg" : ""}${size}.png`;
}

// Firefox keeps its native browser-theme toolbar icons via manifest
// theme_icons, so we only manually override the toolbar icon in Chrome.
function isFirefox(): boolean {
  return typeof (browser.runtime as { getBrowserInfo?: unknown }).getBrowserInfo === "function";
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark";
}

export function effectiveDark(preference: ThemePreference): boolean {
  return preference === "dark";
}

export async function readThemePreference(): Promise<ThemePreference> {
  try {
    const stored = await browser.storage.local.get(THEME_PREFERENCE_STORAGE_KEY);
    const value = stored[THEME_PREFERENCE_STORAGE_KEY] as unknown;
    return isThemePreference(value) ? value : DEFAULT_THEME_PREFERENCE;
  }
  catch {
    // Storage failures should never block startup; default to light mode.
    return DEFAULT_THEME_PREFERENCE;
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
// gives data-theme rules precedence over prefers-color-scheme, so the chosen
// Light/Dark setting always wins over the browser theme.
export async function applyThemePreferenceToDocument(preference?: ThemePreference): Promise<void> {
  const resolved = preference ?? await readThemePreference();
  document.documentElement.dataset.theme = resolved;
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

// Keeps the Chrome toolbar icon in sync with the user's Light/Dark preference.
// Firefox intentionally keeps its native browser-theme toolbar icons.
export async function applyThemePreferenceToIcon(preference?: ThemePreference): Promise<void> {
  if (isFirefox())
    return;
  const resolved = preference ?? await readThemePreference();
  await applyTheme(effectiveDark(resolved));
}

// Chrome only. Firefox resolves light/dark toolbar icons natively through the
// manifest theme_icons key, so this is a no-op there.
export async function initTheme(): Promise<void> {
  if (isFirefox())
    return;
  try {
    // The action icon state may be reset to the manifest default when the
    // service worker restarts, so re-apply the stored Light/Dark preference.
    const preference = await readThemePreference();
    await applyTheme(effectiveDark(preference));
  }
  catch {
    // Fall back to the manifest default_icon (light-background variant).
  }
}
