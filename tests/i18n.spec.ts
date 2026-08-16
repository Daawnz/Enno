import { chromium, expect, test } from "@playwright/test";
import { EXTENSION_PATH, LANDING_URL } from "./fixtures";

const EXTENSION_ARGS = [
  `--disable-extensions-except=${EXTENSION_PATH}`,
  `--load-extension=${EXTENSION_PATH}`,
];

test.describe("landing i18n", () => {
  test.use({ locale: "fr-FR" });

  test("prefers the browser language", async ({ page }) => {
    await page.goto(LANDING_URL);

    await expect(page.locator("h1")).toHaveText("Protégez votre attention.");
    await expect(page).toHaveTitle("Enno - Protégez votre attention");
  });
});

test("?lang=fr overrides the landing locale", async ({ page }) => {
  await page.goto(`${LANDING_URL}?lang=fr`);

  await expect(page.locator("h1")).toHaveText("Protégez votre attention.");
});

test("French popup and blocked page", async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: EXTENSION_ARGS,
    locale: "fr-FR",
  });
  try {
    let [sw] = context.serviceWorkers();
    if (!sw)
      sw = await context.waitForEvent("serviceworker");
    const extensionId = sw.url().split("/")[2];

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.locator("#enter-focus-button")).toHaveText("Se concentrer");

    await popup.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({ type: "start" }, resolve)));

    const blocked = await context.newPage();
    await blocked.goto(`chrome-extension://${extensionId}/blocked.html`);
    await expect(blocked.locator("#title")).toHaveText("Restez concentré");
  }
  finally {
    await context.close();
  }
});
