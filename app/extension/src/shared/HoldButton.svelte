<script lang="ts">
  import type { Snippet } from "svelte";
  import { Pointer } from "@lucide/svelte";
  import * as m from "../../../common/i18n/generated/messages.js";

  const {
    holdMs = 3000,
    underlabel,
    required = () => true,
    disabled = false,
    onProgress = (_f: number) => {},
    onComplete = async () => {},
    class: className,
    hidden,
    children,
    ...rest
  }: {
    holdMs?: number;
    underlabel?: string;
    required?: () => boolean;
    disabled?: boolean;
    onProgress?: (f: number) => void;
    onComplete?: () => void | Promise<void>;
    class?: string;
    hidden?: boolean;
    children: Snippet;
    [key: string]: unknown;
  } = $props();

  const helperLabel = $derived(
    underlabel ?? m.hold_helper({ seconds: holdMs / 1000 }),
  );

  let holding = $state(false);
  let progress = $state(0);
  let completeTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  let rafId = $state<number | null>(null);
  let completed = $state(false);
  let holdStarted = 0;
  let rootEl = $state<HTMLButtonElement | null>(null);

  $effect(() => {
    const el = rootEl;
    if (!el)
      return;
    const onTouch = (e: TouchEvent) => startHold(e);
    el.addEventListener("touchstart", onTouch, { passive: false });
    return () => el.removeEventListener("touchstart", onTouch);
  });

  function finish() {
    if (completed)
      return;
    completed = true;
    holding = false;
    if (completeTimer) {
      clearTimeout(completeTimer);
      completeTimer = null;
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    progress = 1;
    onProgress(1);
    void Promise.resolve(onComplete()).then(() => {
      progress = 0;
      onProgress(0);
    });
  }

  function cancelHold() {
    if (!holding)
      return;
    holding = false;
    completed = false;
    if (completeTimer) {
      clearTimeout(completeTimer);
      completeTimer = null;
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    progress = 0;
    onProgress(0);
  }

  function onMouseDown(e: MouseEvent) {
    if (e.button !== 0)
      return;
    startHold(e);
  }

  function startHold(e: MouseEvent | TouchEvent) {
    if (disabled)
      return;
    if (!required())
      return;
    e.preventDefault();
    holding = true;
    completed = false;
    holdStarted = Date.now();
    progress = 0;
    onProgress(0);

    // setTimeout guarantees completion fires even when rAF is throttled
    // (Playwright fake clock, backgrounded tabs in production).
    completeTimer = setTimeout(finish, holdMs);

    function tick() {
      if (completed || !holding)
        return;
      const elapsed = Date.now() - holdStarted;
      progress = Math.min(1, elapsed / holdMs);
      onProgress(progress);
      if (progress >= 1) {
        finish();
        return;
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }
</script>

<div class="hold-action relative w-full pb-7" hidden={hidden}>
  <button
    bind:this={rootEl}
    {...rest}
    class={[
      "hold-action__btn relative inline-flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full bg-terracotta px-7.5 py-3 text-sm font-semibold text-cta-fg",
      className,
    ].filter(Boolean).join(" ")}
    class:holding={holding}
    disabled={disabled}
    style:--hold-progress={progress}
    onmousedown={onMouseDown}
    onmouseup={cancelHold}
    onmouseleave={cancelHold}
    ontouchend={cancelHold}
    ontouchcancel={cancelHold}
    ontouchmove={cancelHold}
  >
    <span class="pointer-events-none relative z-10 inline-flex items-center justify-center gap-2">
      <Pointer class="hold-action__icon" size={16} />
      {@render children()}
    </span>
  </button>

  {#if holding}
    <p class="hold-helper absolute inset-x-0 bottom-0 text-center text-xs text-ink-muted">
      {helperLabel}
    </p>
  {/if}
</div>

<style>
  .hold-action__btn {
    font-family: var(--font-sans);
    transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* While holding, the progress fill (--terracotta-hi) must stay visible, so
     the hover background must not be active during a hold. */
  .hold-action__btn:hover:not(.holding):not(:disabled) {
    background: var(--terracotta-hi);
  }

  .hold-action__btn::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--terracotta-hi);
    transform-origin: left center;
    transform: scaleX(var(--hold-progress, 0));
    transition: transform 0.15s ease-out;
    z-index: 0;
  }

  .hold-action__btn.holding::before {
    transition: none;
  }

  .hold-action__btn:disabled {
    background: var(--ring-track);
    color: var(--muted);
    cursor: default;
  }

  .hold-action__btn.done {
    background: var(--sage);
    color: var(--cta-fg);
    cursor: default;
  }

  .hold-action__btn.holding,
  .hold-action__btn:disabled {
    --hold-play: paused;
  }

  .hold-action__icon {
    width: 16px;
    height: 16px;
    flex: 0 0 auto;
    will-change: transform;
    animation: hold-tap 1.7s ease-in-out infinite;
    animation-play-state: var(--hold-play, running);
  }

  @keyframes hold-tap {
    0%,
    100% {
      transform: translateY(0);
    }
    55% {
      transform: translateY(2px);
    }
  }

  .hold-helper {
    will-change: transform, opacity;
    animation: hold-helper-in 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes hold-helper-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
