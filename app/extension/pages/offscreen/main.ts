import { browser } from "../../src/browser";

// The MV3 service worker has no window.matchMedia, so this hidden document
// owns the prefers-color-scheme query. It reports the initial value on load
// (which wakes the service worker) and every later change, keeping the
// toolbar icon in sync with the browser theme without user interaction.
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function reportTheme(): void {
  void browser.runtime.sendMessage({ type: "themeChanged", dark: darkQuery.matches });
}

reportTheme();
darkQuery.addEventListener("change", reportTheme);
