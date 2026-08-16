import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect } from "@playwright/test";
import {
  BLOCKLIST_RULESET,
  forceAlarm,
  getEnabledRulesets,
  getExtensionId,
  getState,
  getStoredFocus,
  launchExtensionContext,
  send,
  setSessionEndTime,
  test,
} from "./fixtures";

test.beforeEach(async ({ reset }) => {
  await reset();
});

test("start moves to focus, schedules an alarm, and enables the ruleset", async ({
  extContext,
}) => {
  const before = Date.now();
  await send(extContext, "start");

  const state = await getState(extContext);
  expect(state.phase).toBe("focus");
  expect(state.endTime).toBeGreaterThan(before);
  expect(state.endTime).toBeGreaterThan(Date.now());
  await expect.poll(() => getEnabledRulesets(extContext)).toContain(BLOCKLIST_RULESET);
});

test("stop returns to idle and disables the ruleset", async ({ extContext }) => {
  await send(extContext, "start");
  await send(extContext, "stop");

  const state = await getState(extContext);
  expect(state.phase).toBe("idle");
  expect(state.endTime).toBe(0);
  expect(await getStoredFocus(extContext)).toBeUndefined();
  await expect.poll(() => getEnabledRulesets(extContext)).not.toContain(BLOCKLIST_RULESET);
});

test("override keeps the ruleset enabled without storing a log", async ({ extContext }) => {
  await send(extContext, "start");
  await send(extContext, "override");

  const state = await getState(extContext);
  expect(state.phase).toBe("focus");
  await expect.poll(() => getEnabledRulesets(extContext)).toContain(BLOCKLIST_RULESET);
});

test("focus completes into idle when the focus-end alarm fires", async ({ extContext }) => {
  await send(extContext, "start");
  await forceAlarm(extContext, "focus-end");

  await expect.poll(async () => (await getState(extContext)).phase).toBe("idle");
  const state = await getState(extContext);
  expect(state.endTime).toBe(0);
  expect(await getStoredFocus(extContext)).toBeUndefined();
  await expect.poll(() => getEnabledRulesets(extContext)).not.toContain(BLOCKLIST_RULESET);
});

test("mid-session browser restart keeps the session and the block", async () => {
  // Boots a second persistent Chromium context mid-test; a cold service-worker
  // wake plus a fresh extension boot needs its own budget.
  test.setTimeout(30_000);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "Enno-restart-"));

  const ctx1 = await launchExtensionContext(dir);
  const extensionId = await getExtensionId(ctx1);
  await send(ctx1, "start");
  await ctx1.close();

  try {
    const ctx2 = await launchExtensionContext(dir);
    const state = await getState(ctx2);
    expect(state.phase).toBe("focus");
    await expect.poll(() => getEnabledRulesets(ctx2)).toContain(BLOCKLIST_RULESET);

    const page = await ctx2.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.locator("#end-focus-button")).toBeVisible();
    await page.goto("https://www.reddit.com/");
    await expect(page).toHaveURL(/chrome-extension:\/\/[^/]+\/blocked.html/);

    await ctx2.close();
  }
  finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an expired focus session heals lazily on the next read", async ({ extContext }) => {
  await send(extContext, "start");
  await expect.poll(() => getEnabledRulesets(extContext)).toContain(BLOCKLIST_RULESET);

  // Simulate a missed/late end-of-session alarm: the stored session expires
  // without any FOCUS_END transition (nothing fires chrome.alarms here).
  await setSessionEndTime(extContext, Date.now() - 5000);

  // The next read reconciles the expired session into idle and lifts the block.
  const state = await getState(extContext);
  expect(state.phase).toBe("idle");
  expect(state.endTime).toBe(0);
  expect(await getStoredFocus(extContext)).toBeUndefined();
  await expect.poll(() => getEnabledRulesets(extContext)).not.toContain(BLOCKLIST_RULESET);
});

test("an expired session is reconciled into idle on startup", async () => {
  // Same as the restart test: a second cold browser context needs its own budget.
  test.setTimeout(30_000);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "Enno-reconcile-"));

  const ctx1 = await launchExtensionContext(dir);
  await send(ctx1, "start");
  await setSessionEndTime(ctx1, Date.now() - 5000);
  await ctx1.close();

  try {
    const ctx2 = await launchExtensionContext(dir);
    await expect.poll(async () => (await getState(ctx2)).phase).toBe("idle");
    await expect.poll(() => getEnabledRulesets(ctx2)).not.toContain(BLOCKLIST_RULESET);
    await ctx2.close();
  }
  finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
