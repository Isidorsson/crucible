<script lang="ts">
  import { Trophy, X, Play, StopCircle } from '@lucide/svelte';
  import { SCENARIOS } from '$lib/types/scenarios';
  import { scenario } from '$lib/stores/scenario.svelte';

  let open = $state(false);
  let dialogEl = $state<HTMLDivElement | null>(null);

  function pick(id: string) {
    scenario.start(id);
    open = false;
  }

  $effect(() => {
    if (open) queueMicrotask(() => dialogEl?.focus());
  });

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      open = false;
    }
  }
</script>

<button
  type="button"
  onclick={() => (open = true)}
  aria-label="Pick a scenario / drill"
  class="flex items-center gap-1.5 rounded border border-line bg-bg px-2.5 py-1.5
         transition-colors hover:border-accent
         focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
>
  <Trophy class="h-3.5 w-3.5" aria-hidden="true" /> drills
</button>

{#if scenario.activeId}
  <button
    type="button"
    onclick={() => scenario.cancel()}
    aria-label="Cancel running scenario"
    class="flex items-center gap-1 rounded border border-err/40 bg-err/10 px-2 py-1 text-[11px] text-err
           transition-colors hover:border-err
           focus-visible:border-err focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-err"
  >
    <StopCircle class="h-3 w-3" aria-hidden="true" /> cancel drill
  </button>
{/if}

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    role="presentation"
    class="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4"
    onclick={() => (open = false)}
  >
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      bind:this={dialogEl}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drills-title"
      tabindex="-1"
      onkeydown={onKeydown}
      onclick={(e) => e.stopPropagation()}
      class="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded border border-line bg-panel shadow-2xl
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <header class="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 id="drills-title" class="font-mono text-xs uppercase tracking-widest text-muted">
          Drills — pick a scenario
        </h2>
        <button
          type="button"
          onclick={() => (open = false)}
          aria-label="Close"
          class="rounded p-1 text-muted hover:text-ink
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <p class="border-b border-line px-3 py-2 text-[11px] text-muted">
        Running a drill replaces the current canvas, starts the sim, and schedules each scripted
        event. Wall-clock duration is shown — pausing the sim doesn't pause the schedule.
      </p>

      <ul class="grid grid-cols-1 gap-2 p-3 md:grid-cols-2" role="list">
        {#each SCENARIOS as s (s.id)}
          <li>
            <article
              class="flex h-full flex-col rounded border border-line bg-bg p-2.5 text-xs"
            >
              <header class="flex items-center gap-2">
                <s.icon class="h-4 w-4 text-accent" aria-hidden="true" />
                <h3 class="font-mono text-ink">{s.label}</h3>
                <span class="ml-auto text-[10px] text-muted">{s.durationSec}s</span>
              </header>
              <p class="mt-1 text-muted">{s.blurb}</p>
              <p class="mt-2 text-[11px]">
                <span class="text-muted">Goal:</span>
                <span class="text-ink">{s.goal}</span>
              </p>
              <p class="mt-1 text-[11px]">
                <span class="text-muted">Pass:</span>
                <span class="text-ink">{s.passCondition}</span>
              </p>
              <button
                type="button"
                onclick={() => pick(s.id)}
                class="mt-auto flex items-center justify-center gap-1.5 rounded border border-accent bg-accent/10
                       px-2 py-1.5 text-accent transition-colors hover:bg-accent/20
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Play class="h-3 w-3" aria-hidden="true" /> run drill
              </button>
            </article>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<!-- Note banner — sits at the top of the canvas via portal-style fixed
     positioning. Auto-clears when scenario fires the next note or finishes. -->
{#if scenario.currentNote}
  <div
    aria-live="polite"
    class="pointer-events-none fixed left-1/2 top-16 z-40 -translate-x-1/2 rounded border border-accent/40
           bg-panel/95 px-3 py-1.5 text-xs text-ink shadow-lg"
  >
    <span class="font-mono text-[10px] uppercase tracking-widest text-accent">drill</span>
    <span class="ml-2">{scenario.currentNote}</span>
  </div>
{/if}
