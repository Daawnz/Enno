import type { Locale } from "../../../common/i18n/generated/runtime.js";
import {
  baseLocale,
  overwriteGetLocale,
  overwriteSetLocale,
} from "../../../common/i18n/generated/runtime.js";
import { negotiateLocale } from "../../../common/i18n/locales.js";
import { browser } from "../browser";

const STORAGE_KEY = "locale";

function readUiLocale() {
  try {
    return negotiateLocale(browser.i18n.getUILanguage());
  }
  catch {
    return baseLocale;
  }
}

let currentLocale: Locale = readUiLocale();

overwriteGetLocale(() => currentLocale);

overwriteSetLocale((locale) => {
  currentLocale = locale;
  void browser.storage.local.set({ [STORAGE_KEY]: locale });
});

export function getCurrentLocale(): Locale {
  return currentLocale;
}

export async function initLocale(): Promise<Locale> {
  currentLocale = readUiLocale();
  try {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    const override = stored[STORAGE_KEY];
    if (typeof override === "string")
      currentLocale = negotiateLocale(override);
  }
  catch {
    // Storage unavailable; keep the UI-language fallback.
  }
  return currentLocale;
}
