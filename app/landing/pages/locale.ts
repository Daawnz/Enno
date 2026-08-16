import {
  localStorageKey,
  setLocale,
} from "../../common/i18n/generated/runtime.js";
import { negotiateLocale } from "../../common/i18n/locales.js";

const LANG_PARAM = "lang";

function parseLangParam() {
  try {
    return new URLSearchParams(window.location.search).get(LANG_PARAM);
  }
  catch {
    return null;
  }
}

// The compiled strategy already prefers localStorage, so persisting the
// ?lang= override here is enough for the first render to resolve it.
export function initLandingLocale(): void {
  const raw = parseLangParam();
  if (!raw)
    return;
  const locale = negotiateLocale(raw);
  try {
    localStorage.setItem(localStorageKey, locale);
  }
  catch {
    // localStorage unavailable; the ?lang override is best-effort.
  }
  setLocale(locale, { reload: false });
}
