import { describe, expect, it } from "vitest";
import { FOCUS_MS } from "./constants";
import { formatCountdown, remainingMs, ringProgress } from "./timer";

describe("formatCountdown", () => {
  it("formats a full focus session", () => {
    expect(formatCountdown(FOCUS_MS)).toBe("90:00");
  });

  it("formats a break", () => {
    expect(formatCountdown(5 * 60 * 1000)).toBe("05:00");
  });

  it("rounds partial seconds up", () => {
    expect(formatCountdown(61_499)).toBe("01:02");
    expect(formatCountdown(999)).toBe("00:01");
  });

  it("clamps negative values to zero", () => {
    expect(formatCountdown(-500)).toBe("00:00");
    expect(formatCountdown(0)).toBe("00:00");
  });
});

describe("remainingMs", () => {
  it("returns the remaining time for a live end time", () => {
    expect(remainingMs(1_000, 400)).toBe(600);
  });

  it("returns zero when there is no end time", () => {
    expect(remainingMs(0, 1_000)).toBe(0);
  });
});

describe("ringProgress", () => {
  it("returns the remaining fraction of a session", () => {
    const total = 1000;
    expect(ringProgress(1_000, total, 500)).toBeCloseTo(0.5);
  });

  it("is full when the session has just started", () => {
    expect(ringProgress(1_000, 1_000, 0)).toBe(1);
  });

  it("is empty once the session end has passed", () => {
    expect(ringProgress(500, 1_000, 5_000)).toBe(0);
  });

  it("shows a full ring when idle", () => {
    expect(ringProgress(0, 1_000, 5_000)).toBe(1);
  });
});
