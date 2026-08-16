import type { SessionEvent, SessionState } from "./types";
import { describe, expect, it } from "vitest";
import { FOCUS_MS } from "./constants";
import { emptySession, reduceSession } from "./stateMachine";

const NOW = 1_000_000_000_000;
const FOCUS_END = NOW + FOCUS_MS;

function sessionWith(patch: Partial<SessionState>) {
  return { ...emptySession(), ...patch };
}

function reduce(session: SessionState, event: SessionEvent) {
  return reduceSession(session, event, NOW);
}

function start() {
  return reduce(emptySession(), { type: "START" });
}

describe("START", () => {
  it("moves idle to focus with a future end time and enables the ruleset", () => {
    const { session, effects } = start();

    expect(session.phase).toBe("focus");
    expect(session.endTime).toBe(FOCUS_END);

    expect(effects.rulesetEnabled).toBe(true);
    expect(effects.clearAlarms).toEqual(["focus-end"]);
    expect(effects.scheduleAlarm).toEqual({ name: "focus-end", when: FOCUS_END });
  });
});

describe("STOP", () => {
  it("returns to idle with no end time and disables the ruleset", () => {
    const active = start().session;
    const { session, effects } = reduce(active, { type: "STOP" });

    expect(session.phase).toBe("idle");
    expect(session.endTime).toBe(0);
    expect(effects.rulesetEnabled).toBe(false);
    expect(effects.clearAlarms).toEqual(["focus-end"]);
    expect(effects.scheduleAlarm).toBeNull();
  });
});

describe("OVERRIDE", () => {
  it("keeps the session blocking without recording anything", () => {
    const active = start().session;
    const { session, effects } = reduceSession(active, { type: "OVERRIDE" }, NOW - 1000);

    expect(session).toEqual(active);
    expect(effects.rulesetEnabled).toBe(true);
  });

  it("is a no-op outside a focus session", () => {
    const { session, effects } = reduce(emptySession(), { type: "OVERRIDE" });

    expect(session.phase).toBe("idle");
    expect(effects.rulesetEnabled).toBe(false);
  });
});

describe("FOCUS_END", () => {
  it("moves a focus session into idle", () => {
    const { session, effects } = reduce(start().session, { type: "FOCUS_END" });

    expect(session.phase).toBe("idle");
    expect(session.endTime).toBe(0);

    expect(effects.rulesetEnabled).toBe(false);
    expect(effects.scheduleAlarm).toBeNull();
    expect(effects.clearAlarms).toEqual(["focus-end"]);
  });
});

describe("RECONCILE", () => {
  it("reconciles an unexpired focus session by re-scheduling the alarm", () => {
    const { session, effects } = reduce(
      sessionWith({ phase: "focus", endTime: FOCUS_END }),
      { type: "RECONCILE" },
    );

    expect(session.phase).toBe("focus");
    expect(effects.rulesetEnabled).toBe(true);
    expect(effects.scheduleAlarm).toEqual({ name: "focus-end", when: FOCUS_END });
  });

  it("turns an expired focus session into idle", () => {
    const { session } = reduce(sessionWith({ phase: "focus", endTime: NOW - 5000 }), {
      type: "RECONCILE",
    });

    expect(session.phase).toBe("idle");
    expect(session.endTime).toBe(0);
  });

  it("keeps an idle session idle with the ruleset off", () => {
    const { session, effects } = reduce(emptySession(), { type: "RECONCILE" });

    expect(session.phase).toBe("idle");
    expect(effects.rulesetEnabled).toBe(false);
    expect(effects.scheduleAlarm).toBeNull();
  });
});
