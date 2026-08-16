<script lang="ts">
  import { Shield } from "@lucide/svelte";
  import * as m from "../../../common/i18n/generated/messages.js";
  import { getLocale } from "../../../common/i18n/generated/runtime.js";
  import { fetchSession, sendAction } from "../../src/client";
  import { domainsForLocale } from "../../src/core/blocklist";
  import HoldButton from "../../src/shared/HoldButton.svelte";
  import SessionDial from "../../src/shared/SessionDial.svelte";
  import { useSession } from "../../src/shared/useSession.svelte";

  const stopHoldMs = 5000;

  const store = useSession({
    getState: fetchSession,
    start: () => sendAction("start"),
    stop: () => sendAction("stop"),
  });

  const isActive = $derived(store.session?.phase === "focus");
  const blockedCount = domainsForLocale(getLocale()).length;

  let stopLabel = $state(m.popup_hold_to_end());

  function setStopLabel(fraction: number) {
    if (fraction >= 1) {
      stopLabel = m.popup_ending();
    }
    else if (fraction > 0) {
      const sec = Math.max(1, Math.ceil((1 - fraction) * (stopHoldMs / 1000)));
      stopLabel = m.popup_ending_in({ seconds: sec });
    }
    else {
      stopLabel = m.popup_hold_to_end();
    }
  }

  $effect(() => {
    if (store.session)
      document.body.dataset.phase = store.session.phase;
  });
</script>

<header
  class="topbar relative flex w-full items-center justify-center border-b border-ink/5 px-6 py-5"
>
  {#if isActive}
    <span
      class="topbar__pulse absolute left-5 top-1/2 size-2 -translate-y-1/2 rounded-full bg-sage"
      aria-hidden="true"
    ></span>
  {/if}
  <span class="wordmark text-xs font-semibold uppercase tracking-0_2em text-ink">Enno</span>
</header>

<SessionDial session={store.session} />

<div class="action w-full px-5.5 pt-4.5">
  {#if !isActive}
    <button
      id="enter-focus-button"
      class="inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-sage px-7.5 py-3 font-serif text-sm font-medium text-cta-fg transition-transform hover:bg-sage-hi active:scale-95"
      hidden={store.busy}
      onclick={() => store.start()}
    >
      {m.popup_enter_focus()}
    </button>
  {:else}
    <HoldButton
      id="end-focus-button"
      aria-label={m.popup_hold_aria({ seconds: stopHoldMs / 1000 })}
      holdMs={stopHoldMs}
      required={() => store.session?.phase === "focus"}
      onProgress={setStopLabel}
      onComplete={() => store.stop()}
    >
      <span id="stop-label">{stopLabel}</span>
    </HoldButton>
  {/if}
</div>

<footer
  class="footer mt-auto flex w-full items-center justify-between border-t border-ink/5 bg-surface-tint px-5 py-3.5 text-xs text-ink-muted"
>
  <span class="shielded inline-flex items-center gap-1.5 text-ink-muted">
    <Shield class="text-sage" size={14} />
    {m.popup_sites_shielded({ count: blockedCount })}
  </span>
</footer>

<style>
  .topbar__pulse {
    animation: Enno-pulse 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  @keyframes Enno-pulse {
    0% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--sage) 50%, transparent);
    }
    70% {
      box-shadow: 0 0 0 8px transparent;
    }
    100% {
      box-shadow: 0 0 0 0 transparent;
    }
  }

</style>
