import type { SessionState } from "./core/types";

export type MessageType
  = | "getState"
    | "start"
    | "stop"
    | "override"
    | "getTarget"
    | "ping";

export type MessageRequest = {
  type: MessageType;
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
