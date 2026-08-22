<script lang="ts">
  import * as m from "../../../common/i18n/generated/messages.js";
  import { fetchSession, fetchTarget, sendAction } from "../../src/client";
  import HoldButton from "../../src/shared/HoldButton.svelte";
  import SessionDial from "../../src/shared/SessionDial.svelte";
  import { useSession } from "../../src/shared/useSession.svelte";

  const store = useSession({
    getState: fetchSession,
    start: async () => {
      throw new Error("not supported from the blocked page");
    },
    stop: async () => {
      throw new Error("not supported from the blocked page");
    },
  });

  function originOf(url: string) {
    try {
      return new URL(url).hostname;
    }
    catch {
      return "";
    }
  }

  // The URL that was blocked (the last real navigation in this tab), not the
  // page we came from. Used to say which site is blocked and where to go on
  // unlock.
  let target = $state<string | null>(null);

  $effect(() => {
    void fetchTarget().then((url) => {
      target = url;
    });
  });

  const session = $derived(store.session);

  const title = $derived(
    session?.phase === "focus" ? m.blocked_title_focus() : m.blocked_title_complete(),
  );

  const host = $derived(target ? originOf(target) : "");

  const sub = $derived(
    session?.phase === "focus"
      ? host
        ? m.blocked_host_blocked({ host })
        : m.blocked_site_blocked()
      : m.blocked_ended(),
  );

  let override = $state({ label: m.blocked_hold_to_unlock(), done: false, disabled: false });

  // Once the user overrides, we are leaving this page: keep the redirecting
  // state authoritative so the session poll (which stays in "focus") cannot
  // tear the loading overlay back down before the tab navigates to the target.
  let redirecting = $state(false);

  $effect(() => {
    const s = session;
    document.body.dataset.phase = redirecting ? "redirecting" : (s?.phase ?? "loading");
    if (redirecting || s?.phase !== "focus")
      return;
    override = { label: m.blocked_hold_to_unlock(), done: false, disabled: false };
  });

  // This is the ONLY redirect back to the target. It must be driven by the
  // polled session state, never by a local countdown: the controller disables
  // the DNR block ruleset before it persists "idle", so a redirect triggered
  // here can never be bounced back into the block. Redirecting on wall-clock
  // time instead ("endTime passed") races the async FOCUS_END transition and
  // re-enters the still-active block rule, bouncing blocked.html -> target ->
  // blocked.html forever.
  //
  // Fire at most once per document: every poll builds a fresh session object,
  // so without a guard the effect would re-assign location.href (cancelling
  // the in-flight navigation) for each poll that resolves while the page is
  // still alive, issuing duplicate navigations to the target.
  let redirected = false;
  $effect(() => {
    const s = session;
    if (!redirected && s?.phase === "idle" && target) {
      redirected = true;
      window.location.href = target;
    }
  });

  async function onOverride() {
    redirecting = true;
    override = { label: m.blocked_unlocked(), done: true, disabled: true };
    await sendAction("override", target ?? undefined);
  }
</script>

<svelte:head>
  <title>{m.blocked_doc_title()}</title>
</svelte:head>

<!-- Before the first session poll resolves, `session` is null and the page
  would otherwise flash the "session ended" copy with a hidden hold button
  (and dispatching into that state would silently no-op the hold). Render the
  card only once the phase is actually known; the body[data-phase="loading"]
  CSS shows the loading wheel for the poll window. -->
{#if session !== null}
  <main class="blocked-card flex w-full max-w-card flex-1 flex-col items-center justify-center gap-10 py-4 pb-7 text-center">
    <div class="flex flex-col items-center gap-3.5">
      <h1 id="title" class="font-bold tracking-tight leading-1_1">{title}</h1>
      <p class="sub max-w-measure text-17 leading-relaxed text-ink-muted" id="sub">{sub}</p>
    </div>

    <SessionDial {session} size="lg" />

    <div class="relative flex w-full flex-col items-center gap-4">
      <a
        id="back"
        class="back inline-flex border-b border-transparent px-2.5 py-1.5 font-sans text-sm font-medium text-ink-muted transition-colors hover:border-sage hover:text-ink"
        href={target ?? "#"}
        hidden={session?.phase !== "idle"}
      >{m.blocked_back()}</a>
      <HoldButton
        id="override-btn"
        class={override.done ? "done" : undefined}
        hidden={session?.phase !== "focus"}
        holdMs={3000}
        disabled={override.disabled}
        required={() => session?.phase === "focus"}
        onComplete={onOverride}
      >
        <span id="override-label">{override.label}</span>
      </HoldButton>
    </div>
  </main>

  <footer
    class="notice max-w-notice pb-1.5 text-center font-sans text-xs text-ink-muted"
    hidden={session?.phase !== "focus"}
  >{m.blocked_single_pass()}</footer>
{/if}

<div id="loading" class="blocked-loading fixed inset-0 z-10 place-items-center bg-surface">
  <div class="blocked-loading__wheel" aria-hidden="true"></div>
</div>

<style>
  /* The unlock redirect is driven by body[data-phase="redirecting"], which is
     toggled from the component; a plain hidden attribute would tear the swap
     back down if the session poll re-renders before navigation commits. The
     "loading" phase covers the window before the first session poll resolves:
     the card is gated out of the DOM by {#if session !== null}, and this rule
     also hides it during any single-flush frame where the card mounts before
     the phase effect runs. */
  :global(body[data-phase="redirecting"]) .blocked-card,
  :global(body[data-phase="loading"]) .blocked-card {
    display: none;
  }

  .blocked-loading {
    display: none;
  }

  :global(body[data-phase="redirecting"]) .blocked-loading,
  :global(body[data-phase="loading"]) .blocked-loading {
    display: grid;
  }

  .blocked-card {
    animation: blocked-enter 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes blocked-enter {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .blocked-card {
      animation: none;
    }
  }

  #title {
    font-size: clamp(28px, 6vw, 40px);
  }

  .blocked-loading__wheel {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 4px solid var(--ring-track);
    border-top-color: var(--terracotta);
    animation: Enno-spin 0.8s linear infinite;
  }

  @keyframes Enno-spin {
    to {
      transform: rotate(360deg);
    }
  }

</style>
