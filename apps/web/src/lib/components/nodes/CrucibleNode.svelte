<script lang="ts">
  import { Handle, Position, type NodeProps, type Node } from '@xyflow/svelte';
  import { CATALOG_BY_KIND } from '$lib/types/catalog';
  import type { CrucibleNodeData } from '$lib/stores/design.svelte';
  import { sim } from '$lib/stores/sim.svelte';
  import { AlertTriangle } from '@lucide/svelte';
  import Hint from '../Hint.svelte';
  import Tooltip from '../Tooltip.svelte';

  let { id, data, selected }: NodeProps<Node<CrucibleNodeData>> = $props();
  const entry = $derived(CATALOG_BY_KIND[data.kind]);
  const metrics = $derived(sim.metricsByNode[id]);

  // One-shot flash class when fault first appears. Rising-edge detection so
  // we don't re-trigger every snapshot tick while the fault stays active.
  let flashing = $state(false);
  let prevFaulted = false;
  $effect(() => {
    const f = metrics?.faulted ?? false;
    if (f && !prevFaulted) {
      flashing = true;
      const t = setTimeout(() => (flashing = false), 700);
      prevFaulted = f;
      return () => clearTimeout(t);
    }
    prevFaulted = f;
  });

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
  class="crucible-node rounded-lg border bg-panel px-3 py-2 font-mono text-xs shadow-lg ring-1
         transition-colors
         {selected ? 'ring-accent' : 'ring-line'}
         {metrics?.faulted ? 'border-err' : 'border-line'}
         {flashing ? 'crucible-node-flash' : ''}"
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
    <Tooltip content={entry.description} side="top">
      {#snippet children(id)}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <span
          tabindex="0"
          aria-describedby={id}
          class="cursor-help font-semibold tracking-wide text-ink
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {entry.label}
        </span>
      {/snippet}
    </Tooltip>
    {#if metrics?.faulted}
      <Tooltip content="A fault is active on this node — chaos engineering in action. Open the Inspector to clear." side="left">
        {#snippet children(id)}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <span
            tabindex="0"
            aria-describedby={id}
            class="ml-auto inline-flex cursor-help focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-err"
            aria-label="Node is faulted"
          >
            <AlertTriangle class="h-3.5 w-3.5 text-err" aria-hidden="true" />
          </span>
        {/snippet}
      </Tooltip>
    {/if}
  </div>

  <div class="space-y-0.5 text-muted">
    {#if metrics}
      <div class="flex justify-between">
        <Hint term="rps" />
        <span class="text-ink tabular-nums">{fmtRate(metrics.throughput)}</span>
      </div>
      <div class="flex justify-between">
        <Hint term="p50p99" />
        <span class="text-ink tabular-nums">
          {fmtLatency(metrics.p50)} / {fmtLatency(metrics.p99)}
        </span>
      </div>
      <div class="flex justify-between">
        <Hint term="inFlight" />
        <span class="text-ink tabular-nums">{metrics.inFlight}</span>
      </div>
      {#if metrics.queueDepth > 0}
        <div class="flex justify-between">
          <Hint term="queue" />
          <span class="text-warn tabular-nums">{metrics.queueDepth}</span>
        </div>
      {/if}
      {#if metrics.errorRate > 0}
        <div class="flex justify-between">
          <Hint term="errRate" />
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
    width: 16px;
    height: 16px;
    border-radius: 9999px;
    background: var(--crucible-accent, #58a6ff);
    border: 2px solid var(--crucible-panel, #0d1117);
    transition: transform 120ms ease, background-color 120ms ease, box-shadow 120ms ease;
  }
  /* Invisible padded hit-target so users don't need pixel-perfect aim.
     Extends ~10px in every direction without affecting the visible dot. */
  :global(.svelte-flow .crucible-handle::before) {
    content: '';
    position: absolute;
    inset: -10px;
    border-radius: 9999px;
  }
  :global(.svelte-flow .crucible-handle:hover),
  :global(.svelte-flow .crucible-handle.connectingfrom),
  :global(.svelte-flow .crucible-handle.connectionindicator) {
    transform: scale(1.35);
    box-shadow: 0 0 0 5px rgba(88, 166, 255, 0.22);
  }
  /* Valid drop target during a drag — green pulse pulls the eye. */
  :global(.svelte-flow .crucible-handle.valid) {
    background: #3fb950;
    box-shadow: 0 0 0 6px rgba(63, 185, 80, 0.28);
  }
  :global(.svelte-flow .crucible-handle--source) {
    right: -9px;
  }
  :global(.svelte-flow .crucible-handle--target) {
    left: -9px;
  }
  .crucible-node {
    transition: border-color 160ms ease, box-shadow 160ms ease;
    transform-origin: center;
  }
  .crucible-node-flash {
    animation: crucibleFault 700ms ease-out 1;
  }
  @keyframes crucibleFault {
    0% {
      box-shadow: 0 0 0 0 rgba(248, 81, 73, 0.55);
    }
    60% {
      box-shadow: 0 0 0 12px rgba(248, 81, 73, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(248, 81, 73, 0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.svelte-flow .crucible-handle) {
      transition: none;
    }
    :global(.svelte-flow .crucible-handle:hover),
    :global(.svelte-flow .crucible-handle.connectingfrom),
    :global(.svelte-flow .crucible-handle.connectionindicator) {
      transform: none;
    }
    .crucible-node {
      transition: none;
    }
    .crucible-node-flash {
      animation: none;
    }
  }
</style>
