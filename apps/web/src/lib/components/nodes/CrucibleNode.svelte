<script lang="ts">
  import { Handle, Position, type NodeProps, type Node } from '@xyflow/svelte';
  import { CATALOG_BY_KIND } from '$lib/types/catalog';
  import type { CrucibleNodeData } from '$lib/stores/design.svelte';
  import { sim } from '$lib/stores/sim.svelte';
  import { AlertTriangle } from '@lucide/svelte';

  let { id, data, selected }: NodeProps<Node<CrucibleNodeData>> = $props();
  const entry = $derived(CATALOG_BY_KIND[data.kind]);
  const metrics = $derived(sim.metricsByNode[id]);

  function fmtLatency(ns: number): string {
    if (!ns) return '—';
    if (ns < 1_000) return `${ns}ns`;
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)}µs`;
    if (ns < 1_000_000_000) return `${(ns / 1_000_000).toFixed(1)}ms`;
    return `${(ns / 1_000_000_000).toFixed(2)}s`;
  }

  function fmtRate(rps: number): string {
    if (!rps) return '0';
    if (rps < 1_000) return rps.toFixed(0);
    if (rps < 1_000_000) return `${(rps / 1_000).toFixed(1)}k`;
    return `${(rps / 1_000_000).toFixed(1)}M`;
  }

  const ariaSummary = $derived.by(() => {
    if (!metrics) return `${entry.label}, idle`;
    return (
      `${entry.label}, ${fmtRate(metrics.throughput)} requests per second, ` +
      `p99 latency ${fmtLatency(metrics.p99)}, ${metrics.inFlight} in flight` +
      (metrics.faulted ? ', faulted' : '')
    );
  });
</script>

<div
  role="group"
  aria-label={ariaSummary}
  class="rounded-lg border bg-panel px-3 py-2 font-mono text-xs shadow-lg ring-1
         transition-colors
         {selected ? 'ring-accent' : 'ring-line'}
         {metrics?.faulted ? 'border-err' : 'border-line'}"
  style="min-width: 180px;"
>
  <Handle
    type="target"
    position={Position.Left}
    class="crucible-handle crucible-handle--target"
    aria-label="Input port"
  />

  <div class="mb-1.5 flex items-center gap-2 border-b border-line pb-1.5">
    <entry.icon class="h-4 w-4 text-accent" aria-hidden="true" />
    <span class="font-semibold tracking-wide text-ink">{entry.label}</span>
    {#if metrics?.faulted}
      <AlertTriangle class="ml-auto h-3.5 w-3.5 text-err" aria-hidden="true" />
    {/if}
  </div>

  <div class="space-y-0.5 text-muted">
    {#if metrics}
      <div class="flex justify-between">
        <span>rps</span>
        <span class="text-ink tabular-nums">{fmtRate(metrics.throughput)}</span>
      </div>
      <div class="flex justify-between">
        <span>p50 / p99</span>
        <span class="text-ink tabular-nums">
          {fmtLatency(metrics.p50)} / {fmtLatency(metrics.p99)}
        </span>
      </div>
      <div class="flex justify-between">
        <span>in-flight</span>
        <span class="text-ink tabular-nums">{metrics.inFlight}</span>
      </div>
      {#if metrics.queueDepth > 0}
        <div class="flex justify-between">
          <span>queue</span>
          <span class="text-warn tabular-nums">{metrics.queueDepth}</span>
        </div>
      {/if}
      {#if metrics.errorRate > 0}
        <div class="flex justify-between">
          <span>err rate</span>
          <span class="text-err tabular-nums">{(metrics.errorRate * 100).toFixed(1)}%</span>
        </div>
      {/if}
    {:else}
      <div class="italic">idle</div>
    {/if}
  </div>

  <Handle
    type="source"
    position={Position.Right}
    class="crucible-handle crucible-handle--source"
    aria-label="Output port"
  />
</div>

<style>
  :global(.svelte-flow .crucible-handle) {
    width: 14px;
    height: 14px;
    border-radius: 9999px;
    background: var(--crucible-accent, #58a6ff);
    border: 2px solid var(--crucible-panel, #0d1117);
    transition: transform 120ms ease, background-color 120ms ease, box-shadow 120ms ease;
  }
  :global(.svelte-flow .crucible-handle:hover),
  :global(.svelte-flow .crucible-handle.connectingfrom),
  :global(.svelte-flow .crucible-handle.connectionindicator) {
    transform: scale(1.35);
    box-shadow: 0 0 0 4px rgba(88, 166, 255, 0.18);
  }
  :global(.svelte-flow .crucible-handle--source) {
    right: -8px;
  }
  :global(.svelte-flow .crucible-handle--target) {
    left: -8px;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.svelte-flow .crucible-handle) {
      transition: none;
    }
    :global(.svelte-flow .crucible-handle:hover) {
      transform: none;
    }
  }
</style>
