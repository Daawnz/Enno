import type { MessageSender } from "./browser";
import type { SessionEvent } from "./core/types";
import type { MessageRequest, MessageResponse } from "./protocol";
import { browser } from "./browser";
import { runReconcile, runTransition } from "./chrome/controller";
import { initLocale } from "./chrome/i18n";
import { handleMessage } from "./chrome/messaging";
import { passCoversUrl, registerPassCleanup, retryBlockedPassNavigation } from "./chrome/pass";
import {
  applyThemePreferenceToIcon,
  initTheme,
  isThemePreference,
  THEME_PREFERENCE_STORAGE_KEY,
} from "./chrome/theme";
import { blockedRootDomainOf } from "./core/blocklist";
import { FOCUS_ALARM } from "./core/constants";

void initLocale();
void initTheme();

// Keep the Chrome toolbar icon in sync when the user changes the extension’s
// Light/Dark preference from any page. Firefox keeps its native browser-theme icons.
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local")
    return;
  const change = changes[THEME_PREFERENCE_STORAGE_KEY];
  if (change && isThemePreference(change.newValue))
    void applyThemePreferenceToIcon(change.newValue);
});

const tabLastUrl = new Map<number, string>();

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  }
  catch {
    return null;
  }
}

// The focus ruleset blocks (declarativeNetRequest `block`) main-frame
// navigations to blocked domains, so a real response never arrives. The block
// surfaces the blocked page in the tab; the page itself handles the override
// flow and the end-of-session redirect. This replaces a DNR `redirect` rule,
// which would require a host_permission per blocked domain (Chrome gives
// implicit host access to `block` and `allow` rules only), defeating the
// no-per-site-access install prompt.
browser.webNavigation.onErrorOccurred.addListener((details) => {
  if (details.frameId !== 0)
    return;
  const host = hostOf(details.url);
  if (!host || blockedRootDomainOf(host) === null)
    return;
  // A grant installs a dynamic `allow` rule and navigates immediately; DNR
  // rule application can trail the very next navigation by a few ms, so that
  // navigation can be re-blocked once by the static blocklist rule. Treat only
  // that case (a declarativeNetRequest block) as transient and retry the same
  // URL (bounded) instead of bouncing the user back to the blocked page.
  //
  // Any OTHER failure on a URL inside a granted pass - e.g. a non-committing
  // 204 abort of the post-unlock auto-navigation standing in for a pre-commit
  // redirect hop - leaves the pass live until a real commit. Swapping in
  // blocked.html there would re-navigate the tab and abort the follow-up
  // navigation to the passed domain, so those errors must be ignored. Only a
  // genuine block (no pass, or exceeded retries) shows the blocked page.
  if (
    details.error?.includes("ERR_BLOCKED_BY_CLIENT")
    && retryBlockedPassNavigation(details.tabId, details.url)
  ) {
    return;
  }
  if (passCoversUrl(details.tabId, details.url))
    return;
  void showBlockedPage(details.tabId);
});

async function showBlockedPage(tabId: number): Promise<void> {
  try {
    await browser.tabs.update(tabId, { url: browser.runtime.getURL("blocked.html") });
  }
  catch {
    // The tab was closed while the update was in flight.
  }
}

browser.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0) {
    const url = details.url;
    if (url && !url.includes("blocked.html") && !url.startsWith("chrome-extension://") && !url.startsWith("about:")) {
      tabLastUrl.set(details.tabId, url);
    }
  }
});

registerPassCleanup();

browser.runtime.onInstalled.addListener(() => {
  void runReconcile();
});

browser.runtime.onStartup.addListener(() => {
  void runReconcile();
});

browser.alarms.onAlarm.addListener((alarm) => {
  const event: SessionEvent | null
    = alarm.name === FOCUS_ALARM ? { type: "FOCUS_END" } : null;
  if (event)
    void runTransition(event);
});

function onMessage(
  message: MessageRequest,
  sender: MessageSender,
  sendResponse: (response: MessageResponse) => void,
) {
  const req = message as MessageRequest & { targetUrl?: string };
  if (req.type === "getTarget") {
    // The last real navigation in this tab: what was blocked / where to go
    // back to. blocked.html and other extension pages are excluded from the
    // map, so this is the blocked destination, never the blocked page itself.
    const targetUrl = sender?.tab?.id ? tabLastUrl.get(sender.tab.id) ?? null : null;
    void Promise.resolve({ targetUrl } satisfies MessageResponse).then(sendResponse);
    return true;
  }
  const targetUrl = sender?.tab?.id ? tabLastUrl.get(sender.tab.id) : undefined;
  void handleMessage({ ...req, targetUrl: req.targetUrl || targetUrl }, sender).then(
    sendResponse,
    error => sendResponse({ error: String(error) }),
  );
  return true;
}

browser.runtime.onMessage.addListener(onMessage);
browser.runtime.onMessageExternal.addListener(onMessage);
