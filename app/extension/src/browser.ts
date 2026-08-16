const api
  = (globalThis as { browser?: unknown }).browser
    ?? (typeof chrome !== "undefined" ? chrome : undefined);
export const browser = api as typeof chrome;
export type MessageSender = chrome.runtime.MessageSender;
