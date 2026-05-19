<script lang="ts">
  import {
    SvelteFlow,
    Background,
    Controls,
    MiniMap,
    type NodeTypes,
    type Connection,
    type Edge
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import CrucibleNode from '$lib/components/nodes/CrucibleNode.svelte';
  import { design, type CrucibleNodeData } from '$lib/stores/design.svelte';
  import { sim } from '$lib/stores/sim.svelte';
  import type { NodeKind } from '$lib/types/topology';
  import { nanoid } from 'nanoid';

  const nodeTypes: NodeTypes = { crucible: CrucibleNode as never };

  let { onSelect }: { onSelect: (id: string | null) => void } = $props();

  // Track prefers-reduced-motion at runtime so the edge dash animation
  // turns off for users who request reduced motion. Listener attaches once
  // per Canvas mount; auto-cleaned via the effect's teardown.
  let reduceMotion = $state<boolean>(false);
  $effect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotion = mq.matches;
    const onChange = (e: MediaQueryListEvent) => (reduceMotion = e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });

  // Derive a "live" edge list that injects flow-based styling without
  // mutating the source design edges. Stroke width + color scale with
  // the per-edge traversal count from the last snapshot frame. The dashed
  // animation only runs when (a) traffic is flowing and (b) the user has
  // not requested reduced motion.
  const liveEdges = $derived.by<Edge[]>(() => {
    return design.edges.map((e) => {
      const k = `${e.source}->${e.target}`;
      const flow = sim.edgeFlowByKey[k] ?? 0;
      const intensity = Math.min(1, Math.log10(flow + 1) / 3); // 0..1 across 1..1000 hops/frame
      const stroke =
        flow === 0 ? '#7d8590' : flow < 10 ? '#58a6ff' : flow < 100 ? '#3fb950' : '#f0883e';
      return {
        ...e,
        animated: flow > 0 && !reduceMotion,
        style: `stroke:${stroke}; stroke-width:${1 + intensity * 3}px;`
      };
    });
  });

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const kind = e.dataTransfer?.getData('application/crucible-kind') as NodeKind | '';
    if (!kind) return;
    const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
    design.addNode(kind, {
      x: e.clientX - bounds.left - 90,
      y: e.clientY - bounds.top - 30
    });
  }

  function onConnect(conn: Connection) {
    if (!conn.source || !conn.target) return;
    design.edges = [
      ...design.edges,
      { id: `${conn.source}->${conn.target}-${nanoid(4)}`, source: conn.source, target: conn.target }
    ];
  }
</script>

<div
  id="canvas"
  class="relative h-full min-w-0 flex-1"
  role="region"
  aria-label="System design canvas. Drag components from the palette, connect ports to define request flow."
  ondragover={onDragOver}
  ondrop={onDrop}
>
  <SvelteFlow
    bind:nodes={design.nodes}
    edges={liveEdges}
    onedgeschange={(changes) => {
      // Edges are derived; persist structural deletes back to the source.
      for (const c of changes) {
        if (c.type === 'remove') {
          design.edges = design.edges.filter((e) => e.id !== c.id);
        }
      }
    }}
    {nodeTypes}
    onconnect={onConnect}
    onnodeclick={(_, node) => onSelect(node.id)}
    onpaneclick={() => onSelect(null)}
    fitView
    proOptions={{ hideAttribution: true }}
  >
    <Background gap={24} />
    <Controls showLock={false} />
    <MiniMap pannable zoomable />
  </SvelteFlow>
</div>
