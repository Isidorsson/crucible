<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';
  import { CATALOG_BY_KIND } from '$lib/types/catalog';
  import type { CrucibleNodeData } from '$lib/stores/design.svelte';
  import { sim } from '$lib/stores/sim.svelte';
  import { AlertTriangle } from '@lucide/svelte';

  let { id, data, selected }: NodeProps<CrucibleNodeData> = $props();
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
</script>

<div
  class="rounded-lg border bg-panel px-3 py-2 font-mono text-xs shadow-lg ring-1 transition
         {selected ? 'ring-accent' : 'ring-line'}
         {metrics?.faulted ? 'border-err' : 'border-line'}"
  style="min-width: 180px;"
>
  <Handle type="target" position={Position.Left} class="!bg-accent" />

  <div class="flex items-center gap-2 border-b border-line pb-1.5 mb-1.5">
    <entry.icon class="h-4 w-4 text-accent" />
    <span class="text-ink font-semibold tracking-wide">{entry.label}</span>
    {#if metrics?.faulted}
      <AlertTriangle class="ml-auto h-3.5 w-3.5 text-err" />
    {/if}
  </div>

  <div class="space-y-0.5 text-muted">
    {#if metrics}
      <div class="flex justify-between">
        <span>rps</span>
        <span class="text-ink">{fmtRate(metrics.throughput)}</span>
      </div>
      <div class="flex justify-between">
        <span>p50 / p99</span>
        <span class="text-ink">{fmtLatency(metrics.p50)} / {fmtLatency(metrics.p99)}</span>
      </div>
      <div class="flex justify-between">
        <span>in-flight</span>
        <span class="text-ink">{metrics.inFlight}</span>
      </div>
      {#if metrics.queueDepth > 0}
        <div class="flex justify-between">
          <span>queue</span>
          <span class="text-warn">{metrics.queueDepth}</span>
        </div>
      {/if}
      {#if metrics.errorRate > 0}
        <div class="flex justify-between">
          <span>err rate</span>
          <span class="text-err">{(metrics.errorRate * 100).toFixed(1)}%</span>
        </div>
      {/if}
    {:else}
      <div class="italic">idle</div>
    {/if}
  </div>

  <Handle type="source" position={Position.Right} class="!bg-accent" />
</div>
