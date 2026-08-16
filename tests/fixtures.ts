import type { BrowserContext, Page, Worker } from "@playwright/test";
import type { StoredSession } from "../app/extension/src/core/migration";
import type { SessionState } from "../app/extension/src/core/types";
import type {
  MessageResponse,
  MessageType,
  PingResponse,
  TargetResponse,
} from "../app/extension/src/protocol";
import path from "node:path";
import { test as base, chromium, expect } from "@playwright/test";
import { ALL_RULESET_IDS } from "../app/extension/src/core/blocklist";

export const EXTENSION_PATH = path.resolve(__dirname, "../dist/extension");
export const LANDING_URL = "http://localhost:8000/";
export const BLOCKLIST_RULESET = "blocklist";

const LAUNCH_ARGS = [
  `--disable-extensions-except=${EXTENSION_PATH}`,
  `--load-extension=${EXTENSION_PATH}`,
];

export async function launchExtensionContext(
  userDataDir = "",
  options: Parameters<typeof chromium.launchPersistentContext>[1] = {},
): Promise<BrowserContext> {
  return chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    args: LAUNCH_ARGS,
    ...options,
  });
}

export async function getServiceWorker(context: BrowserContext): Promise<Worker> {
  let [sw] = context.serviceWorkers();
  if (!sw)
    sw = await context.waitForEvent("serviceworker");
  return sw;
}

// ---------------------------------------------------------------------------
// Page-driven harness
//
// Every helper below talks to the extension through one persistent popup page
// per context, never through the MV3 service worker. Extension pages expose
// the same chrome.* surface as the service worker (storage, alarms, DNR,
// runtime messaging), and the page is always warm, so tests never pay for a
// service-worker cold boot inside the 2.5s test budget nor race its
// termination. The service worker is only ever looked up once per context to
// discover the extension id (an extension page cannot be reached without it).
// ---------------------------------------------------------------------------

const extensionIds = new WeakMap<BrowserContext, string>();
const harnessPages = new WeakMap<BrowserContext, Page>();

export async function getExtensionId(context: BrowserContext): Promise<string> {
  const cached = extensionIds.get(context);
  if (cached)
    return cached;
  const sw = await getServiceWorker(context);
  const id = sw.url().split("/")[2];
  extensionIds.set(context, id);
  return id;
}

export async function getHarnessPage(context: BrowserContext): Promise<Page> {
  const existing = harnessPages.get(context);
  if (existing && !existing.isClosed())
    return existing;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${await getExtensionId(context)}/popup.html`);
  harnessPages.set(context, page);
  return page;
}

type WorkerFixtures = {
  extContext: BrowserContext;
  extensionId: string;
  harness: Page;
};

type TestFixtures = {
  reset: () => Promise<void>;
};

// Booting Chromium, registering the MV3 service worker, and opening the
// harness page can exceed the 2.5s test budget on a cold start or under
// parallel worker load (observed up to ~6s). That ceiling is for test bodies
// (see playwright.config); worker-scoped setup gets its own budget so a slow
// first SW registration does not fail every extension test in a worker.
const WORKER_SETUP_TIMEOUT = 20_000;

export const test = base.extend<TestFixtures, WorkerFixtures>({
  extContext: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const context = await launchExtensionContext();
      await context.clock.install();
      await use(context);
      await context.close();
    },
    { scope: "worker", timeout: WORKER_SETUP_TIMEOUT },
  ],
  extensionId: [
    async ({ extContext }, use) => {
      await use(await getExtensionId(extContext));
    },
    { scope: "worker", timeout: WORKER_SETUP_TIMEOUT },
  ],
  harness: [
    async ({ extContext }, use) => {
      await use(await getHarnessPage(extContext));
    },
    { scope: "worker", timeout: WORKER_SETUP_TIMEOUT },
  ],
  reset: async ({ extContext, harness }, use) => {
    await use(async () => {
      // The harness page is shared infrastructure; close every other page so
      // each test starts with an empty tab list.
      for (const page of extContext.pages()) {
        if (page !== harness)
          await page.close().catch(() => {});
      }
      await extContext.unrouteAll();
      const allRulesetIds = [...ALL_RULESET_IDS];
      await harness.evaluate(async (rulesetIds) => {
        await chrome.storage.local.clear();
        await chrome.alarms.clearAll();
        await chrome.declarativeNetRequest.updateEnabledRulesets({
          disableRulesetIds: rulesetIds,
        });
      }, allRulesetIds);
      // DNR/storage/alarm updates are browser-level async operations that can
      // outlive the evaluate that issued them. Verify the reset landed so the
      // next test never observes stale focus state or a still-active ruleset.
      await expect.poll(async () => (await getState(extContext)).phase).toBe("idle");
      await expect.poll(() => getEnabledRulesets(extContext)).not.toContain(BLOCKLIST_RULESET);
    });
  },
});

type SendResponse = SessionState | PingResponse | TargetResponse;

export async function send(
  context: BrowserContext,
  type: MessageType,
  extra?: Record<string, unknown>,
): Promise<SendResponse> {
  const page = await getHarnessPage(context);
  const response = await page.evaluate(
    ({ type, extra }) =>
      new Promise<MessageResponse>(resolve =>
        chrome.runtime.sendMessage({ type, ...extra }, resolve),
      ),
    { type, extra },
  );
  if (response && "error" in response)
    throw new Error(response.error);
  if (response && "session" in response)
    return response.session;
  return response;
}

export async function getState(context: BrowserContext): Promise<SessionState> {
  return send(context, "getState") as Promise<SessionState>;
}

export async function getEnabledRulesets(context: BrowserContext): Promise<string[]> {
  const page = await getHarnessPage(context);
  return page.evaluate(() => chrome.declarativeNetRequest.getEnabledRulesets());
}

export async function getStoredFocus(context: BrowserContext): Promise<unknown> {
  const page = await getHarnessPage(context);
  return page.evaluate(async () => (await chrome.storage.local.get("focus")).focus);
}

// Simulate a focus-end alarm by directly expiring the stored session and
// triggering lazy reconciliation on the next read.  Creating a chrome.alarms
// alarm from a page is unreliable with Chromium's MV3 service worker under
// Playwright's fake clock (alarm delivery races SW termination / fake-clock
// scheduling).  The reconcile path in getCurrentState produces the same
// effects as the real FOCUS_END transition: idle, ruleset off, alarm cleared.
//
// The expiry is computed with the Node test process clock, which tracks the
// service worker's clock, never with the page clock: tests that call
// page.clock.runFor() drift page-local fake time ahead of the worker, so an
// endTime derived from a page's Date.now() can still lie in the worker's
// future and the expired session would never reconcile.
export async function forceAlarm(context: BrowserContext, name: string): Promise<void> {
  if (name === "focus-end") {
    const page = await getHarnessPage(context);
    await page.evaluate(async (expiredAt) => {
      const { focus } = (await chrome.storage.local.get("focus")) as { focus: StoredSession };
      focus.session.endTime = expiredAt;
      await chrome.storage.local.set({ focus });
    }, Date.now() - 5000);
    // Prod the SW to call getCurrentState, which reconciles expired sessions
    // lazily on every read.
    await send(context, "getState");
    return;
  }
  const page = await getHarnessPage(context);
  return page.evaluate(({ name, when }) => chrome.alarms.create(name, { when }), {
    name,
    when: Date.now() - 1000,
  });
}

// Rewrites the stored session end time, standing in for a delayed or missed
// FOCUS_END alarm: the next read (or poll) lazily reconciles the expired
// session into idle, exactly as the extension does in production.
//
// Pass a timestamp from the Node test process clock (the service worker's
// clock), not page-local fake time: page.clock.runFor() drifts pages ahead
// of the worker, so an expired time computed inside a page can still be in
// the worker's future and never reconcile.
export async function setSessionEndTime(context: BrowserContext, endTime: number): Promise<void> {
  const page = await getHarnessPage(context);
  return page.evaluate(async (endTime) => {
    const { focus } = (await chrome.storage.local.get("focus")) as { focus: StoredSession };
    focus.session.endTime = endTime;
    await chrome.storage.local.set({ focus });
  }, endTime);
}

export async function openPopup(
  context: BrowserContext,
  extensionId: string,
): Promise<import("@playwright/test").Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  return page;
}
