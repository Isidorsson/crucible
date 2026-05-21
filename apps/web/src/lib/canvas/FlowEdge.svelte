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
  const edgeKey = $derived(`${source}->${target}`);
  const flow = $derived(sim.edgeFlowByKey[edgeKey] ?? 0);
  const flowHistory = $derived(sim.edgeHistory[edgeKey] ?? []);
  // Severed via chaos. Drives a distinct visual (red dashed, no packets,
  // no halo) so the user can see a partition at a glance — separate from
  // a quiet link, which is grey/dashed but at low opacity.
  const partitioned = $derived(sim.partitionedEdgeKeys[edgeKey] === true);
  // Target-node p99 piggybacks on the edge label so the link surfaces both
  // throughput and tail latency without forcing the reader to fixate on
  // node bodies.
  const targetP99 = $derived(sim.metricsByNode[target]?.p99 ?? 0);

  // Trend arrow: compare the last sample against the median of the prior
  // half of the window. Median (not mean) so an isolated spike doesn't
  // flip the arrow back and forth.
  const trend = $derived.by((): '▲' | '▼' | '–' => {
    const n = flowHistory.length;
    if (n < 6) return '–';
    const recent = flowHistory[n - 1];
    const head = flowHistory.slice(0, Math.floor(n / 2)).sort((a, b) => a - b);
    const baseline = head[Math.floor(head.length / 2)];
    if (baseline < 0.5) return '–';
    const delta = (recent - baseline) / baseline;
    if (delta > 0.15) return '▲';
    if (delta < -0.15) return '▼';
    return '–';
  });

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
  // Severed link is drawn at the partition palette, regardless of flow.
  const PARTITION_STROKE = '#f85149';
  const renderStroke = $derived(partitioned ? PARTITION_STROKE : stroke);
  const strokeWidth = $derived(1.5 + intensity * 3.5);
  const haloWidth = $derived(strokeWidth + 6);

  // Stroke dash pattern doubles the load encoding so the chart reads for
  // users who can't distinguish the amber/red end of the ramp. Tiers 0-1
  // are dashed (idle, trickle), 2+ solid (real traffic). Partitioned edges
  // get a wide-gap dash so they read as cut even at idle traffic levels.
  const dashArray = $derived(
    partitioned ? '2 8' : tier <= 1 ? '6 6' : 'none'
  );

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
  const anchorX = $derived(pathTuple[1]);
  const anchorY = $derived(pathTuple[2]);

  // Lift label off path by perpendicular offset so edge stroke + packets
  // never cross under the text. Direction picked from source→target vector
  // (good enough for bezier midpoint placement) rotated 90° CCW.
  const LABEL_OFFSET = 28;
  const labelPos = $derived.by(() => {
    if (!params) return { x: anchorX, y: anchorY };
    const dx = params.tx - params.sx;
    const dy = params.ty - params.sy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    // Prefer label above horizontal lines: flip sign if perpendicular points down
    const sign = ny > 0 ? -1 : 1;
    return {
      x: anchorX + nx * LABEL_OFFSET * sign,
      y: anchorY + ny * LABEL_OFFSET * sign
    };
  });

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
  // No packets cross a severed link, regardless of upstream flow — the
  // engine drops the arrival event before it can fire the EdgeFlow bump.
  const showPackets = $derived(!partitioned && flow >= 1 && !reduceMotion);
  const packetCount = $derived(flow < 1 ? 0 : Math.min(4, 1 + Math.floor(intensity * 3)));
  const packetDur = $derived(Math.max(0.5, 1.7 - intensity * 1.2));
  const packetRadius = $derived(2.4 + intensity * 2.2);
  const packetGlow = $derived(3 + intensity * 6);

  function fmtRate(rps: number): string {
    if (rps < 1_000) return rps.toFixed(0);
    if (rps < 1_000_000) return `${(rps / 1_000).toFixed(1)}k`;
    return `${(rps / 1_000_000).toFixed(1)}M`;
  }

  function fmtLatency(ns: number): string {
    if (!ns) return '';
    if (ns < 1_000) return `${ns}ns`;
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(0)}µs`;
    if (ns < 1_000_000_000) return `${(ns / 1_000_000).toFixed(1)}ms`;
    return `${(ns / 1_000_000_000).toFixed(1)}s`;
  }

  const ariaSummary = $derived.by(() => {
    if (partitioned) return 'link partitioned, no traffic';
    const parts = [`${fmtRate(flow)} requests per second`];
    if (targetP99 > 0) parts.push(`p99 ${fmtLatency(targetP99)}`);
    if (trend === '▲') parts.push('rising');
    else if (trend === '▼') parts.push('falling');
    else parts.push('steady');
    return parts.join(', ');
  });

  // Midpoint of the severed stretch, for the "PARTITION" badge.
  const partLabelPos = $derived({ x: anchorX, y: anchorY });
</script>

<!-- Halo: wide, low-opacity stroke under the main path. Reads as a soft
     glow without paying for an SVG <filter> blur. Severed link skips the
     halo so the dashed gap reads clean. -->
{#if flow >= 1 && !partitioned}
  <path
    d={edgePath}
    fill="none"
    aria-hidden="true"
    style="stroke: {stroke}; stroke-width: {haloWidth}px; opacity: 0.18;"
  />
{/if}

<BaseEdge
  path={edgePath}
  {markerEnd}
  style="stroke: {renderStroke}; stroke-width: {partitioned
    ? 2
    : strokeWidth}px; opacity: {partitioned ? 0.85 : tier === 0
    ? 0.55
    : 0.95}; stroke-dasharray: {dashArray}; transition: stroke 220ms ease, stroke-width 220ms ease, opacity 220ms ease;"
  class={selected ? 'crucible-edge-selected' : ''}
/>

{#if showPackets}
  <g aria-hidden="true">
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
  </g>
{/if}

{#if partitioned}
  <!-- Severed-link marker: scissor-style "✕" badge at the path midpoint.
       Replaces the flow card because there's no traffic to report. -->
  <EdgeLabel
    x={partLabelPos.x}
    y={partLabelPos.y}
    transparent
    class="crucible-edge-card crucible-edge-severed"
    aria-label={ariaSummary}
  >
    <span aria-hidden="true">✕</span>
    <span>SEVERED</span>
  </EdgeLabel>
{/if}

{#if flow >= 1 && !partitioned}
  <!-- Tether: thin line from path anchor to floated label. Drawn under
       the anchor dot so the dot caps the line cleanly. -->
  <line
    x1={anchorX}
    y1={anchorY}
    x2={labelPos.x}
    y2={labelPos.y}
    stroke={stroke}
    stroke-width="1"
    opacity="0.55"
    aria-hidden="true"
  />
  <!-- Anchor dot on path -->
  <circle
    cx={anchorX}
    cy={anchorY}
    r="2.5"
    fill={stroke}
    stroke="#0d1117"
    stroke-width="1.5"
    aria-hidden="true"
  />
  <EdgeLabel
    x={labelPos.x}
    y={labelPos.y}
    transparent
    class="crucible-edge-card"
    style="--c: {stroke};"
    aria-label={ariaSummary}
  >
    <span class="bar" aria-hidden="true"></span>
    <span class="num">{fmtRate(flow)}</span><span class="unit">rps</span>
    <span class="trend" data-dir={trend} aria-hidden="true">{trend}</span>
    {#if targetP99 > 0}
      <span class="sep" aria-hidden="true"></span>
      <span class="lat tabular-nums">{fmtLatency(targetP99)}</span>
    {/if}
  </EdgeLabel>
{/if}

<style>
  :global(.svelte-flow .crucible-edge-selected) {
    filter: drop-shadow(0 0 4px currentColor);
  }
  /* EdgeLabel portals into a shared container, so styles must be global
     to escape Svelte's scoping hash. Card sits OFF the path, tethered by
     a thin SVG line — so the edge stroke never crosses the text. */
  :global(.crucible-edge-card) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 9px 4px 7px;
    border-radius: 4px;
    background: #0d1117;
    border: 1px solid color-mix(in srgb, var(--c) 75%, #30363d);
    color: #e6edf3;
    font-family:
      ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.04em;
    font-variant-numeric: tabular-nums;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.6),
      0 0 14px color-mix(in srgb, var(--c) 35%, transparent),
      0 2px 6px rgba(0, 0, 0, 0.7);
    white-space: nowrap;
    user-select: none;
    text-transform: uppercase;
    transition:
      border-color 220ms ease,
      box-shadow 220ms ease;
  }
  :global(.crucible-edge-card .bar) {
    width: 3px;
    align-self: stretch;
    background: var(--c);
    border-radius: 2px;
    box-shadow: 0 0 6px color-mix(in srgb, var(--c) 70%, transparent);
  }
  :global(.crucible-edge-card .num) {
    color: #f0f6fc;
    font-size: 12px;
  }
  :global(.crucible-edge-card .unit) {
    color: color-mix(in srgb, var(--c) 60%, #8b949e);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.05em;
    margin-left: -2px;
  }
  :global(.crucible-edge-card .sep) {
    width: 1px;
    height: 10px;
    background: #30363d;
    margin: 0 2px;
  }
  :global(.crucible-edge-card .lat) {
    color: #c9d1d9;
    font-size: 10px;
    font-weight: 600;
  }
  :global(.crucible-edge-card .trend) {
    font-size: 10px;
    line-height: 1;
    font-weight: 700;
    margin-left: 1px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 10px;
    text-align: center;
  }
  :global(.crucible-edge-card .trend[data-dir='▲']) {
    color: #f0883e;
  }
  :global(.crucible-edge-card .trend[data-dir='▼']) {
    color: #58a6ff;
  }
  :global(.crucible-edge-card .trend[data-dir='–']) {
    color: #8b949e;
  }
  /* Severed badge — collapses the flow card to a compact red tag. */
  :global(.crucible-edge-card.crucible-edge-severed) {
    gap: 6px;
    padding: 3px 8px;
    border-color: #f85149;
    color: #f85149;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.6),
      0 0 12px rgba(248, 81, 73, 0.45);
    font-size: 10px;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.svelte-flow .crucible-edge-selected) {
      filter: none;
    }
    :global(.crucible-edge-card) {
      transition: none;
    }
  }
</style>
