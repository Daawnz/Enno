<script lang="ts">
  import type { SessionState } from "../core/types";
  import { onMount } from "svelte";
  import { FOCUS_MS } from "../core/constants";
  import {
    formatCountdown,
    remainingMs,
    ringProgress,
  } from "../core/timer";

  const {
    session,
    size = "sm",
  }: {
    session: SessionState | null;
    size?: "sm" | "lg";
  } = $props();

  const circumference = 283;
  const totalMs = FOCUS_MS;

  const text = $derived(
    session?.phase === "focus"
      ? formatCountdown(Math.min(totalMs, remainingMs(session.endTime, Date.now())))
      : formatCountdown(totalMs),
  );

  const progress = $derived(
    session?.phase === "focus"
      ? ringProgress(session.endTime, totalMs, Date.now())
      : 1,
  );

  // The ring follows the session's real progress, but the first minute gets a
  // visible head start so the wheel is clearly draining as soon as a session
  // starts (a 90-min session would otherwise take ~2 min to show the first
  // grey sliver). After the kick it settles to the exact linear drain and
  // empties exactly when the session ends, so the wheel always matches the
  // countdown and never sits empty while the timer still runs.
  const ringKickS = 60;
  const ringKickExtra = 0.03;

  const offset = $derived.by(() => {
    const x = 1 - progress;
    if (x <= 0)
      return 0;
    if (x >= 1)
      return circumference;
    const kickX = Math.min((ringKickS * 1000) / totalMs, 0.1);
    const kickRate = 1 + ringKickExtra / kickX;
    const drained = x < kickX
      ? x * kickRate
      : kickX * kickRate + (1 - kickX * kickRate) * ((x - kickX) / (1 - kickX));
    return circumference * drained;
  });

  // Snap to the current progress on first paint (a mid-session open must show
  // 50% directly, not animate down from the full ring), then animate the
  // stroke-dashoffset as the timer ticks. The double rAF guarantees the
  // transition is enabled only after the element was painted without it.
  let animated = $state(false);
  onMount(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        animated = true;
      });
    });
  });
</script>

<div
  class="dial relative grid place-items-center"
  class:dial--sm={size === "sm"}
  class:dial--lg={size === "lg"}
  id="dial"
>
  <svg
    class="dial-ring absolute inset-0 size-full -rotate-90"
    viewBox="0 0 100 100"
    aria-hidden="true"
  >
    <circle class="ring-track" cx="50" cy="50" r="44"></circle>
    <circle
      class="ring-fill"
      class:ring-fill--animated={animated}
      id="ring"
      cx="50"
      cy="50"
      r="44"
      style:stroke-dasharray={circumference}
      style:stroke-dashoffset={offset}
    ></circle>
  </svg>
  <div class="timer-wrap relative flex flex-col items-center justify-center gap-1.5">
    <div
      id="timer"
      class="timer relative font-bold leading-none tabular-nums"
      class:timer--sm={size === "sm"}
      class:timer--lg={size === "lg"}
    >{text}</div>
  </div>
</div>

<style>
  .dial--sm {
    width: 208px;
    height: 208px;
  }

  .dial--lg {
    width: 224px;
    height: 224px;
  }

  .dial {
    transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
      height 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .timer--sm {
    font-size: 36px;
  }

  .timer--lg {
    font-size: 42px;
    font-family: var(--font-sans);
  }

  .timer {
    letter-spacing: -0.02em;
    transition: font-size 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }

  :global(body[data-phase="break"]) .ring-fill {
    stroke: var(--lavender);
  }

  .ring-track,
  .ring-fill {
    fill: none;
    stroke-width: 4;
  }

  .ring-track {
    stroke: var(--ring-track);
  }

  .ring-fill {
    stroke: var(--sage);
  }

  .ring-fill--animated {
    transition: stroke-dashoffset 1s linear;
  }

  @media (prefers-reduced-motion: reduce) {
    .ring-fill--animated {
      transition: none;
    }

    .dial,
    .timer {
      transition: none;
    }
  }
</style>
