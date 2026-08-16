import { expect } from "@playwright/test";
import { getServiceWorker, getState, test } from "./fixtures";

// This test is a load test by design: 4 rounds of 6 parallel popups = 24 page
// loads plus 24 service-worker round trips inside one test. It gets its own
// budget instead of being capped by the 10s default (see playwright.config).
test.setTimeout(30_000);

test.beforeEach(async ({ reset }) => {
  await reset();
});

// The popup is opened and closed constantly while a browser is in use, and
// every open wakes the MV3 service worker (getState round-trip, alarm and
// storage subscriptions). A churn of rapid parallel opens is where port
// exhaustion, "receiving end does not exist" races, and SW restart storms
// show up - a single-open test never exercises that. The worker must stay
// alive and keep answering through the whole churn.
test("service worker survives rapid popup open/close churn", async ({ extContext, extensionId }) => {
  const sw = await getServiceWorker(extContext);
  const errors: string[] = [];
  let swDied = false;
  extContext.on("console", (msg) => {
    if (msg.type() === "error")
      errors.push(`console.error: ${msg.text()}`);
  });
  sw.on("close", () => {
    swDied = true;
  });

  // 4 rounds x 6 popups in parallel: each must mount, round-trip a getState
  // (the evaluate throws if the SW is unreachable), and close.
  for (let round = 0; round < 4; round++) {
    const pages = await Promise.all(
      Array.from({ length: 6 }, async () => {
        const page = await extContext.newPage();
        page.on("pageerror", err => errors.push(`pageerror: ${err.message}`));
        await page.goto(`chrome-extension://${extensionId}/popup.html`);
        return page;
      }),
    );
    await Promise.all(pages.map(p => p.locator("#timer").waitFor()));
    await Promise.all(pages.map(p => p.evaluate(() => chrome.runtime.sendMessage({ type: "getState" }))));
    await Promise.all(pages.map(p => p.close()));
  }

  expect(swDied, "service worker must not die mid-churn").toBe(false);
  expect(errors, "no page or console errors during churn").toEqual([]);

  // The same SW is still registered and answers with a valid idle session.
  expect(getServiceWorker(extContext)).resolves.toBeDefined();
  const state = await getState(extContext);
  expect(state.phase).toBe("idle");
});
