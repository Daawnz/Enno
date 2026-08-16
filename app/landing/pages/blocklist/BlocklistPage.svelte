<script lang="ts">
  import type { BlocklistCategoryId } from "../../../extension/src/core/blocklist";
  import { ArrowLeft, ShieldAlert } from "@lucide/svelte";
  import * as m from "../../../common/i18n/generated/messages.js";
  import { getLocale } from "../../../common/i18n/generated/runtime.js";
  import { categoriesForLocale } from "../../../extension/src/core/blocklist";

  const locale = getLocale();
  const categories = categoriesForLocale(locale);
  const domains = categories.flatMap(category => category.domains);

  const CATEGORY_LABELS: Record<BlocklistCategoryId, () => string> = {
    social: m.blocklist_category_social,
    video: m.blocklist_category_video,
    entertainment: m.blocklist_category_entertainment,
    news: m.blocklist_category_news,
    sports: m.blocklist_category_sports,
    communities: m.blocklist_category_communities,
    games: m.blocklist_category_games,
    reading: m.blocklist_category_reading,
  };

  $effect(() => {
    document.documentElement.lang = getLocale();
  });
</script>

<svelte:head>
  <title>{m.meta_blocklist_title()}</title>
  <meta name="description" content={m.meta_blocklist_description({ count: domains.length })} />
</svelte:head>

<main
  class="min-h-screen bg-surface p-6 font-serif text-ink sm:p-12 selection:bg-sage/20"
>
  <div class="mx-auto max-w-6xl">
    <a
      href="./"
      class="mb-12 inline-flex cursor-pointer items-center gap-2 font-sans text-xs uppercase tracking-widest text-ink-subtle transition-colors hover:text-ink enter-fall"
    >
      <ArrowLeft class="h-3.5 w-3.5" />
      <span>{m.blocklist_back()}</span>
    </a>

    <div class="mx-auto mb-12 max-w-3xl text-center enter-fall">
      <h1 class="mb-4 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
        {m.blocklist_title()}
      </h1>
      <p class="text-base leading-relaxed text-ink-subtle sm:text-lg">
        {m.blocklist_subtitle({ count: domains.length })}
      </p>
    </div>

    {#each categories as category (category.id)}
      <section class="mb-12">
        <h2
          class="mb-4 font-sans text-xs font-semibold uppercase tracking-0_2em text-ink-subtle"
        >
          {CATEGORY_LABELS[category.id]()}
        </h2>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {#each category.domains as domain (domain)}
            <div
              class="group flex items-center gap-3 rounded-xl border border-ink/10 bg-card px-4 py-2 transition-all hover:border-ink/20 hover:shadow-sm enter-rise"
            >
              <span
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-sage/10 font-sans text-11 font-bold text-ink-subtle uppercase"
                aria-hidden="true"
              >
                {domain[0]}
              </span>
              <span
                class="font-serif text-15 font-medium tracking-tight text-ink sm:text-base"
              >
                {domain}
              </span>
            </div>
          {/each}
        </div>
      </section>
    {/each}

    <div
      class="flex flex-col items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-sheet p-6 font-sans text-xs text-ink-subtle sm:flex-row enter-rise enter-delay-4"
    >
      <div class="flex items-center gap-3 text-center sm:text-left">
        <ShieldAlert class="mt-0.5 h-6 w-6 shrink-0 self-center text-sage" />
        <div>
          <strong class="block font-serif text-sm font-bold text-ink">
            {m.blocklist_banner_title()}
          </strong>
          <span>
            {m.blocklist_banner_body({ count: domains.length })}
          </span>
        </div>
      </div>
    </div>
  </div>
</main>
