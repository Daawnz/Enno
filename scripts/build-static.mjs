/* eslint-disable node/prefer-global/process, node/prefer-global/buffer */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(file) {
  if (existsSync(file))
    process.loadEnvFile(file);
}

loadEnvFile(path.join(root, ".env"));

async function main() {
  const {
    ALL_DOMAINS,
    BLOCKLIST_LOCALES,
    GLOBAL_DOMAINS,
    GLOBAL_RULESET_ID,
    LOCALE_DOMAINS,
    buildBlockRules,
    buildHostPermissions,
    rulesetIdForLocale,
  } = await loadBlocklistModule();

  const extDir = path.join(root, process.env.EXT_DIR ?? "dist/extension");
  const landingDir = path.join(root, process.env.LANDING_DIR ?? "dist/landing");
  mkdirSync(extDir, { recursive: true });

  const rules = buildBlockRules(GLOBAL_DOMAINS);
  writeFileSync(path.join(extDir, "rules.json"), `${JSON.stringify(rules, null, 2)}\n`);

  for (const locale of BLOCKLIST_LOCALES) {
    const localeRules = buildBlockRules(LOCALE_DOMAINS[locale]);
    writeFileSync(
      path.join(extDir, `rules-${locale}.json`),
      `${JSON.stringify(localeRules, null, 2)}\n`,
    );
  }

  const template = JSON.parse(
    readFileSync(path.join(root, "app/extension/manifest.template.json"), "utf8"),
  );
  template.host_permissions = buildHostPermissions(ALL_DOMAINS);
  template.declarative_net_request.rule_resources = [
    { id: GLOBAL_RULESET_ID, enabled: false, path: "rules.json" },
    ...BLOCKLIST_LOCALES.map(locale => ({
      id: rulesetIdForLocale(locale),
      enabled: false,
      path: `rules-${locale}.json`,
    })),
  ];
  const landingOrigin = new URL(process.env.VITE_LANDING_URL ?? "https://Enno.example.com").origin;
  template.externally_connectable.matches.push(`${landingOrigin}/*`);
  writeFileSync(path.join(extDir, "manifest.json"), `${JSON.stringify(template, null, 2)}\n`);

  cpSync(path.join(root, "app/extension/icons"), path.join(extDir, "icons"), { recursive: true });
  cpSync(path.join(root, "app/extension/_locales"), path.join(extDir, "_locales"), { recursive: true });

  const firefoxDir = path.join(root, process.env.FIREFOX_DIR ?? "dist/extension-firefox");
  rmSync(firefoxDir, { recursive: true, force: true });
  cpSync(extDir, firefoxDir, { recursive: true });
  writeFileSync(
    path.join(firefoxDir, "manifest.json"),
    `${JSON.stringify(buildFirefoxManifest(template), null, 2)}\n`,
  );

  cpSync(path.join(root, "app/landing/og.jpg"), path.join(landingDir, "og.jpg"));
  cpSync(path.join(root, "app/landing/robots.txt"), path.join(landingDir, "robots.txt"));
  cpSync(path.join(root, "app/extension/icons/icon32.png"), path.join(landingDir, "favicon.png"));
  cpSync(path.join(root, "privacy.md"), path.join(landingDir, "privacy.md"));
}

function buildFirefoxManifest(chromeManifest) {
  const firefox = structuredClone(chromeManifest);
  firefox.background = { scripts: ["background.js"], type: "module" };
  firefox.browser_specific_settings = {
    // 133.0 is the first release with the fix for bug 1921353. Because the
    // blocklist ruleset starts `enabled: false` (no enabled static or dynamic
    // rules at install), Firefox 132 and earlier reject
    // updateEnabledRulesets/updateDynamicRules after a browser restart, so
    // blocking silently never enables. Lowering this floor would ship a
    // broken extension to 113-132 users.
    gecko: {
      id: "Enno@focusblocker",
      strict_min_version: "133.0",
      // Enno never sends data off-device: the session, theme, and locale live
      // in chrome.storage.local and the blocklist runs locally via
      // declarativeNetRequest, so every category is declared as "none".
      data_collection_permissions: {
        required: ["none"],
      },
    },
  };
  // Firefox picks the toolbar icon natively from the active theme. Per MDN,
  // the "light" entry is shown on themes with light text (Firefox Dark), the
  // "dark" entry on themes with dark text (Firefox Light / Default): the
  // light-background variant keeps the mark legible on a dark toolbar, the
  // transparent variant on a light one.
  firefox.action.theme_icons = [16, 32, 48, 64, 128].map(size => ({
    light: `icons/icon-bg${size}.png`,
    dark: `icons/icon${size}.png`,
    size,
  }));
  // Chrome-only permission backing the offscreen theme watcher; Firefox does
  // not know this permission, so keep it out of the Firefox build.
  firefox.permissions = firefox.permissions.filter(p => p !== "offscreen");
  delete firefox.externally_connectable;
  return firefox;
}

async function loadBlocklistModule() {
  const result = await build({
    entryPoints: [path.join(root, "app/extension/src/core/blocklist.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    logLevel: "silent",
  });
  const code = result.outputFiles[0].text;
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  return import(url);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
