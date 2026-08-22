import type { BlockRule } from "../app/extension/src/core/blocklist";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

test("rules.json is in sync with the manifest", () => {
  const ext = path.resolve(__dirname, "../dist/extension");
  const rules = JSON.parse(fs.readFileSync(path.join(ext, "rules.json"), "utf8")) as BlockRule[];
  const manifest = JSON.parse(fs.readFileSync(path.join(ext, "manifest.json"), "utf8"));

  const permissions = manifest.host_permissions as string[];
  const resources = manifest.declarative_net_request.rule_resources as Array<{
    id: string;
    enabled: boolean;
    path: string;
  }>;

  // The global static ruleset only contains the global domains; locale
  // additions live in their own rulesets.
  // Blocking rules are `block` (not `redirect`): Chrome only grants implicit
  // host access to block/allow DNR rules, so `redirect` would force a
  // host_permission per domain and defeat the clean install prompt.
  expect(rules).toHaveLength(40);
  for (const rule of rules) {
    expect(rule.action.type).toBe("block");
    expect(rule.condition.resourceTypes).toContain("main_frame");
  }

  // Blocking runs through declarativeNetRequest, which needs no host
  // permissions; an empty array keeps the install prompt free of per-site
  // "read and change your data" warnings.
  expect(permissions).toHaveLength(0);

  // One ruleset per locale, each with the locale's 10 additions, plus the
  // global ruleset. All rulesets start disabled (enabled by the state machine).
  expect(resources.map(r => r.id)).toContain("blocklist");
  const localeResources = resources.filter(r => r.id.startsWith("blocklist-"));
  expect(localeResources).toHaveLength(8);
  for (const resource of [...resources]) {
    expect(resource.enabled).toBe(false);
  }
  for (const resource of localeResources) {
    const locale = resource.id.replace("blocklist-", "");
    expect(resource.path).toBe(`rules-${locale}.json`);
    const localeRules = JSON.parse(
      fs.readFileSync(path.join(ext, resource.path), "utf8"),
    ) as BlockRule[];
    expect(localeRules).toHaveLength(10);
    expect(localeRules[0].condition.urlFilter).toMatch(/^\|\|.*\/$/);
  }
});

test("toolbar icon theme variants are wired in both manifests", () => {
  const ext = path.resolve(__dirname, "../dist/extension");
  const chromeManifest = JSON.parse(
    fs.readFileSync(path.join(ext, "manifest.json"), "utf8"),
  );
  const firefoxManifest = JSON.parse(
    fs.readFileSync(path.join(ext, "../extension-firefox/manifest.json"), "utf8"),
  );
  const sizes = [16, 32, 48, 64, 128];

  // Chrome: JS detection in the background, with the light-background variant
  // as the safe fallback until it runs (and when it fails). The listing icon
  // stays transparent - it is shown on light/controlled backgrounds.
  expect(chromeManifest.permissions).toContain("offscreen");
  for (const size of sizes) {
    expect(chromeManifest.action.default_icon[String(size)]).toBe(`icons/icon-bg${size}.png`);
    expect(chromeManifest.icons[String(size)]).toBe(`icons/icon${size}.png`);
  }

  // Firefox: native theme_icons. Per MDN, the "light" entry is shown on
  // themes with light text (Firefox Dark) -> light-background icon; the
  // "dark" entry on themes with dark text (Firefox Light/Default) ->
  // transparent icon. The Chrome-only offscreen permission is stripped.
  expect(firefoxManifest.permissions).not.toContain("offscreen");
  for (const size of sizes) {
    expect(firefoxManifest.action.theme_icons).toContainEqual({
      light: `icons/icon-bg${size}.png`,
      dark: `icons/icon${size}.png`,
      size,
    });
  }
});
