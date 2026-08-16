import { expect } from "@playwright/test";
import { openPopup, setSessionEndTime, test } from "./fixtures";

const CIRCUMFERENCE = 283;

test.beforeEach(async ({ reset }) => {
  await reset();
});

test("ring drains visibly right after a session starts", async ({ extContext, extensionId }) => {
  const page = await openPopup(extContext, extensionId);
  await page.locator("#enter-focus-button").click();
  await expect(page.locator("#end-focus-button")).toBeVisible();

  const offset = () =>
    page.locator("#ring").evaluate(el => Number.parseFloat(el.style.strokeDashoffset || "0"));

  await page.clock.runFor(30_000);

  // A 90-min session drains only ~1.6 units in 30s, which would take ~2 min
  // to become visible. The start kick must make the first grey sliver appear
  // several times faster so the wheel is clearly moving right away.
  const after30 = await offset();
  expect(after30).toBeGreaterThan(CIRCUMFERENCE * 0.01);
  expect(after30).toBeLessThan(CIRCUMFERENCE * 0.06);
});

test("a mid-session popup lands directly at its real progress", async ({ extContext, extensionId }) => {
  const page = await openPopup(extContext, extensionId);
  await page.locator("#enter-focus-button").click();
  await expect(page.locator("#end-focus-button")).toBeVisible();

  // Move the session to half of its 90 minutes (45 min remaining). The ring
  // must land at ~50% drained (the kick deviates by ~2%), not a full ring
  // that animates down from 100%.
  await setSessionEndTime(extContext, Date.now() + 45 * 60_000);
  await expect
    .poll(async () =>
      page.locator("#ring").evaluate(el => Number.parseFloat(el.style.strokeDashoffset || "0")),
    )
    .toBeGreaterThan(CIRCUMFERENCE * 0.45);
  const offset = Number.parseFloat(
    await page.locator("#ring").evaluate(el => el.style.strokeDashoffset || "0"),
  );
  expect(offset).toBeLessThan(CIRCUMFERENCE * 0.6);
});
