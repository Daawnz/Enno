import type { BrowserContext } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect } from "@playwright/test";
import {
  BLOCKLIST_RULESET,
  forceAlarm,
  getEnabledRulesets,
  getState,
  launchExtensionContext,
  send,
  test,
} from "./fixtures";

async function stubSite(context: BrowserContext, url: string) {
  let hit = false;
  await context.route(url, (route) => {
    hit = true;
    return route.fulfill({
      body: "<html><body>site loaded</body></html>",
      contentType: "text/html",
    });
  });
  return () => hit;
}

test.beforeEach(async ({ reset }) => {
  await reset();
});

test("ruleset is off when idle", async ({ extContext }) => {
  await expect.poll(() => getEnabledRulesets(extContext)).not.toContain(BLOCKLIST_RULESET);
});

test("site loads normally when idle", async ({ extContext }) => {
  const page = await extContext.newPage();
  const wasHit = await stubSite(extContext, "https://www.reddit.com/**");

  await page.goto("https://www.reddit.com/");
  expect(wasHit()).toBe(true);
  await expect(page.locator("body")).toHaveText("site loaded");
});

test("ruleset is on during focus", async ({ extContext }) => {
  await send(extContext, "start");
  await expect.poll(() => getEnabledRulesets(extContext)).toContain(BLOCKLIST_RULESET);
});

test("a blocked site redirects to blocked.html during focus", async ({ extContext }) => {
  await send(extContext, "start");
  await expect.poll(() => getEnabledRulesets(extContext)).toContain(BLOCKLIST_RULESET);

  const page = await extContext.newPage();
  // The DNR `block` aborts the navigation (ERR_BLOCKED_BY_CLIENT) before the
  // background replaces it with blocked.html; swallow that expected rejection.
  await page.goto("https://www.reddit.com/").catch(() => {});

  await expect(page).toHaveURL(/chrome-extension:\/\/[^/]+\/blocked.html/);
  await expect(page.locator("#title")).toHaveText("Stay focused");
});

test("another blocked domain redirects too", async ({ extContext }) => {
  await send(extContext, "start");
  await expect.poll(() => getEnabledRulesets(extContext)).toContain(BLOCKLIST_RULESET);

  const page = await extContext.newPage();
  await page.goto("https://www.youtube.com/").catch(() => {});

  await expect(page).toHaveURL(/chrome-extension:\/\/[^/]+\/blocked.html/);
});

test("override keeps the ruleset enabled", async ({ extContext }) => {
  await send(extContext, "start");
  await expect.poll(() => getEnabledRulesets(extContext)).toContain(BLOCKLIST_RULESET);

  await send(extContext, "override");
  await expect.poll(() => getEnabledRulesets(extContext)).toContain(BLOCKLIST_RULESET);

  const page = await extContext.newPage();
  await page.goto("https://www.reddit.com/").catch(() => {});
  await expect(page).toHaveURL(/chrome-extension:\/\/[^/]+\/blocked.html/);
});

test("site is unblocked when focus completes", async ({ extContext }) => {
  await send(extContext, "start");
  await forceAlarm(extContext, "focus-end");
  await expect.poll(async () => (await getState(extContext)).phase).toBe("idle");
  await expect.poll(() => getEnabledRulesets(extContext)).not.toContain(BLOCKLIST_RULESET);

  const page = await extContext.newPage();
  const wasHit = await stubSite(extContext, "https://www.reddit.com/**");

  await page.goto("https://www.reddit.com/");
  expect(wasHit()).toBe(true);
  await expect(page.locator("body")).toHaveText("site loaded");
});

test("language additions are blocked only for the active locale", async () => {
  test.setTimeout(30_000);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "Enno-locale-"));
  const ctx = await launchExtensionContext(dir, { locale: "fr-FR" });
  try {
    await send(ctx, "start");
    await expect.poll(() => getEnabledRulesets(ctx)).toContain(BLOCKLIST_RULESET);
    await expect.poll(() => getEnabledRulesets(ctx)).toContain("blocklist-fr-FR");
    await expect.poll(() => getEnabledRulesets(ctx)).not.toContain("blocklist-en");

    // A French addition is blocked for a French browser.
    const frPage = await ctx.newPage();
    await frPage.goto("https://www.lemonde.fr/").catch(() => {});
    await expect(frPage).toHaveURL(/chrome-extension:\/\/[^/]+\/blocked.html/);

    // An English-only addition is not blocked for a French browser.
    const enPage = await ctx.newPage();
    const wasHit = await stubSite(ctx, "https://www.cnn.com/**");
    await enPage.goto("https://www.cnn.com/");
    expect(wasHit()).toBe(true);
    await expect(enPage.locator("body")).toHaveText("site loaded");
  }
  finally {
    await ctx.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
