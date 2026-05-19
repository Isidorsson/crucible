<script lang="ts">
  import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/svelte';
  import { sim } from '$lib/stores/sim.svelte';

  let {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    source,
    target,
    markerEnd
  }: EdgeProps = $props();

  // Look up live flow count for this (src,dst) and turn it into stroke
  // color + width. Re-evaluates whenever sim.edgeFlowByKey is replaced
  // by the worker's snapshot tick.
  const flow = $derived(sim.edgeFlowByKey[`${source}->${target}`] ?? 0);
  const intensity = $derived(Math.min(1, Math.log10(flow + 1) / 3));
  const stroke = $derived(
    flow === 0 ? '#7d8590' : flow < 10 ? '#58a6ff' : flow < 100 ? '#3fb950' : '#f0883e'
  );

  const path = $derived(
    getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition
    })
  );
  const edgePath = $derived(path[0]);

  // prefers-reduced-motion check — disable the dashed animation if the
  // user opted out. matchMedia is safe in browser, undefined in SSR; the
  // route disables SSR so we know we're client-side here.
  let reduceMotion = $state(false);
  $effect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotion = mq.matches;
    const onChange = (e: MediaQueryListEvent) => (reduceMotion = e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });

  const dashAnim = $derived(flow > 0 && !reduceMotion);

  // Packet dots travelling along the edge path. Count scales with intensity
  // so a single trickle shows one dot, a saturated link shows three. Period
  // shrinks with intensity — fast lines feel faster.
  const showPackets = $derived(flow > 0 && !reduceMotion);
  const packetCount = $derived(1 + Math.round(intensity * 2));
  const packetDur = $derived(Math.max(0.6, 1.8 - intensity * 1.2));
  const packetRadius = $derived(2 + intensity * 1.5);
</script>

<BaseEdge
  path={edgePath}
  {markerEnd}
  style="stroke:{stroke}; stroke-width:{1 + intensity * 3}px;"
  class={dashAnim ? 'crucible-edge-flow' : ''}
/>

{#if showPackets}
  {#each Array(packetCount) as _, i (i)}
    <circle
      r={packetRadius}
      fill={stroke}
      opacity="0.9"
      style="filter: drop-shadow(0 0 3px {stroke});"
    >
      <animateMotion
        dur="{packetDur}s"
        repeatCount="indefinite"
        path={edgePath}
        begin="{(i * packetDur) / packetCount}s"
        rotate="auto"
      />
    </circle>
  {/each}
{/if}

<style>
  :global(.crucible-edge-flow) {
    stroke-dasharray: 5 5;
    animation: dashflow 0.6s linear infinite;
  }
  @keyframes dashflow {
    to {
      stroke-dashoffset: -10;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.crucible-edge-flow) {
      animation: none;
      stroke-dasharray: none;
    }
  }
</style>
