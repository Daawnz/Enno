import type { SessionState } from "../core/types";
import { onMount } from "svelte";

export type SessionActions = {
  getState: () => Promise<SessionState>;
  start: () => Promise<SessionState>;
  stop: () => Promise<SessionState>;
};

class SessionStore {
  session = $state<null | SessionState>(null);
  busy = $state(false);

  constructor(private actions: SessionActions) {}

  async refresh() {
    try {
      this.session = await this.actions.getState();
    }
    catch {
      // extension unreachable; keep the last rendered view
    }
  }

  async start() {
    await this.run(this.actions.start);
  }

  async stop() {
    await this.run(this.actions.stop);
  }

  private async run(fn: () => Promise<SessionState>) {
    this.busy = true;
    try {
      await fn();
      await this.refresh();
    }
    finally {
      this.busy = false;
    }
  }
}

export function useSession(actions: SessionActions): SessionStore {
  const store = new SessionStore(actions);
  onMount(() => {
    const id = setInterval(() => void store.refresh(), 250);
    void store.refresh();
    return () => clearInterval(id);
  });
  return store;
}
