import type { FocusPhase, SessionState } from "./types";
import { emptySession } from "./stateMachine";

export const SCHEMA_VERSION = 1;

export type StoredSession = {
  schemaVersion: number;
  session: SessionState;
};

const VALID_PHASES: readonly FocusPhase[] = ["idle", "focus"];

export function serializeSession(session: SessionState): StoredSession {
  return { schemaVersion: SCHEMA_VERSION, session };
}

export function migrateSession(raw: unknown): SessionState {
  const candidate = extractCandidate(raw);
  if (!candidate)
    return emptySession();
  return sanitize(candidate);
}

function extractCandidate(raw: unknown) {
  if (!raw || typeof raw !== "object")
    return null;
  const stored = raw as Partial<StoredSession>;
  if (stored.schemaVersion === SCHEMA_VERSION && stored.session)
    return stored.session;
  const legacy = raw as Partial<SessionState>;
  if (typeof legacy.phase === "string")
    return legacy;
  return null;
}

function sanitize(candidate: Partial<SessionState>) {
  const base = emptySession();
  return {
    phase:
      (candidate.phase as string | undefined) === "overridden"
        ? "focus"
        : isPhase(candidate.phase)
          ? candidate.phase
          : base.phase,
    endTime: isNonNegativeNumber(candidate.endTime) ? candidate.endTime : base.endTime,
  };
}

function isPhase(value: unknown): value is FocusPhase {
  return typeof value === "string" && VALID_PHASES.includes(value as FocusPhase);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
