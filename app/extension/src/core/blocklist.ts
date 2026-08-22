import type { Locale } from "../../../common/i18n/generated/runtime.js";

export type BlocklistCategoryId
  = | "social"
    | "video"
    | "entertainment"
    | "news"
    | "sports"
    | "communities"
    | "games"
    | "reading";

export type BlocklistCategory = {
  id: BlocklistCategoryId;
  global: readonly string[];
  locale: Readonly<Partial<Record<Locale, readonly string[]>>>;
};

export const BLOCKLIST_CATEGORIES: readonly BlocklistCategory[] = [
  {
    id: "social",
    global: [
      "reddit.com",
      "x.com",
      "instagram.com",
      "facebook.com",
      "tiktok.com",
      "threads.net",
      "bluesky.app",
      "pinterest.com",
      "tumblr.com",
      "snapchat.com",
    ],
    locale: {},
  },
  {
    id: "video",
    global: [
      "youtube.com",
      "twitch.tv",
      "kick.com",
      "rumble.com",
      "netflix.com",
      "primevideo.com",
      "disneyplus.com",
      "max.com",
      "hulu.com",
      "peacocktv.com",
      "tv.apple.com",
      "paramountplus.com",
      "crunchyroll.com",
      "dailymotion.com",
      "vimeo.com",
    ],
    locale: {},
  },
  {
    id: "entertainment",
    global: [
      "9gag.com",
      "imgur.com",
      "buzzfeed.com",
      "boredpanda.com",
      "ladbible.com",
      "thechive.com",
      "ebaumsworld.com",
      "ifunny.co",
      "giphy.com",
    ],
    locale: {
      "en": ["unilad.com"],
      "fr-FR": ["allocine.fr", "topito.com", "demotivateur.fr"],
      "de-DE": ["chefkoch.de"],
      "it-IT": ["alfemminile.com"],
      "pt-PT": ["zapping.pt"],
      "pl-PL": ["kwejk.pl", "joemonster.org", "demotywatory.pl"],
      "nl-NL": ["dumpert.nl"],
    },
  },
  {
    id: "news",
    global: [],
    locale: {
      "en": [
        "cnn.com",
        "foxnews.com",
        "msn.com",
        "yahoo.com",
        "news.google.com",
        "dailymail.co.uk",
        "nypost.com",
        "mashable.com",
      ],
      "fr-FR": ["bfmtv.com", "20minutes.fr", "lemonde.fr", "lefigaro.fr", "leparisien.fr"],
      "de-DE": ["bild.de", "t-online.de", "focus.de", "web.de", "spiegel.de", "zeit.de", "welt.de"],
      "it-IT": ["libero.it", "fanpage.it", "repubblica.it", "corriere.it", "ilfattoquotidiano.it", "ansa.it"],
      "es-ES": ["20minutos.es", "elpais.com", "elconfidencial.com", "okdiario.com", "elmundo.es", "lavanguardia.com", "xataka.com"],
      "pt-PT": ["observador.pt", "publico.pt", "noticiasaominuto.com", "g1.globo.com", "uol.com.br", "techtudo.com.br", "sapo.pt"],
      "pl-PL": ["onet.pl", "wp.pl", "interia.pl", "o2.pl", "fakt.pl"],
      "nl-NL": ["geenstijl.nl", "nu.nl", "telegraaf.nl", "ad.nl", "nos.nl", "nieuwsblad.be", "hln.be"],
    },
  },
  {
    id: "sports",
    global: [],
    locale: {
      "en": ["espn.com"],
      "it-IT": ["gazzetta.it", "tuttosport.com", "calciomercato.com"],
      "es-ES": ["marca.com", "as.com"],
      "pt-PT": ["record.pt", "abola.pt"],
      "pl-PL": ["meczyki.pl"],
      "nl-NL": ["voetbalzone.nl"],
    },
  },
  {
    id: "communities",
    global: ["quora.com", "4chan.org", "fandom.com"],
    locale: {
      "de-DE": ["gutefrage.net"],
      "es-ES": ["meneame.net"],
      "pl-PL": ["wykop.pl"],
    },
  },
  {
    id: "games",
    global: ["poki.com"],
    locale: {
      "fr-FR": ["jeuxvideo.com", "jeux.fr"],
      "de-DE": ["giga.de"],
      "nl-NL": ["speeleiland.nl"],
    },
  },
  {
    id: "reading",
    global: ["webtoon.com", "wattpad.com"],
    locale: {},
  },
];

export const BLOCKLIST_LOCALES: readonly Locale[] = [
  "en",
  "fr-FR",
  "de-DE",
  "it-IT",
  "es-ES",
  "pt-PT",
  "pl-PL",
  "nl-NL",
];

export const GLOBAL_DOMAINS: readonly string[] = BLOCKLIST_CATEGORIES.flatMap(
  category => category.global,
);

export const LOCALE_DOMAINS: Readonly<Record<Locale, readonly string[]>> = BLOCKLIST_LOCALES.reduce(
  (acc, locale) => {
    acc[locale] = BLOCKLIST_CATEGORIES.flatMap(category => category.locale[locale] ?? []);
    return acc;
  },
  {} as Record<Locale, readonly string[]>,
);

export const ALL_DOMAINS: readonly string[] = [
  ...new Set([...GLOBAL_DOMAINS, ...Object.values(LOCALE_DOMAINS).flat()]),
];

export function domainsForLocale(locale: Locale): readonly string[] {
  return [...GLOBAL_DOMAINS, ...(LOCALE_DOMAINS[locale] ?? [])];
}

export type ResolvedBlocklistCategory = {
  id: BlocklistCategoryId;
  domains: readonly string[];
};

// Drops empty categories so a locale never renders a heading with no sites beneath it.
export function categoriesForLocale(locale: Locale): readonly ResolvedBlocklistCategory[] {
  return BLOCKLIST_CATEGORIES
    .map(category => ({
      id: category.id,
      domains: [...category.global, ...(category.locale[locale] ?? [])],
    }))
    .filter(category => category.domains.length > 0);
}

export const GLOBAL_RULESET_ID = "blocklist";

export function rulesetIdForLocale(locale: Locale): string {
  return `blocklist-${locale}`;
}

export const ALL_RULESET_IDS: readonly string[] = [
  GLOBAL_RULESET_ID,
  ...BLOCKLIST_LOCALES.map(rulesetIdForLocale),
];

// The ruleset is `block` (not `redirect`) on purpose: Chrome's
// declarativeNetRequest provides implicit host access to `block` rules, so no
// host permission is needed per domain. `redirect` rules to an extension page
// would require a host_permission for every blocked domain, which is exactly
// the install-time "access your data on this site" wall we avoid.
export type BlockRule = {
  id: number;
  priority: number;
  action: { type: "block" };
  condition: { urlFilter: string; resourceTypes: string[] };
};

export function buildBlockRules(domains: readonly string[]): BlockRule[] {
  return domains.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: "block" },
    condition: { urlFilter: `||${domain}/`, resourceTypes: ["main_frame"] },
  }));
}

export function blockedRootDomainOf(
  hostname: string,
  domains: readonly string[] = ALL_DOMAINS,
): string | null {
  let best: string | null = null;
  for (const domain of domains) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      if (!best || domain.length > best.length)
        best = domain;
    }
  }
  return best;
}
