<script lang="ts">
  import {
    BaseEdge,
    EdgeLabel,
    getBezierPath,
    useInternalNode,
    type EdgeProps
  } from '@xyflow/svelte';
  import { untrack } from 'svelte';
  import { sim } from '$lib/stores/sim.svelte';
  import { getEdgeParams } from './floating';

  let {
    source,
    target,
    markerEnd,
    selected
  }: EdgeProps = $props();

  // Floating-edge anchors: instead of fixed L/R handle positions, read live
  // node geometry and recompute the closest side every render. Loose mode
  // means a single covering Handle, so we can't rely on sourceX/Y props.
  // useInternalNode subscribes to a specific id. Edge source/target are
  // stable for the edge lifetime (xyflow re-mounts the edge if either id
  // changes), so it's safe to subscribe once with the initial values.
  // untrack() acknowledges to Svelte that the one-shot read is intentional.
  const sourceStore = useInternalNode(untrack(() => source));
  const targetStore = useInternalNode(untrack(() => target));
  const params = $derived.by(() => {
    const s = sourceStore.current;
    const t = targetStore.current;
    if (!s || !t) return null;
    return getEdgeParams(s, t);
  });

  // Live flow count for this (src,dst). Re-derives whenever the worker's
  // snapshot tick replaces sim.edgeFlowByKey.
  const flow = $derived(sim.edgeFlowByKey[`${source}->${target}`] ?? 0);

  // Five-tier ramp. Thresholds picked so a sysadmin's intuition matches the
  // color: <50 = trickle, 50-499 = warm, 500-4999 = hot, 5000+ = saturated
  // and the line goes lava red as a runaway-load signal. flow is an EMA-
  // smoothed float, so use < 1 (not === 0) to mean "no meaningful traffic".
  const tier = $derived(
    flow < 1 ? 0 : flow < 50 ? 1 : flow < 500 ? 2 : flow < 5000 ? 3 : 4
  );
  // Cool steel → cyan → green → forge amber → lava red. Chosen to look like
  // an annealing metal scale: the visual heat tracks request volume.
  const STROKES = ['#3d4654', '#58a6ff', '#3fb950', '#f0883e', '#f85149'];
  const stroke = $derived(STROKES[tier]);

  const intensity = $derived(Math.min(1, Math.log10(flow + 1) / 4));
  const strokeWidth = $derived(1.5 + intensity * 3.5);
  const haloWidth = $derived(strokeWidth + 6);

  const pathTuple = $derived(
    params
      ? getBezierPath({
          sourceX: params.sx,
          sourceY: params.sy,
          sourcePosition: params.sourcePos,
          targetX: params.tx,
          targetY: params.ty,
          targetPosition: params.targetPos
        })
      : (['', 0, 0] as const)
  );
  const edgePath = $derived(pathTuple[0]);
  const labelX = $derived(pathTuple[1]);
  const labelY = $derived(pathTuple[2]);

  // prefers-reduced-motion check — disable packet motion if the user opted
  // out. matchMedia is safe in browser; SSR is disabled on this route.
  let reduceMotion = $state(false);
  $effect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotion = mq.matches;
    const onChange = (e: MediaQueryListEvent) => (reduceMotion = e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });

  // Packets travel the path. Count and tempo scale with intensity so a
  // saturated link visibly outpaces a trickle. Each packet is a glowing
  // head plus a faint trail circle staggered slightly behind it for a
  // comet/ember look without needing SVG filters.
  const showPackets = $derived(flow >= 1 && !reduceMotion);
  const packetCount = $derived(flow < 1 ? 0 : Math.min(4, 1 + Math.floor(intensity * 3)));
  const packetDur = $derived(Math.max(0.5, 1.7 - intensity * 1.2));
  const packetRadius = $derived(2.4 + intensity * 2.2);
  const packetGlow = $derived(3 + intensity * 6);

  function fmtRate(rps: number): string {
    if (rps < 1_000) return rps.toFixed(0);
    if (rps < 1_000_000) return `${(rps / 1_000).toFixed(1)}k`;
    return `${(rps / 1_000_000).toFixed(1)}M`;
  }
</script>

<!-- Halo: wide, low-opacity stroke under the main path. Reads as a soft
     glow without paying for an SVG <filter> blur. -->
{#if flow >= 1}
  <path
    d={edgePath}
    fill="none"
    style="stroke: {stroke}; stroke-width: {haloWidth}px; opacity: 0.18;"
  />
{/if}

<BaseEdge
  path={edgePath}
  {markerEnd}
  style="stroke: {stroke}; stroke-width: {strokeWidth}px; opacity: {tier === 0
    ? 0.55
    : 0.95}; transition: stroke 220ms ease, stroke-width 220ms ease, opacity 220ms ease;"
  class={selected ? 'crucible-edge-selected' : ''}
/>

{#if showPackets}
  {#each Array(packetCount) as _, i (i)}
    {@const begin = (i * packetDur) / packetCount}
    <!-- Bright head -->
    <circle
      r={packetRadius}
      fill={stroke}
      opacity="0.95"
      style="filter: drop-shadow(0 0 {packetGlow}px {stroke});"
    >
      <animateMotion
        dur="{packetDur}s"
        repeatCount="indefinite"
        path={edgePath}
        begin="{begin}s"
      />
    </circle>
    <!-- Faint trail, slightly behind -->
    <circle r={packetRadius * 0.55} fill={stroke} opacity="0.4">
      <animateMotion
        dur="{packetDur}s"
        repeatCount="indefinite"
        path={edgePath}
        begin="{Math.max(0, begin - 0.06)}s"
      />
    </circle>
  {/each}
{/if}

{#if flow >= 1}
  <EdgeLabel
    x={labelX}
    y={labelY}
    transparent
    class="crucible-edge-pill"
    style="--c: {stroke};"
    aria-label="{fmtRate(flow)} requests per second"
  >
    <span class="num">{fmtRate(flow)}</span><span class="unit">rps</span>
  </EdgeLabel>
{/if}

<style>
  :global(.svelte-flow .crucible-edge-selected) {
    filter: drop-shadow(0 0 4px currentColor);
  }
  /* EdgeLabel portals into a shared container, so styles must be global
     to escape Svelte's scoping hash. */
  :global(.crucible-edge-pill) {
    display: inline-flex;
    align-items: baseline;
    gap: 3px;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(13, 17, 23, 0.92);
    border: 1px solid color-mix(in srgb, var(--c) 65%, transparent);
    color: var(--c);
    font-family:
      ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 10px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0.04em;
    font-variant-numeric: tabular-nums;
    box-shadow:
      0 0 12px color-mix(in srgb, var(--c) 30%, transparent),
      0 0 0 1px rgba(0, 0, 0, 0.4);
    white-space: nowrap;
    user-select: none;
    text-transform: uppercase;
    backdrop-filter: blur(2px);
    transition:
      color 220ms ease,
      border-color 220ms ease,
      box-shadow 220ms ease;
  }
  :global(.crucible-edge-pill .num) {
    color: var(--c);
  }
  :global(.crucible-edge-pill .unit) {
    color: color-mix(in srgb, var(--c) 55%, #7d8590);
    font-size: 8px;
    font-weight: 500;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.svelte-flow .crucible-edge-selected) {
      filter: none;
    }
    :global(.crucible-edge-pill) {
      transition: none;
    }
  }
</style>
