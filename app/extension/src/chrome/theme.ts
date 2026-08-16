import type { MessageRequest } from "../protocol";
import { browser } from "../browser";

// Toolbar icon variants. The transparent mark (no background) is the default;
// the light-background variant is applied on dark browser themes where a bare
// dark-green ring would lose contrast against the toolbar.
const ICON_SIZES = [16, 32, 48, 64, 128] as const;
const STORAGE_KEY = "darkTheme";

function iconPath(size: number, dark: boolean): string {
  return `icons/icon${dark ? "-bg" : ""}${size}.png`;
}

export async function applyTheme(dark: boolean): Promise<void> {
  const path = Object.fromEntries(
    ICON_SIZES.map(size => [String(size), iconPath(size, dark)]),
  );
  try {
    await browser.action.setIcon({ path });
    await browser.storage.local.set({ [STORAGE_KEY]: dark });
  }
  catch {
    // Icon state is cosmetic; a sync failure must never break startup.
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
    // Re-apply the last known theme: the action icon state may be reset to
    // the manifest default when the service worker restarts.
    const stored = await browser.storage.local.get(STORAGE_KEY);
    if (typeof stored[STORAGE_KEY] === "boolean")
      await applyTheme(stored[STORAGE_KEY] as boolean);
  }
  catch {
    // Fall back to the manifest default_icon (light-background variant).
  }
  await ensureOffscreenDocument();
}

// Returns true when the message is a theme report from the offscreen
// document, so the background router skips the session handler for it.
export function handleThemeChanged(message: MessageRequest): boolean {
  if (message.type !== "themeChanged")
    return false;
  void applyTheme(Boolean(message.dark));
  return true;
}
