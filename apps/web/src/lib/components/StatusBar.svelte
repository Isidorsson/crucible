<script lang="ts">
  import { AlertTriangle, DollarSign } from '@lucide/svelte';
  import { sim } from '$lib/stores/sim.svelte';
  import { design } from '$lib/stores/design.svelte';
  import { selection } from '$lib/stores/selection.svelte';
  import type { NodeKind } from '$lib/types/topology';
  import { CATALOG_BY_KIND } from '$lib/types/catalog';
  import Tooltip from './Tooltip.svelte';
  import Hint from './Hint.svelte';
  import LintPanel from './LintPanel.svelte';
  import Shortcuts from './Shortcuts.svelte';

  // Worst-p99 node mirrors the prior ControlBar logic: skip dormant nodes
  // (p99 == 0) so we don't point at an idle component.
  const worstNode = $derived.by(() => {
    if (!sim.snapshot) return null;
    let worst: { id: string; p99: number } | null = null;
    for (const n of sim.snapshot.nodes) {
      if (n.p99 <= 0) continue;
      if (!worst || n.p99 > worst.p99) worst = { id: n.id, p99: n.p99 };
    }
    return worst;
  });
  const worstNodeLabel = $derived.by(() => {
    if (!worstNode) return null;
    const n = design.nodes.find((x) => x.id === worstNode.id);
    if (!n || n.type !== 'crucible') return worstNode.id;
    return (n.data as { label: string }).label;
  });
  function fmtMs(ns: number): string {
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(0)}µs`;
    if (ns < 1_000_000_000) return `${(ns / 1_000_000).toFixed(0)}ms`;
    return `${(ns / 1_000_000_000).toFixed(2)}s`;
  }

  const numberFmt = new Intl.NumberFormat();

  const totalCost = $derived(
    design.nodes.reduce((sum, n) => {
      if (n.type !== 'crucible') return sum;
      const data = n.data as { kind: NodeKind };
      return sum + (CATALOG_BY_KIND[data.kind].costPerMonth ?? 0);
    }, 0)
  );
  const totalCostFmt = $derived(
    totalCost >= 1000 ? `${(totalCost / 1000).toFixed(1)}k` : `${totalCost}`
  );
</script>

<div
  class="flex flex-nowrap items-center gap-3 border-t border-line bg-panel px-4 py-1.5 font-mono text-[11px] text-ink"
  role="status"
  aria-label="Simulation telemetry"
>
  <LintPanel />
  <Shortcuts />

  <div class="ml-auto flex items-center gap-3" aria-live="polite" aria-atomic="false">
    {#if sim.state === 'loading'}
      <span class="text-muted">loading sim…</span>
    {/if}
    {#if sim.error}
      <span
        role="alert"
        aria-live="assertive"
        class="rounded border border-err bg-err/10 px-2 py-0.5 font-semibold text-err"
        title={sim.error}
      >
        sim error: {sim.error}
      </span>
    {/if}
    {#if worstNode && worstNodeLabel}
      <Tooltip
        content="Highest p99 of any node in the current snapshot. Click to select and inspect it."
        side="top"
      >
        {#snippet children(id)}
          <button
            type="button"
            onclick={() => selection.set(worstNode!.id)}
            aria-label="Worst p99 node {worstNodeLabel} at {fmtMs(worstNode.p99)}"
            aria-describedby={id}
            class="flex items-center gap-1 rounded border border-warn/40 bg-warn/10 px-2 py-0.5
                   text-warn transition-colors hover:border-warn
                   focus-visible:border-warn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warn"
          >
            <AlertTriangle class="h-3 w-3" aria-hidden="true" />
            worst p99: <span class="text-ink">{worstNodeLabel}</span>
            <span class="tabular-nums">{fmtMs(worstNode.p99)}</span>
          </button>
        {/snippet}
      </Tooltip>
    {/if}
    {#if design.nodes.length > 0}
      <Tooltip
        content="Sum of every node's catalog costPerMonth at default scale. Anchor only — real cost moves 10× with usage."
        side="top"
      >
        {#snippet children(id)}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <span
            tabindex="0"
            aria-describedby={id}
            aria-label="Estimated monthly cost {totalCostFmt} dollars across {design.nodes.length} nodes"
            class="flex cursor-help items-center gap-1 rounded border border-line bg-bg px-2 py-0.5
                   text-muted
                   focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <DollarSign class="h-3 w-3" aria-hidden="true" />
            <span class="tabular-nums text-ink">{totalCostFmt}</span>/mo
          </span>
        {/snippet}
      </Tooltip>
    {/if}
    {#if sim.snapshot}
      <div class="flex gap-3 text-muted">
        <span>
          <Hint term="born" side="top" />
          <span class="tabular-nums text-ink">{numberFmt.format(sim.snapshot.born)}</span>
        </span>
        <span>
          <Hint term="done" side="top" />
          <span class="tabular-nums text-ok">{numberFmt.format(sim.snapshot.completed)}</span>
        </span>
        <span>
          <Hint term="fail" side="top" />
          <span class="tabular-nums text-err">{numberFmt.format(sim.snapshot.failed)}</span>
        </span>
      </div>
    {/if}
  </div>
</div>
