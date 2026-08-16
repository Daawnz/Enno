import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { LANDING_URL, test } from "./fixtures";

// Accessibility gates for the landing page. We assert that axe finds no
// serious or critical violations - the same threshold the Lighthouse CI
// accessibility gate (>= 0.9) is meant to protect.
//
// Light and dark are audited separately: axe's color-contrast rule must run
// against the resolved dark tokens, not just the light defaults.
async function expectNoSeriousOrCritical(
  page: Page,
  url: string,
  heading: string,
  colorScheme: "light" | "dark",
) {
  await page.goto(url);
  await expect(page.locator("h1")).toHaveText(heading);

  // Guard against the emulation silently not applying: a contrast run is only
  // meaningful if the intended palette actually resolved.
  const resolvedScheme = await page.evaluate(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  expect(resolvedScheme, `page resolves ${colorScheme} color-scheme`).toBe(colorScheme);

  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(v =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(seriousOrCritical, "no serious/critical accessibility violations").toEqual([]);
}

test.describe("landing page accessibility", () => {
  test.describe("light", () => {
    // Entrance animations fade elements in over 0.6s; axe samples colors
    // immediately, so measure static contrast with animations off (the page
    // ships a prefers-reduced-motion override for the same reason).
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    });

    test("landing page has no serious or critical axe violations", async ({ page }) => {
      await expectNoSeriousOrCritical(page, LANDING_URL, "Protect your attention.", "light");
    });

    test("blocklist page has no serious or critical axe violations", async ({ page }) => {
      await expectNoSeriousOrCritical(
        page,
        `${LANDING_URL}blocklist.html`,
        "The Blocklist.",
        "light",
      );
    });
  });

  test.describe("dark", () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    });

    test("landing page has no serious or critical axe violations", async ({ page }) => {
      await expectNoSeriousOrCritical(page, LANDING_URL, "Protect your attention.", "dark");
    });

    test("blocklist page has no serious or critical axe violations", async ({ page }) => {
      await expectNoSeriousOrCritical(
        page,
        `${LANDING_URL}blocklist.html`,
        "The Blocklist.",
        "dark",
      );
    });
  });
});
