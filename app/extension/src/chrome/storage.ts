import type { SessionState } from "../core/types";
import { browser } from "../browser";
import { migrateSession, serializeSession } from "../core/migration";

const STORAGE_KEY = "focus";

export async function loadSession(): Promise<SessionState> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return migrateSession(stored[STORAGE_KEY]);
}

export async function saveSession(session: SessionState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: serializeSession(session) });
}

export async function removeSession(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEY);
}
