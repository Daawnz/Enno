import { expect } from "@playwright/test";
import { LANDING_URL, test } from "./fixtures";

test.beforeEach(async ({ reset }) => {
  await reset();
});

test("shows the hero landing page", async ({ extContext }) => {
  const page = await extContext.newPage();
  await page.goto(LANDING_URL);

  await expect(page.locator("h1")).toHaveText("Protect your attention.");
  await expect(page.getByText("STAY FOCUSED")).toBeVisible();

  for (const heading of [
    "The 90-Minute Cycle",
    "Just Enough Friction",
    "Privacy First",
    "Pre-configured Blocklist",
  ])
    await expect(page.getByText(heading, { exact: true })).toBeVisible();

  for (const tag of ["Reddit", "YouTube", "X", "Instagram"])
    await expect(page.getByText(tag, { exact: true })).toBeVisible();
});

test("Add to Chrome opens the store listing in a new tab", async ({ extContext }) => {
  let storeUrl = "";
  await extContext.route("https://chromewebstore.google.com/**", (route) => {
    storeUrl = route.request().url();
    return route.abort();
  });

  const page = await extContext.newPage();
  await page.goto(LANDING_URL);

  const cta = page.locator("#add-to-chrome-cta");
  await expect(cta).toHaveAttribute("href", /chromewebstore\.google\.com\/detail\//);
  expect(await cta.evaluate(el => el.tagName)).toBe("A");

  const [storePage] = await Promise.all([
    extContext.waitForEvent("page"),
    cta.click(),
  ]);

  await expect.poll(() => storeUrl).toContain("chromewebstore.google.com/detail/");
  await storePage.close();
});

test("Firefox visitors get the Add to Firefox link to AMO", async ({ extContext }) => {
  const page = await extContext.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", {
      get: () => "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
      configurable: true,
    });
  });
  await page.goto(LANDING_URL);

  const cta = page.locator("#add-to-firefox-cta");
  await expect(cta).toHaveAttribute("href", /addons\.mozilla\.org\//);
  await expect(page.locator("#add-to-chrome-cta")).toHaveCount(0);
});

test("other browsers see the availability note instead of a store link", async ({ extContext }) => {
  const page = await extContext.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", {
      get: () => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
      configurable: true,
    });
  });
  await page.goto(LANDING_URL);

  await expect(page.getByText("Only available for Chrome and Firefox")).toBeVisible();
  await expect(page.locator("#add-to-firefox-cta")).toHaveCount(0);
  await expect(page.locator("#add-to-chrome-cta")).toHaveCount(0);
});

test("view all sites links go to the blocklist, remaining links are placeholders", async ({ extContext }) => {
  const page = await extContext.newPage();
  await page.goto(LANDING_URL);

  for (const label of ["View all 50 sites", "Blocked Sites"])
    await expect(page.getByRole("link", { name: label })).toHaveAttribute("href", "./blocklist.html");
});

test("header links to the GitHub repository in a new tab", async ({ extContext }) => {
  const page = await extContext.newPage();
  await page.goto(LANDING_URL);

  const githubLink = page.getByRole("link", { name: "View Enno on GitHub" });
  await expect(githubLink).toHaveAttribute("href", /github\.com\/Daawnz\/Enno/);
  await expect(githubLink).toHaveAttribute("target", "_blank");
  await expect(githubLink).toHaveAttribute("rel", "noopener");
});
