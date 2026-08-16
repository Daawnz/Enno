import type { MessageSender } from "./browser";
import type { SessionEvent } from "./core/types";
import type { MessageRequest, MessageResponse } from "./protocol";
import { browser } from "./browser";
import { runReconcile, runTransition } from "./chrome/controller";
import { initLocale } from "./chrome/i18n";
import { handleMessage } from "./chrome/messaging";
import { registerPassCleanup } from "./chrome/pass";
import { handleThemeChanged, initTheme } from "./chrome/theme";
import { FOCUS_ALARM } from "./core/constants";

void initLocale();
void initTheme();

const tabLastUrl = new Map<number, string>();

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
  if (handleThemeChanged(req))
    return; // consumed by the toolbar-icon adapter; no response expected
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
