<script lang="ts">
  import { ShieldAlert, X } from '@lucide/svelte';
  import { design } from '$lib/stores/design.svelte';
  import { selection } from '$lib/stores/selection.svelte';
  import { lintTopology, type LintLevel } from '$lib/topology/lint';

  // Re-run lint whenever the design graph changes. Both `nodes` and `edges`
  // are explicit reads so the runes runtime tracks them as dependencies.
  // toSpec() is cheap (no allocation that scales beyond O(n)) so we don't
  // bother memoizing against a hash.
  const warnings = $derived.by(() => {
    // ensure tracking
    design.nodes;
    design.edges;
    return lintTopology(design.toSpec());
  });

  const levelOrder: Record<LintLevel, number> = { error: 0, warn: 1, info: 2 };
  const sortedWarnings = $derived(
    [...warnings].sort((a, b) => levelOrder[a.level] - levelOrder[b.level])
  );

  const counts = $derived.by(() => {
    const c = { error: 0, warn: 0, info: 0 };
    for (const w of warnings) c[w.level]++;
    return c;
  });

  let open = $state(false);

  function pillColor(level: LintLevel): string {
    if (level === 'error') return 'border-err bg-err/10 text-err';
    if (level === 'warn') return 'border-warn/40 bg-warn/10 text-warn';
    return 'border-line bg-bg text-muted';
  }
</script>

<!-- Toolbar pill — collapsed unless there are warnings or the user opened it -->
{#if warnings.length > 0 || open}
  <button
    type="button"
    onclick={() => (open = !open)}
    aria-expanded={open}
    aria-label="Topology warnings: {counts.error} errors, {counts.warn} warnings, {counts.info} info"
    class="flex items-center gap-1 rounded border px-2 py-1 text-[11px]
           transition-colors hover:border-accent
           focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
           {counts.error > 0
             ? 'border-err/60 bg-err/10 text-err'
             : counts.warn > 0
               ? 'border-warn/40 bg-warn/10 text-warn'
               : 'border-line bg-bg text-muted'}"
  >
    <ShieldAlert class="h-3 w-3" aria-hidden="true" />
    <span class="font-mono">lint</span>
    {#if warnings.length > 0}
      <span class="tabular-nums">{warnings.length}</span>
    {:else}
      <span>ok</span>
    {/if}
  </button>
{/if}

{#if open}
  <div
    role="dialog"
    aria-label="Topology lint warnings"
    class="absolute right-3 top-full z-40 mt-1 max-h-[60vh] w-80 overflow-y-auto rounded border border-line bg-panel shadow-xl"
  >
    <header class="sticky top-0 flex items-center justify-between border-b border-line bg-panel px-2 py-1.5">
      <span class="font-mono text-[10px] uppercase tracking-widest text-muted">
        topology lint
      </span>
      <button
        type="button"
        onclick={() => (open = false)}
        aria-label="Close lint panel"
        class="rounded p-1 text-muted hover:text-ink
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <X class="h-3 w-3" aria-hidden="true" />
      </button>
    </header>

    {#if warnings.length === 0}
      <p class="px-2 py-3 text-xs text-muted">No issues — clean topology.</p>
    {:else}
      <ul class="divide-y divide-line" role="list">
        {#each sortedWarnings as w (w.ruleId + '-' + (w.nodeIds?.[0] ?? '_'))}
          <li class="space-y-1 p-2 text-xs">
            <div class="flex items-start gap-1.5">
              <span
                class="shrink-0 rounded border px-1 py-px font-mono text-[10px] uppercase {pillColor(
                  w.level
                )}"
              >
                {w.level}
              </span>
              <span class="font-mono text-[10px] text-muted">{w.ruleId}</span>
            </div>
            <p class="text-ink">{w.message}</p>
            {#if w.detail}
              <p class="text-muted">{w.detail}</p>
            {/if}
            {#if w.nodeIds?.length}
              <div class="flex flex-wrap gap-1 pt-0.5">
                {#each w.nodeIds as nid (nid)}
                  <button
                    type="button"
                    onclick={() => selection.set(nid)}
                    class="rounded border border-line bg-bg px-1.5 py-px font-mono text-[10px] text-muted
                           hover:border-accent hover:text-accent
                           focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {nid}
                  </button>
                {/each}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}
