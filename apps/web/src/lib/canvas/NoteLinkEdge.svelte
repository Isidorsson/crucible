<script lang="ts">
  import {
    BaseEdge,
    getBezierPath,
    useInternalNode,
    type EdgeProps
  } from '@xyflow/svelte';
  import { untrack } from 'svelte';
  import { getEdgeParams } from './floating';

  // Annotation edge between a sticky note and any node. No traffic, no
  // packets, no flow label — it just says "this note is about that". The
  // dashed amber stroke matches the note's tint so the relationship reads
  // at a glance against the cool blue/green of real data edges.
  let { source, target, selected, markerEnd }: EdgeProps = $props();

  const sourceStore = useInternalNode(untrack(() => source));
  const targetStore = useInternalNode(untrack(() => target));
  const params = $derived.by(() => {
    const s = sourceStore.current;
    const t = targetStore.current;
    if (!s || !t) return null;
    return getEdgeParams(s, t);
  });

  const pathTuple = $derived(
    params
      ? getBezierPath({
          sourceX: params.sx,
          sourceY: params.sy,
          sourcePosition: params.sourcePos,
          targetX: params.tx,
          targetY: params.ty,
          targetPosition: params.targetPos,
          curvature: 0.2
        })
      : (['', 0, 0] as const)
  );
  const edgePath = $derived(pathTuple[0]);
</script>

<BaseEdge
  path={edgePath}
  {markerEnd}
  class={selected ? 'crucible-note-edge-selected' : ''}
  style="stroke: #d29922; stroke-width: 1.5px; stroke-dasharray: 4 4; opacity: 0.75; fill: none; transition: opacity 160ms ease, stroke-width 160ms ease;"
/>

<style>
  :global(.svelte-flow .crucible-note-edge-selected) {
    filter: drop-shadow(0 0 4px #d29922);
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.svelte-flow .crucible-note-edge-selected) {
      filter: none;
    }
  }
</style>
