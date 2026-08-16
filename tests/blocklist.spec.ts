import { expect } from "@playwright/test";
import { LANDING_URL, test } from "./fixtures";

test.beforeEach(async ({ reset }) => {
  await reset();
});

test("opens the blocklist from the landing page and navigates back", async ({ page }) => {
  await page.goto(LANDING_URL);

  await page.getByRole("link", { name: "View all 50 sites" }).click();
  await expect(page).toHaveURL(/blocklist\.html/);
  await expect(page.locator("h1")).toHaveText("The Blocklist.");

  await page.getByRole("link", { name: "BACK" }).click();
  await expect(page.locator("h1")).toHaveText("Protect your attention.");
});

test("deep link renders the full locale blocklist", async ({ page }) => {
  await page.goto(`${LANDING_URL}blocklist.html`);

  await expect(page.locator("h1")).toHaveText("The Blocklist.");
  await expect(page.getByText(/top 50 most distracting sites/)).toBeVisible();

  const rows = page.locator(".grid > .group");
  await expect(rows).toHaveCount(50);

  for (const domain of ["reddit.com", "youtube.com", "espn.com", "threads.net"])
    await expect(page.getByText(domain, { exact: true })).toBeVisible();
});

test("renders a monogram badge for every blocked domain", async ({ page }) => {
  await page.goto(`${LANDING_URL}blocklist.html`);

  const badges = page.locator(".grid > .group span[aria-hidden='true']");
  await expect(badges).toHaveCount(50);
  for (const [domain, initial] of [
    ["reddit.com", "r"],
    ["9gag.com", "9"],
    ["x.com", "x"],
    ["news.google.com", "n"],
  ] as const) {
    const card = page.getByText(domain, { exact: true }).locator("xpath=..");
    await expect(card.locator("span[aria-hidden='true']")).toHaveText(initial);
  }
});

test("groups sites under category headings in order", async ({ page }) => {
  await page.goto(`${LANDING_URL}blocklist.html`);

  const headings = [
    "Social Networks",
    "Video & Streaming",
    "Entertainment & Humor",
    "News & Media",
    "Sports",
    "Communities & Forums",
    "Games",
    "Reading & Comics",
  ];
  await expect(page.locator("main h2")).toHaveText(headings);

  // Each domain sits under its own category, not a neighbour's.
  const social = page.getByRole("heading", { name: "Social Networks" }).locator("..");
  await expect(social.getByText("reddit.com", { exact: true })).toBeVisible();
  await expect(social.getByText("cnn.com", { exact: true })).toHaveCount(0);

  const news = page.getByRole("heading", { name: "News & Media" }).locator("..");
  await expect(news.getByText("cnn.com", { exact: true })).toBeVisible();
});

test("blocklist page has static category headings but no search or filters", async ({ page }) => {
  await page.goto(`${LANDING_URL}blocklist.html`);

  // Category titles are headings, not interactive filter controls.
  await expect(page.getByRole("heading", { name: "Social Networks" })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Video|Social|News/ })).toHaveCount(0);
});

test("language additions follow the ?lang override", async ({ page }) => {
  await page.goto(`${LANDING_URL}blocklist.html?lang=fr-FR`);

  await expect(page.locator("h1")).toHaveText("La liste de blocage.");
  await expect(page.getByText("lemonde.fr", { exact: true })).toBeVisible();
  await expect(page.getByText("jeuxvideo.com", { exact: true })).toBeVisible();
  // English-only additions are not part of the French list.
  await expect(page.getByText("cnn.com", { exact: true })).toHaveCount(0);
  await expect(page.getByText("espn.com", { exact: true })).toHaveCount(0);

  const rows = page.locator(".grid > .group");
  await expect(rows).toHaveCount(50);
});
