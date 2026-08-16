import type { SessionState } from "./core/types";

export type MessageType
  = | "getState"
    | "start"
    | "stop"
    | "override"
    | "getTarget"
    | "ping"
    | "themeChanged";

export type MessageRequest = {
  type: MessageType;
  // Dark-mode flag reported by the offscreen document ("themeChanged").
  dark?: boolean;
};

export type StateResponse = {
  session: SessionState;
};

export type TargetResponse = {
  targetUrl: string | null;
};

export type PingResponse = {
  ok: true;
};

export type ErrorResponse = {
  error: string;
};

export type MessageResponse
  = | StateResponse
    | TargetResponse
    | PingResponse
    | ErrorResponse;
