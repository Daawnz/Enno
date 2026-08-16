import { describe, expect, it } from "vitest";
import {
  ALL_DOMAINS,
  ALL_RULESET_IDS,
  blockedRootDomainOf,
  BLOCKLIST_CATEGORIES,
  BLOCKLIST_LOCALES,
  buildBlockRules,
  buildHostPermissions,
  categoriesForLocale,
  domainsForLocale,
  GLOBAL_DOMAINS,
  GLOBAL_RULESET_ID,
  LOCALE_DOMAINS,
  rulesetIdForLocale,
} from "./blocklist";

describe("blocklist", () => {
  it("lists 40 global distraction domains", () => {
    expect(GLOBAL_DOMAINS).toHaveLength(40);
    expect(GLOBAL_DOMAINS).toContain("reddit.com");
    expect(GLOBAL_DOMAINS).toContain("x.com");
    expect(GLOBAL_DOMAINS).toContain("youtube.com");
    expect(GLOBAL_DOMAINS).not.toContain("twitter.com");
    expect(GLOBAL_DOMAINS).not.toContain("amazon.com");
  });

  it("ships 10 language additions for every supported locale", () => {
    expect(BLOCKLIST_LOCALES).toEqual([
      "en",
      "fr-FR",
      "de-DE",
      "it-IT",
      "es-ES",
      "pt-PT",
      "pl-PL",
      "nl-NL",
    ]);
    for (const locale of BLOCKLIST_LOCALES) {
      expect(LOCALE_DOMAINS[locale]).toHaveLength(10);
    }
  });

  it("combines the global list with the active locale additions", () => {
    expect(domainsForLocale("en")).toHaveLength(50);
    expect(domainsForLocale("en")).toContain("reddit.com");
    expect(domainsForLocale("en")).toContain("cnn.com");
    expect(domainsForLocale("en")).not.toContain("lemonde.fr");

    expect(domainsForLocale("fr-FR")).toContain("lemonde.fr");
    expect(domainsForLocale("fr-FR")).not.toContain("cnn.com");
  });

  it("exposes a deduplicated list of every blockable domain", () => {
    expect(ALL_DOMAINS).toHaveLength(120);
    expect(new Set(ALL_DOMAINS).size).toBe(ALL_DOMAINS.length);
  });

  it("partitions ruleset ids into one global and one per locale", () => {
    expect(GLOBAL_RULESET_ID).toBe("blocklist");
    expect(rulesetIdForLocale("fr-FR")).toBe("blocklist-fr-FR");
    expect(ALL_RULESET_IDS).toHaveLength(1 + BLOCKLIST_LOCALES.length);
    expect(ALL_RULESET_IDS).toContain("blocklist");
    expect(ALL_RULESET_IDS).toContain("blocklist-pl-PL");
  });

  it("generates one redirect rule per domain with sequential ids", () => {
    const domains = domainsForLocale("en");
    const rules = buildBlockRules(domains);

    expect(rules).toHaveLength(50);
    rules.forEach((rule, index) => {
      expect(rule.id).toBe(index + 1);
      expect(rule.priority).toBe(1);
      expect(rule.action.type).toBe("redirect");
      expect(rule.action.redirect.extensionPath).toBe("/blocked.html");
      expect(rule.condition.urlFilter).toBe(`||${domains[index]}/`);
      expect(rule.condition.resourceTypes).toEqual(["main_frame"]);
    });
  });

  it("generates a host permission per domain", () => {
    const permissions = buildHostPermissions(ALL_DOMAINS);

    expect(permissions).toHaveLength(120);
    ALL_DOMAINS.forEach((domain, index) => {
      expect(permissions[index]).toBe(`*://*.${domain}/*`);
    });
  });

  it("finds the blocked root domain for a host", () => {
    expect(blockedRootDomainOf("reddit.com")).toBe("reddit.com");
    expect(blockedRootDomainOf("www.reddit.com")).toBe("reddit.com");
    expect(blockedRootDomainOf("old.reddit.com")).toBe("reddit.com");
    expect(blockedRootDomainOf("news.google.com")).toBe("news.google.com");
    expect(blockedRootDomainOf("www.lemonde.fr")).toBe("lemonde.fr");
    expect(blockedRootDomainOf("example.com")).toBeNull();
    expect(blockedRootDomainOf("evilreddit.com")).toBeNull();
  });

  it("respects a custom domain scope in blockedRootDomainOf", () => {
    expect(blockedRootDomainOf("www.lemonde.fr", GLOBAL_DOMAINS)).toBeNull();
    expect(blockedRootDomainOf("www.reddit.com", GLOBAL_DOMAINS)).toBe("reddit.com");
  });

  it("groups every global domain into exactly one display category", () => {
    const flat = BLOCKLIST_CATEGORIES.flatMap(category => category.global);
    expect(flat).toHaveLength(40);
    expect(new Set(flat).size).toBe(40);
    expect(flat).toEqual(GLOBAL_DOMAINS);
  });

  it("folds locale additions into their categories and drops empty groups", () => {
    for (const locale of BLOCKLIST_LOCALES) {
      const categories = categoriesForLocale(locale);
      const flat = categories.flatMap(category => category.domains);
      expect(flat).toHaveLength(50);
      expect(new Set(flat).size).toBe(50);
      expect(categories.every(category => category.domains.length > 0)).toBe(true);
      // Same membership as the flat DNR list, just interleaved by category.
      expect([...flat].sort()).toEqual([...domainsForLocale(locale)].sort());
    }
  });

  it("places locale news, sports, and games additions in the right categories", () => {
    const byId = (locale: (typeof BLOCKLIST_LOCALES)[number]) =>
      Object.fromEntries(categoriesForLocale(locale).map(category => [category.id, category.domains]));

    const en = byId("en");
    expect(en.news).toContain("cnn.com");
    expect(en.sports).toContain("espn.com");
    expect(en.games).toContain("poki.com");

    const fr = byId("fr-FR");
    expect(fr.games).toContain("jeuxvideo.com");
    expect(fr.news).toContain("lemonde.fr");
    expect(fr.sports).toBeUndefined();
  });
});
