export type FocusPhase = "idle" | "focus";

export type SessionState = {
  phase: FocusPhase;
  endTime: number;
};

export type AlarmName = "focus-end";

export type Effects = {
  rulesetEnabled: boolean;
  clearAlarms: AlarmName[];
  scheduleAlarm: { name: AlarmName; when: number } | null;
};

export type SessionEvent
  = | { type: "START" }
    | { type: "STOP" }
    | { type: "OVERRIDE" }
    | { type: "FOCUS_END" }
    | { type: "RECONCILE" };

export type Transition = {
  session: SessionState;
  effects: Effects;
};
