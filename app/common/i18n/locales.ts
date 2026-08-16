import type { Locale } from "./generated/runtime.js";
import { baseLocale } from "./generated/runtime.js";

const BY_LANGUAGE: Record<string, Locale> = {
  en: "en",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
  nl: "nl-NL",
  pl: "pl-PL",
};

// Maps any regional variant (e.g. "es-419") to the closest shipped locale.
export function negotiateLocale(language: string): Locale {
  const base = language.trim().toLowerCase().split("-")[0] ?? "";
  return BY_LANGUAGE[base] ?? baseLocale;
}
