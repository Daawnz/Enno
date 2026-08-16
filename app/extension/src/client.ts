import type { SessionState } from "./core/types";
import type { MessageResponse } from "./protocol";
import { browser } from "./browser";

export async function fetchSession(): Promise<SessionState> {
  return assertSession(await browser.runtime.sendMessage({ type: "getState" }));
}

export async function sendAction(
  type: "start" | "stop" | "override",
  targetUrl?: string,
): Promise<SessionState> {
  return assertSession(await browser.runtime.sendMessage({ type, targetUrl }));
}

export async function fetchTarget(): Promise<string | null> {
  const parsed = (await browser.runtime.sendMessage({ type: "getTarget" })) as MessageResponse;
  if ("error" in parsed)
    throw new Error(parsed.error);
  if ("targetUrl" in parsed)
    return parsed.targetUrl;
  throw new Error("unexpected extension response");
}

function assertSession(response: unknown) {
  const parsed = response as MessageResponse;
  if ("error" in parsed)
    throw new Error(parsed.error);
  if ("session" in parsed)
    return parsed.session;
  throw new Error("unexpected extension response");
}
