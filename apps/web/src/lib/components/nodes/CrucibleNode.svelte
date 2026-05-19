<script lang="ts">
  import { Handle, Position, type NodeProps, type Node } from '@xyflow/svelte';
  import { CATALOG_BY_KIND } from '$lib/types/catalog';
  import type { CrucibleNodeData } from '$lib/stores/design.svelte';
  import { sim } from '$lib/stores/sim.svelte';
  import { AlertTriangle, GripHorizontal } from '@lucide/svelte';
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
  class="crucible-node relative rounded-lg border bg-panel px-3 py-2 font-mono text-xs shadow-lg ring-1
         transition-colors
         {selected ? 'ring-accent' : 'ring-line'}
         {metrics?.faulted ? 'border-err' : 'border-line'}
         {flashing ? 'crucible-node-flash' : ''}"
  style="min-width: 180px;"
>
  <!--
    Easy-connect handle: a single Handle stretched over the whole node body.
    In ConnectionMode.Loose this acts as both source and target, so user can
    grab from anywhere on the node and connect any direction. The dragHandle
    selector on the parent node scopes node-move to .node-drag-handle, so
    body grabs start a connection instead of a move.
  -->
  <Handle
    type="source"
    position={Position.Left}
    class="crucible-handle crucible-handle--cover"
    aria-label="Connect from anywhere on this component"
  />

  <div class="node-drag-handle mb-1.5 flex cursor-move items-center gap-2 border-b border-line pb-1.5">
    <entry.icon class="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
    <Tooltip content={entry.details} side="top">
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
            class="inline-flex cursor-help focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-err"
            aria-label="Node is faulted"
          >
            <AlertTriangle class="h-3.5 w-3.5 text-err" aria-hidden="true" />
          </span>
        {/snippet}
      </Tooltip>
    {/if}
    <GripHorizontal
      class="ml-auto h-3 w-3 shrink-0 text-muted opacity-40"
      aria-hidden="true"
    />
  </div>

  <div class="crucible-node-body space-y-0.5 text-muted">
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

</div>

<style>
  /*
    Easy-connect: a single Handle stretched over the full node body. No
    visible "dot" — the whole card is the grab target. Border ring on hover
    pulls the eye like Figma's connector hover, and turns green on valid
    drop target during a drag (xyflow adds .valid automatically in Loose).
  */
  :global(.svelte-flow .crucible-handle--cover) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: none;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    opacity: 0;
    transition: opacity 120ms ease, box-shadow 120ms ease;
    /*
      Sit behind content. Body content has pointer-events:none so pointer
      events fall through to this handle — that's how xyflow detects
      connect-start anywhere on the node. The header drag-handle restores
      pointer-events:auto so node-move still works on the title strip.
    */
    z-index: 0;
  }
  .crucible-node > :global(.node-drag-handle) {
    position: relative;
    z-index: 2;
    pointer-events: auto;
  }
  .crucible-node > :global(.crucible-node-body) {
    position: relative;
    z-index: 1;
    pointer-events: none;
  }
  :global(.svelte-flow .crucible-handle--cover:hover),
  :global(.svelte-flow .crucible-handle--cover.connectingfrom),
  :global(.svelte-flow .crucible-handle--cover.connectionindicator) {
    opacity: 1;
    box-shadow: inset 0 0 0 2px rgba(88, 166, 255, 0.55);
  }
  /* Valid drop target during a drag — green ring pulls the eye. */
  :global(.svelte-flow .crucible-handle--cover.valid) {
    opacity: 1;
    box-shadow: inset 0 0 0 3px #3fb950, 0 0 18px rgba(63, 185, 80, 0.4);
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
