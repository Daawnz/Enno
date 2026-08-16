import { expect } from "@playwright/test";
import {
  BLOCKLIST_RULESET,
  forceAlarm,
  getEnabledRulesets,
  getState,
  send,
  setSessionEndTime,
  test,
} from "./fixtures";

function blockedUrl(extensionId: string) {
  return `chrome-extension://${extensionId}/blocked.html`;
}

test.beforeEach(async ({ reset }) => {
  await reset();
});

test("focus copy on direct navigation (no referrer)", async ({ extContext, extensionId }) => {
  await send(extContext, "start");
  const page = await extContext.newPage();
  await page.goto(blockedUrl(extensionId));

  await expect(page.locator("#title")).toHaveText("Stay focused");
  await expect(page.locator("#sub")).toHaveText(
    "This site is blocked until the session ends.",
  );
  await expect(page.locator("#override-btn")).toBeVisible();
  await expect(page.locator("#override-btn")).toHaveText("Hold to unlock");
});

test("progress wheel renders like the popup", async ({ extContext, extensionId }) => {
  await send(extContext, "start");
  const page = await extContext.newPage();
  await page.goto(blockedUrl(extensionId));

  const ring = page.locator("#ring");
  // The wheel must be an SVG circle driven by the timer, not a plain div.
  await expect(ring).toHaveClass(/ring-fill/);
  await expect(page.locator("#dial .ring-track")).toBeVisible();
  await expect
    .poll(() => ring.evaluate(el => Number.parseFloat((el as SVGElement).style.strokeDasharray)))
    .toBeGreaterThan(0);
});

test("blocked copy when reached via redirect", async ({ extContext }) => {
  await send(extContext, "start");
  const page = await extContext.newPage();
  await page.goto("https://www.reddit.com/");

  await expect(page).toHaveURL(/chrome-extension:\/\/[^/]+\/blocked.html/);
  await expect(page.locator("#title")).toHaveText("Stay focused");
  await expect(page.locator("#sub")).toHaveText(
    "www.reddit.com is blocked until the session ends.",
  );
});

test("idle copy after a completed session", async ({ extContext, extensionId }) => {
  await send(extContext, "start");
  await forceAlarm(extContext, "focus-end");
  await expect.poll(async () => (await getState(extContext)).phase).toBe("idle");

  const page = await extContext.newPage();
  await page.goto(blockedUrl(extensionId));

  await expect(page.locator("#title")).toHaveText("Focus complete");
  await expect(page.locator("#sub")).toHaveText(
    "The session has ended. This site is unlocked again.",
  );
  await expect(page.locator("#override-btn")).toBeHidden();
  await expect(page.locator("#back")).toBeVisible();
});

test("loading wheel is present but hidden until unlock", async ({ extContext }) => {
  await send(extContext, "start");
  const page = await extContext.newPage();
  await page.goto("https://www.reddit.com/");
  await expect(page).toHaveURL(/chrome-extension:\/\/[^/]+\/blocked.html/);

  // Hidden by default - only shown while the unlock redirect is in flight.
  await expect(page.locator("#loading")).toBeHidden();
  await expect(page.locator(".blocked-card")).toBeVisible();
});

test("override passes once; a refresh re-blocks", async ({ extContext }) => {
  await send(extContext, "start");
  await expect.poll(() => getEnabledRulesets(extContext)).toContain(BLOCKLIST_RULESET);

  const page = await extContext.newPage();
  let hits = 0;
  await extContext.route("https://www.reddit.com/**", (route) => {
    hits += 1;
    return route.fulfill({ body: "<html><body>site loaded</body></html>", contentType: "text/html" });
  });
  await page.goto("https://www.reddit.com/");
  await expect(page).toHaveURL(/chrome-extension:\/\/[^/]+\/blocked.html/);

  const overrideBtn = page.locator("#override-btn");
  await overrideBtn.dispatchEvent("mousedown", { button: 0 });
  await page.clock.runFor(3000);

  await expect(page).toHaveURL(/https:\/\/www\.reddit\.com\/.*/);
  await expect(page.locator("body")).toHaveText("site loaded");
  expect(hits).toBe(1);

  const state = await getState(extContext);
  expect(state.phase).toBe("focus");
  await expect.poll(() => getEnabledRulesets(extContext)).toContain(BLOCKLIST_RULESET);

  await page.reload();
  await expect(page).toHaveURL(/chrome-extension:\/\/[^/]+\/blocked.html/);
  expect(hits).toBe(1);
});

test("unlock goes to the blocked site, not the referrer", async ({ extContext }) => {
  await send(extContext, "start");
  await expect.poll(() => getEnabledRulesets(extContext)).toContain(BLOCKLIST_RULESET);

  const page = await extContext.newPage();
  let hits = 0;
  await extContext.route("https://www.reddit.com/**", (route) => {
    hits += 1;
    return route.fulfill({ body: "<html><body>site loaded</body></html>", contentType: "text/html" });
  });
  // Stand in for clicking a reddit result while browsing google.
  await page.goto("https://www.reddit.com/", { referer: "https://www.google.com/" });
  await expect(page).toHaveURL(/chrome-extension:\/\/[^/]+\/blocked.html/);
  await expect(page.locator("#sub")).toHaveText(
    "www.reddit.com is blocked until the session ends.",
  );

  const overrideBtn = page.locator("#override-btn");
  await overrideBtn.dispatchEvent("mousedown", { button: 0 });
  await page.clock.runFor(3000);

  // Must land on the blocked site, not the referrer (google).
  await expect(page).toHaveURL(/https:\/\/www\.reddit\.com\/.*/);
  await expect(page.locator("body")).toHaveText("site loaded");
  expect(hits).toBe(1);
});

test("unlock follows a redirect chain into a blocked subdomain; a refresh re-blocks", async ({ extContext }) => {
  await send(extContext, "start");
  await expect.poll(() => getEnabledRulesets(extContext)).toContain(BLOCKLIST_RULESET);

  const page = await extContext.newPage();
  const hits: string[] = [];
  // Post-unlock, the auto-navigation to the granted host (www.reddit.com) is
  // answered with a 204 so nothing commits - standing in for the un-committed
  // redirect hop reddit.com -> old.reddit.com that the browser follows before
  // the first commit. (Playwright does not intercept the target of a fulfilled
  // 3xx redirect, so the hop cannot be stubbed as a real 302 chain.)
  await extContext.route("https://www.reddit.com/**", (route) => {
    hits.push("www");
    return route.fulfill({ status: 204, body: "" });
  });
  await extContext.route("https://old.reddit.com/**", (route) => {
    hits.push("old");
    return route.fulfill({ body: "<html><body>old site loaded</body></html>", contentType: "text/html" });
  });

  await page.goto("https://www.reddit.com/");
  await expect(page).toHaveURL(/chrome-extension:\/\/[^/]+\/blocked.html/);
  expect(hits).toEqual([]);

  const overrideBtn = page.locator("#override-btn");
  await overrideBtn.dispatchEvent("mousedown", { button: 0 });
  await page.clock.runFor(3000);
  // Wait for the auto-navigation to the granted host to be consumed.
  await expect.poll(() => hits).toEqual(["www"]);

  // The pass for reddit.com also covers its subdomains: the redirect chain
  // lands on old.reddit.com within the same pass.
  await page.goto("https://old.reddit.com/");
  await expect(page).toHaveURL(/https:\/\/old\.reddit\.com\/.*/);
  await expect(page.locator("body")).toHaveText("old site loaded");
  expect(hits).toEqual(["www", "old"]);

  const state = await getState(extContext);
  expect(state.phase).toBe("focus");
  await expect.poll(() => getEnabledRulesets(extContext)).toContain(BLOCKLIST_RULESET);

  await page.reload();
  await expect(page).toHaveURL(/chrome-extension:\/\/[^/]+\/blocked.html/);
  expect(hits).toEqual(["www", "old"]);
});

test("blocked tab open when the session ends lands on the target once; no bounce loop", async ({ extContext }) => {
  await send(extContext, "start");
  await expect.poll(() => getEnabledRulesets(extContext)).toContain(BLOCKLIST_RULESET);

  const page = await extContext.newPage();
  let hits = 0;
  await extContext.route("https://www.reddit.com/**", (route) => {
    hits += 1;
    return route.fulfill({ body: "<html><body>site loaded</body></html>", contentType: "text/html" });
  });
  await page.goto("https://www.reddit.com/");
  await expect(page).toHaveURL(/chrome-extension:\/\/[^/]+\/blocked.html/);

  // End the session while the blocked tab is open. The redirect to the target
  // is driven by the polled idle state only (never by a local countdown, which
  // would race the ruleset teardown and bounce back into the still-active
  // block rule).
  await forceAlarm(extContext, "focus-end");
  await page.clock.runFor(1000); // let the 250ms poll observe idle

  await expect(page).toHaveURL(/https:\/\/www\.reddit\.com\/.*/);
  await expect(page.locator("body")).toHaveText("site loaded");
  expect(hits).toBe(1);
});

test("blocked tab self-heals when the session-end alarm is missed", async ({ extContext }) => {
  await send(extContext, "start");
  await expect.poll(() => getEnabledRulesets(extContext)).toContain(BLOCKLIST_RULESET);

  const page = await extContext.newPage();
  let hits = 0;
  await extContext.route("https://www.reddit.com/**", (route) => {
    hits += 1;
    return route.fulfill({ body: "<html><body>site loaded</body></html>", contentType: "text/html" });
  });
  await page.goto("https://www.reddit.com/");
  await expect(page).toHaveURL(/chrome-extension:\/\/[^/]+\/blocked.html/);

  // Simulate a missed/late alarm: the stored session expires while the alarm
  // stays silent (chrome.alarms is browser-level and is not ticked by the
  // page clock, so no FOCUS_END transition runs).
  await setSessionEndTime(extContext, Date.now() - 1000);

  // The page's next poll heals the expired session and redirects to the
  // target once the block is actually lifted.
  await page.clock.runFor(1000);
  await expect(page).toHaveURL(/https:\/\/www\.reddit\.com\/.*/);
  await expect(page.locator("body")).toHaveText("site loaded");
  expect(hits).toBe(1);
  await expect.poll(() => getEnabledRulesets(extContext)).not.toContain(BLOCKLIST_RULESET);
});
