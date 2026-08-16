<script lang="ts">
  import { Clock, Funnel, Hand, Lock, Puzzle, Star, Target } from "@lucide/svelte";
  import * as m from "../../../common/i18n/generated/messages.js";
  import { getLocale } from "../../../common/i18n/generated/runtime.js";
  import iconUrl from "../../../extension/icons/icon128.png";
  import { domainsForLocale } from "../../../extension/src/core/blocklist";

  const STORE_URL = import.meta.env.VITE_STORE_URL;
  const FIREFOX_URL = import.meta.env.VITE_FIREFOX_URL;
  const GITHUB_URL = import.meta.env.VITE_GITHUB_URL ?? "https://github.com/Daawnz/Enno";
  const TAGS = ["Reddit", "YouTube", "X", "Instagram"] as const;

  // The store link is conditional: Firefox visitors get the AMO listing,
  // Chromium visitors get the Chrome Web Store listing, and everyone else
  // sees a plain availability note instead of a dead button.
  const isFirefox = /Firefox\//i.test(navigator.userAgent);
  const isChrome = !isFirefox && /Chrome\//i.test(navigator.userAgent);
  const blockedCount = domainsForLocale(getLocale()).length;

  // Live star count, fetched from shields.io: it always answers 200 (even
  // for a not-yet-public repo), so the request never trips Chromium's
  // "failed to load resource" console error and the strict Lighthouse
  // best-practices gate stays green. Non-count values (e.g. "repo not
  // found") simply keep the stars hidden.
  let stars = $state<string | null>(null);

  $effect(() => {
    const repo = new URL(GITHUB_URL).pathname.slice(1).replace(/\.git$/, "");
    const controller = new AbortController();
    fetch(`https://img.shields.io/github/stars/${repo}.json`, {
      signal: controller.signal,
    })
      .then(response => (response.ok ? response.json() : null))
      .then((data) => {
        if (typeof data?.value === "string" && /^[\d,.]+k?$/i.test(data.value)) {
          stars = data.value;
        }
      })
      .catch(() => {});
    return () => controller.abort();
  });

  $effect(() => {
    document.documentElement.lang = getLocale();
  });
</script>

<svelte:head>
  <title>{m.meta_landing_title()}</title>
  <meta name="description" content={m.meta_landing_description()} />
  <meta property="og:title" content={m.landing_headline()} />
  <meta property="og:description" content={m.meta_landing_description()} />
  <meta name="twitter:title" content={m.landing_headline()} />
  <meta name="twitter:description" content={m.meta_landing_description()} />
  <script type="application/ld+json">
    {JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Enno",
    operatingSystem: "Chrome",
    description: m.meta_landing_description(),
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    })}
  </script>
</svelte:head>

<div class="w-full">
  <div
    class="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-between p-6 font-serif text-ink sm:p-12 selection:bg-sage/20"
  >
    <header class="mx-auto z-10 mb-7 flex w-full max-w-6xl items-center justify-between sm:mb-10 enter-fall">
      <div class="flex items-center gap-1.5">
        <img src={iconUrl} alt={m.landing_icon_alt()} class="h-9 w-9" />
        <span class="text-lg font-semibold tracking-tight">Enno</span>
      </div>

      <nav class="flex items-center gap-2 font-sans text-xs font-medium">
        <a
          href="./blocklist.html"
          class="rounded-full px-3 py-1.5 text-ink-subtle transition-colors hover:bg-surface-tint hover:text-ink"
        >
          {m.landing_blocked_sites()}
        </a>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener"
          aria-label={m.landing_github_label()}
          class="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-card px-3 py-1.5 text-ink-subtle transition-colors hover:border-ink/20 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 fill-current" aria-hidden="true">
            <path
              d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
            />
          </svg>
          {#if stars}
            <span class="flex items-center gap-1 tabular-nums">
              {stars}
              <Star class="h-3 w-3" />
            </span>
          {/if}
        </a>
      </nav>
    </header>

    <main class="z-10 mx-auto my-6 flex w-full flex-1 flex-col items-center justify-center text-center">
      <div class="mb-6 inline-flex items-center gap-2 enter-fall">
        <Target class="h-3.5 w-3.5 text-ink-subtle" />
        <span class="font-sans text-11 font-semibold uppercase tracking-0_2em text-ink-subtle">
          {m.landing_badge()}
        </span>
      </div>

      <h1
        class="mx-auto mb-5 max-w-5xl text-4xl font-bold tracking-tight leading-1_1 text-ink-strong sm:text-6xl md:text-7xl enter-rise enter-delay-1"
      >
        {m.landing_headline()}
      </h1>

      <p
        class="mx-auto mb-8 max-w-3xl text-base leading-relaxed text-ink-body font-serif sm:text-lg md:text-xl enter-rise enter-delay-2"
      >
        {m.landing_subtitle()}
      </p>

      <div class="mb-8 flex flex-col items-center gap-4 font-sans enter-rise enter-delay-3">
        {#if isFirefox}
          <a
            id="add-to-firefox-cta"
            href={FIREFOX_URL}
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-2.5 rounded-full bg-cta px-7 py-3.5 font-serif text-sm font-medium text-cta-fg shadow-sm transition-transform sm:text-base hover:bg-cta-hover active:scale-95"
          >
            <Puzzle class="h-4 w-4" />
            <span>{m.landing_add_firefox()}</span>
          </a>
        {:else if isChrome}
          <a
            id="add-to-chrome-cta"
            href={STORE_URL}
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-2.5 rounded-full bg-cta px-7 py-3.5 font-serif text-sm font-medium text-cta-fg shadow-sm transition-transform sm:text-base hover:bg-cta-hover active:scale-95"
          >
            <Puzzle class="h-4 w-4" />
            <span>{m.landing_add_chrome()}</span>
          </a>
        {:else}
          <p class="text-xs font-semibold uppercase tracking-widest text-ink-subtle">
            {m.landing_only_available()}
          </p>
        {/if}

        <span class="text-xs font-semibold uppercase tracking-widest text-ink-subtle">
          {m.landing_free_open_source()}
        </span>
      </div>

      <div class="grid w-full grid-cols-1 gap-2 text-left font-serif sm:grid-cols-4">
        <div
          class="rounded-2xl border border-ink/10 bg-card px-5 py-4 shadow-2xs transition-all hover:border-ink/20 enter-rise enter-delay-4"
        >
          <div class="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-sage/15 text-sage">
            <Clock class="h-4 w-4" />
          </div>
          <h2 class="mb-1.5 text-sm font-bold text-ink">
            {m.landing_card_1_title()}
          </h2>
          <p class="text-sm leading-relaxed text-ink-body-soft">
            {m.landing_card_1_body()}
          </p>
        </div>

        <div
          class="rounded-2xl border border-ink/10 bg-card px-5 py-4 shadow-2xs transition-all hover:border-ink/20 enter-rise enter-delay-5"
        >
          <div class="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-lavender/20 text-lavender">
            <Hand class="h-4 w-4" />
          </div>
          <h2 class="mb-1.5 text-sm font-bold text-ink">
            {m.landing_card_2_title()}
          </h2>
          <p class="text-sm leading-relaxed text-ink-body-soft">
            {m.landing_card_2_body()}
          </p>
        </div>

        <div
          class="rounded-2xl border border-ink/10 bg-card px-5 py-4 shadow-2xs transition-all hover:border-ink/20 enter-rise enter-delay-6"
        >
          <div class="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-terracotta/20 text-terracotta">
            <Lock class="h-4 w-4" />
          </div>
          <h2 class="mb-1.5 text-sm font-bold text-ink">
            {m.landing_card_3_title()}
          </h2>
          <p class="text-sm leading-relaxed text-ink-body-soft">
            {m.landing_card_3_body()}
          </p>
        </div>

        <div
          class="rounded-2xl border border-ink/10 bg-card px-5 py-4 shadow-2xs transition-all hover:border-ink/20 enter-rise enter-delay-7"
        >
          <div class="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-terracotta/20">
            <Funnel class="h-4 w-4 text-ink" />
          </div>
          <h2 class="mb-1.5 text-sm font-bold text-ink">
            {m.landing_card_4_title()}
          </h2>
          <div class="mb-3 flex flex-wrap gap-1.5 font-sans">
            {#each TAGS as tag (tag)}
              <span class="rounded-full border border-ink/15 bg-surface-tint px-3 py-1 text-sm text-ink">
                {tag}
              </span>
            {/each}
          </div>

          <a
            href="./blocklist.html"
            class="flex items-center gap-1 font-sans text-xs font-medium text-ink-link transition-colors hover:text-ink"
          >
            <span>{m.landing_view_all_sites({ count: blockedCount })}</span>
          </a>
        </div>

      </div>
    </main>

    <footer
      class="z-10 mx-auto flex w-full max-w-6xl items-center justify-center pt-12 font-sans text-xs text-ink-cool enter-rise enter-delay-7"
    >
      <span>{m.landing_copyright()}</span>
    </footer>
  </div>
</div>
