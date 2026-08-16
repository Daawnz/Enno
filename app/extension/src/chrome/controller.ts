import type { SessionEvent, SessionState } from "../core/types";
import { reduceSession } from "../core/stateMachine";
import { applyEffects } from "./effects";
import { loadSession, removeSession, saveSession } from "./storage";

export async function getCurrentState(now = Date.now()): Promise<SessionState> {
  const session = await loadSession();
  // Heal expired focus sessions lazily on read. A poll (blocked page, popup,
  // dashboard) is the safety net for a delayed or missed FOCUS_END alarm
  // (browser suspended, service worker asleep), so the block never outlives
  // its session. runReconcile disables the ruleset before erasing the stored
  // session, so any consumer reacting to the returned "idle" state is safe to
  // navigate; concurrent reads race to the same idle result.
  if (session.phase === "focus" && session.endTime > 0 && session.endTime <= now) {
    return runReconcile(now);
  }
  return session;
}

export async function runTransition(event: SessionEvent, now = Date.now()): Promise<SessionState> {
  const session = await loadSession();
  const { session: next, effects } = reduceSession(session, event, now);
  await applyEffects(effects);
  if (next.phase === "idle")
    await removeSession();
  else
    await saveSession(next);
  return next;
}

export async function runReconcile(now = Date.now()): Promise<SessionState> {
  return runTransition({ type: "RECONCILE" }, now);
}
