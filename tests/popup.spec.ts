import { expect } from "@playwright/test";
import { openPopup, test } from "./fixtures";

function parseTimer(text: string | null): number {
  const [m, s] = (text || "").split(":").map(Number);
  return m * 60 + s;
}

test.beforeEach(async ({ reset }) => {
  await reset();
});

test("shows the idle state on open", async ({ extContext, extensionId }) => {
  const page = await openPopup(extContext, extensionId);

  await expect(page.locator("#timer")).toHaveText("90:00");
  await expect(page.locator("#enter-focus-button")).toBeVisible();
  await expect(page.locator("#enter-focus-button")).toHaveText("Start focus");
  await expect(page.locator("#end-focus-button")).toBeHidden();
  await expect(page.locator("#override-btn")).toBeHidden();
});

test("starts a focus session and counts down", async ({ extContext, extensionId }) => {
  const page = await openPopup(extContext, extensionId);

  await page.locator("#enter-focus-button").click();
  await expect(page.locator("#end-focus-button")).toBeVisible();
  await expect(page.locator("#stop-label")).toHaveText("Hold to end");

  await page.clock.runFor(1000);

  // The timer re-renders after a getState round trip to the service worker,
  // which can resolve after the fake clock has already advanced. Read through
  // a retrying poll so a slow round trip cannot observe a stale 90:00 frame.
  let first = 90 * 60;
  await expect
    .poll(async () => {
      first = parseTimer(await page.locator("#timer").textContent());
      return first;
    })
    .toBeLessThan(90 * 60);

  await page.clock.runFor(2000);
  await expect
    .poll(async () => parseTimer(await page.locator("#timer").textContent()))
    .toBeLessThan(first);
});

test("shows a live countdown on the stop button while holding and resets on release", async ({
  extContext,
  extensionId,
}) => {
  const page = await openPopup(extContext, extensionId);

  await page.locator("#enter-focus-button").click();
  await expect(page.locator("#end-focus-button")).toBeVisible();
  await expect(page.locator("#stop-label")).toHaveText("Hold to end");

  const stopBtn = page.locator("#end-focus-button");
  await stopBtn.dispatchEvent("mousedown", { button: 0 });
  await page.clock.runFor(1500);
  await expect(page.locator("#stop-label")).toHaveText(/Ending in \d+s…/);
  await expect(page.locator(".hold-helper")).toHaveText("Keep holding for 5s");

  await stopBtn.dispatchEvent("mouseup", { button: 0 });
  await expect(page.locator("#stop-label")).toHaveText("Hold to end");
  await expect(page.locator(".hold-helper")).toHaveCount(0);

  await expect(page.locator("#end-focus-button")).toBeVisible();
});

test("stops a session back to idle after holding stop for 5 seconds", async ({
  extContext,
  extensionId,
}) => {
  const page = await openPopup(extContext, extensionId);

  await page.locator("#enter-focus-button").click();
  await expect(page.locator("#end-focus-button")).toBeVisible();

  const stopBtn = page.locator("#end-focus-button");
  await stopBtn.dispatchEvent("mousedown", { button: 0 });
  await page.clock.runFor(5000);

  await expect(page.locator("#timer")).toHaveText("90:00");
  await expect(page.locator("#enter-focus-button")).toBeVisible();
  await expect(page.locator("#end-focus-button")).toBeHidden();
});

test("theme toggle switches between light and dark and persists", async ({ extContext, extensionId }) => {
  const page = await openPopup(extContext, extensionId);
  const toggle = page.locator("#theme-toggle");

  await expect(toggle).toContainText("Light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await toggle.click();
  await expect(toggle).toContainText("Dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const stored = await page.evaluate(async () =>
    (await chrome.storage.local.get("themePreference")).themePreference,
  );
  expect(stored).toBe("dark");

  await toggle.click();
  await expect(toggle).toContainText("Light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("blocked page honors a theme override chosen in the popup", async ({ extContext, extensionId }) => {
  const popup = await openPopup(extContext, extensionId);
  await popup.locator("#theme-toggle").click();
  await expect(popup.locator("html")).toHaveAttribute("data-theme", "dark");

  const blocked = await extContext.newPage();
  await blocked.goto(`chrome-extension://${extensionId}/blocked.html`);
  await expect(blocked.locator("html")).toHaveAttribute("data-theme", "dark");
});
