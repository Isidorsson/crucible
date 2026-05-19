<script lang="ts">
  import { Handle, Position, type NodeProps, type Node } from '@xyflow/svelte';
  import { CATALOG_BY_KIND } from '$lib/types/catalog';
  import type { CrucibleNodeData } from '$lib/stores/design.svelte';
  import { sim } from '$lib/stores/sim.svelte';
  import { AlertTriangle, GripHorizontal } from '@lucide/svelte';
  import Hint from '../Hint.svelte';
  import Tooltip from '../Tooltip.svelte';
  import Sparkline from '../Sparkline.svelte';

  let { id, data, selected }: NodeProps<Node<CrucibleNodeData>> = $props();
  const entry = $derived(CATALOG_BY_KIND[data.kind]);
  const metrics = $derived(sim.metricsByNode[id]);
  const history = $derived(sim.nodeHistory[id]);

  // Capacity gauge: ratio of in-flight to a soft ceiling. Without an
  // explicit `capacity` prop on every node kind we estimate it from the
  // historical inFlight + queue peaks. A nonzero queue is the strongest
  // signal that we've crossed the comfortable ceiling, so it dominates.
  const capacityRatio = $derived.by(() => {
    if (!metrics) return 0;
    const peakInFlight = history?.inFlight.reduce((m, v) => (v > m ? v : m), 0) ?? 0;
    // Ceiling = max observed inFlight, padded up so we don't read 100%
    // the moment a new high is set. Minimum of 4 keeps the gauge from
    // pinning at 100% under trivial load.
    const ceiling = Math.max(4, peakInFlight * 1.25, metrics.queueDepth + metrics.inFlight);
    return Math.min(1, metrics.inFlight / ceiling);
  });

  // Health: error rate is the loudest signal, queue depth a secondary one,
  // throughput colour is for chart not status.
  const healthTier = $derived.by(() => {
    if (!metrics) return 'idle' as const;
    if (metrics.faulted) return 'fault' as const;
    if (metrics.errorRate > 0.05) return 'fault' as const;
    if (metrics.errorRate > 0 || metrics.queueDepth > 0) return 'warn' as const;
    return 'ok' as const;
  });

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

  <!--
    Health stripe: 3px coloured rail on the left edge. Single-glance status
    that survives even when the node is unselected on a busy canvas.
  -->
  <span
    class="crucible-status-stripe"
    data-tier={healthTier}
    aria-hidden="true"
  ></span>

  <div class="node-drag-handle mb-1.5 flex cursor-grab items-center gap-2 border-b border-line pb-1.5 active:cursor-grabbing">
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

  <div class="crucible-node-body space-y-1 text-muted">
    {#if metrics}
      <!--
        Capacity gauge: thin bar showing in-flight load relative to a
        soft ceiling. Width-only fill so the animation stays on the
        compositor (no layout). Tier colour matches the health stripe so
        the two stay congruent at a glance.
      -->
      <div class="crucible-gauge" data-tier={healthTier} aria-hidden="true">
        <span
          class="crucible-gauge-fill"
          style="width: {(capacityRatio * 100).toFixed(1)}%"
        ></span>
      </div>

      <!--
        Throughput row: number on the left, sparkline of recent history on
        the right. Pulls the chart into the same line so we don't burn
        another row of vertical space.
      -->
      <div class="flex items-center justify-between gap-2">
        <Hint term="rps" />
        <span class="flex min-w-0 items-center gap-1.5">
          <Sparkline
            values={history?.rps ?? []}
            width={42}
            height={12}
            stroke="#58a6ff"
            fill="#58a6ff"
          />
          <span class="text-ink tabular-nums">{fmtRate(metrics.throughput)}</span>
        </span>
      </div>

      <div class="flex items-center justify-between gap-2">
        <Hint term="p50p99" />
        <span class="flex min-w-0 items-center gap-1.5">
          <Sparkline
            values={history?.p99 ?? []}
            width={42}
            height={12}
            stroke="#f0883e"
            fill="#f0883e"
            absoluteScale={false}
          />
          <span class="text-ink tabular-nums">
            {fmtLatency(metrics.p50)} / {fmtLatency(metrics.p99)}
          </span>
        </span>
      </div>

      <div class="flex items-center justify-between gap-2">
        <Hint term="inFlight" />
        <span class="text-ink tabular-nums">{metrics.inFlight}</span>
      </div>

      {#if metrics.queueDepth > 0}
        <div class="flex items-center justify-between gap-2">
          <Hint term="queue" />
          <span class="text-warn tabular-nums">{metrics.queueDepth}</span>
        </div>
      {/if}
      {#if metrics.errorRate > 0}
        <div class="flex items-center justify-between gap-2">
          <Hint term="errRate" />
          <span class="text-err tabular-nums">{(metrics.errorRate * 100).toFixed(1)}%</span>
        </div>
      {/if}
    {:else}
      <div class="italic">Idle — press Start to stream metrics</div>
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
  /*
    Surgical pointer-events restore for Hint glossary terms inside the body
    so their tooltips still fire on hover/focus. The dotted-underline span
    is small enough that user can still initiate a connection from the
    surrounding gaps in the body, which stay pointer-events:none.
  */
  .crucible-node > :global(.crucible-node-body .crucible-hint) {
    pointer-events: auto;
  }

  /* Health stripe on left edge. Coloured rail, single-glance status. */
  :global(.crucible-status-stripe) {
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    border-top-left-radius: inherit;
    border-bottom-left-radius: inherit;
    background: #30363d;
    transition: background-color 220ms ease;
    z-index: 1;
    pointer-events: none;
  }
  :global(.crucible-status-stripe[data-tier='idle']) {
    background: #30363d;
  }
  :global(.crucible-status-stripe[data-tier='ok']) {
    background: #3fb950;
    box-shadow: 0 0 8px rgba(63, 185, 80, 0.5);
  }
  :global(.crucible-status-stripe[data-tier='warn']) {
    background: #f0883e;
    box-shadow: 0 0 8px rgba(240, 136, 62, 0.5);
  }
  :global(.crucible-status-stripe[data-tier='fault']) {
    background: #f85149;
    box-shadow: 0 0 10px rgba(248, 81, 73, 0.6);
  }

  /* Thin capacity gauge under the header. Fill is width-animated only. */
  :global(.crucible-gauge) {
    position: relative;
    height: 3px;
    width: 100%;
    border-radius: 2px;
    background: rgba(48, 54, 61, 0.7);
    overflow: hidden;
    pointer-events: none;
  }
  :global(.crucible-gauge-fill) {
    display: block;
    height: 100%;
    border-radius: 2px;
    background: #58a6ff;
    transition: width 220ms ease, background-color 220ms ease;
    will-change: width;
  }
  :global(.crucible-gauge[data-tier='ok'] .crucible-gauge-fill) {
    background: #3fb950;
  }
  :global(.crucible-gauge[data-tier='warn'] .crucible-gauge-fill) {
    background: #f0883e;
  }
  :global(.crucible-gauge[data-tier='fault'] .crucible-gauge-fill) {
    background: #f85149;
  }
  :global(.crucible-gauge[data-tier='idle'] .crucible-gauge-fill) {
    background: #58a6ff;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.crucible-status-stripe),
    :global(.crucible-gauge-fill) {
      transition: none;
    }
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
