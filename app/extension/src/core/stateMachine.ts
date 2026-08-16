import type { FocusPhase, SessionEvent, SessionState, Transition } from "./types";
import {
  FOCUS_ALARM,
  FOCUS_MS,
} from "./constants";

export function emptySession(): SessionState {
  return {
    phase: "idle",
    endTime: 0,
  };
}

export function reduceSession(session: SessionState, event: SessionEvent, now: number): Transition {
  switch (event.type) {
    case "START":
      return startFocus(session, now);
    case "STOP":
      return stopFocus(session);
    case "OVERRIDE":
      return noChange(session);
    case "FOCUS_END":
      return onFocusEnd(session);
    case "RECONCILE":
      return reconcile(session, now);
  }
}

function startFocus(session: SessionState, now: number): Transition {
  const endTime = now + FOCUS_MS;
  return {
    session: { ...session, phase: "focus", endTime },
    effects: {
      rulesetEnabled: true,
      clearAlarms: [FOCUS_ALARM],
      scheduleAlarm: { name: FOCUS_ALARM, when: endTime },
    },
  };
}

function stopFocus(session: SessionState): Transition {
  return {
    session: { ...session, phase: "idle", endTime: 0 },
    effects: {
      rulesetEnabled: false,
      clearAlarms: [FOCUS_ALARM],
      scheduleAlarm: null,
    },
  };
}

function onFocusEnd(session: SessionState): Transition {
  if (session.phase !== "focus")
    return noChange(session);
  return toIdle(session);
}

function reconcile(session: SessionState, now: number): Transition {
  const expired = session.endTime > 0 && session.endTime <= now;

  if (expired && session.phase === "focus")
    return toIdle(session);

  if (session.phase === "idle") {
    return noChange(session);
  }

  return {
    session,
    effects: {
      rulesetEnabled: isBlocking(session.phase),
      clearAlarms: [FOCUS_ALARM],
      scheduleAlarm: {
        name: FOCUS_ALARM,
        when: session.endTime,
      },
    },
  };
}

function toIdle(session: SessionState): Transition {
  return {
    session: { ...session, phase: "idle", endTime: 0 },
    effects: {
      rulesetEnabled: false,
      clearAlarms: [FOCUS_ALARM],
      scheduleAlarm: null,
    },
  };
}

function noChange(session: SessionState): Transition {
  return {
    session,
    effects: {
      rulesetEnabled: isBlocking(session.phase),
      clearAlarms: [],
      scheduleAlarm: null,
    },
  };
}

export function isBlocking(phase: FocusPhase): boolean {
  return phase === "focus";
}
