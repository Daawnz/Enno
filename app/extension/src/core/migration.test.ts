import type { SessionState } from "./types";
import { describe, expect, it } from "vitest";
import { migrateSession, SCHEMA_VERSION, serializeSession } from "./migration";

const SESSION: SessionState = {
  phase: "focus",
  endTime: 1_000,
};

describe("serializeSession", () => {
  it("wraps a session in a versioned envelope", () => {
    expect(serializeSession(SESSION)).toEqual({ schemaVersion: SCHEMA_VERSION, session: SESSION });
  });
});

describe("migrateSession", () => {
  it("returns an empty session for missing storage", () => {
    expect(migrateSession(undefined)).toEqual({
      phase: "idle",
      endTime: 0,
    });
  });

  it("returns an empty session for garbage", () => {
    expect(migrateSession("garbage")).toEqual(expect.objectContaining({ phase: "idle" }));
    expect(migrateSession(42)).toEqual(expect.objectContaining({ phase: "idle" }));
  });

  it("unwraps a versioned envelope", () => {
    expect(migrateSession(serializeSession(SESSION))).toEqual(SESSION);
  });

  it("accepts the legacy unversioned blob", () => {
    expect(migrateSession(SESSION)).toEqual(SESSION);
  });

  it("coerces an unknown phase to idle", () => {
    const migrated = migrateSession({ ...SESSION, phase: "warp" });
    expect(migrated.phase).toBe("idle");
  });

  it("maps a stored overridden phase to focus", () => {
    const migrated = migrateSession({ ...SESSION, phase: "overridden" });
    expect(migrated.phase).toBe("focus");
    expect(migrated.endTime).toBe(1000);
  });

  it("defaults missing fields", () => {
    const migrated = migrateSession({ phase: "focus" });
    expect(migrated.endTime).toBe(0);
  });
});
