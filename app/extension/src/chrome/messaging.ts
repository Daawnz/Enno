import type { MessageSender } from "../browser";
import type { SessionEvent } from "../core/types";
import type { MessageResponse } from "../protocol";
import { browser } from "../browser";
import { getCurrentState, runTransition } from "./controller";
import { grantPass } from "./pass";

const ACTION_EVENTS: Record<"start" | "stop" | "override", () => SessionEvent> = {
  start: () => ({ type: "START" }),
  stop: () => ({ type: "STOP" }),
  override: () => ({ type: "OVERRIDE" }),
};

export async function handleMessage(
  message: { type: string; targetUrl?: string },
  sender?: MessageSender,
): Promise<MessageResponse> {
  switch (message.type) {
    case "getState":
      return { session: await getCurrentState() };
    case "ping":
      return { ok: true };
    case "start":
    case "stop": {
      const session = await runTransition(ACTION_EVENTS[message.type]());
      return { session };
    }
    case "override": {
      const session = await runTransition(ACTION_EVENTS.override());
      if (message.targetUrl) {
        let tabId = sender?.tab?.id;
        if (!tabId) {
          const tabs = await browser.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.id)
            tabId = tabs[0].id;
        }
        if (tabId) {
          const granted = await grantPass(tabId, message.targetUrl);
          if (granted) {
            try {
              await browser.tabs.update(tabId, { url: message.targetUrl });
            }
            catch {
              // ignore
            }
          }
        }
      }
      return { session };
    }
    default:
      return { error: `unknown message type: ${message.type}` };
  }
}
