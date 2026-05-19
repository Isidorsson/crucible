<script lang="ts">
  import {
    SvelteFlow,
    Background,
    Controls,
    MiniMap,
    type NodeTypes,
    type Connection
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import CrucibleNode from '$lib/components/nodes/CrucibleNode.svelte';
  import { design, type CrucibleNodeData } from '$lib/stores/design.svelte';
  import type { NodeKind } from '$lib/types/topology';
  import { nanoid } from 'nanoid';

  const nodeTypes: NodeTypes = { crucible: CrucibleNode as never };

  let { onSelect }: { onSelect: (id: string | null) => void } = $props();

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
      { id: nanoid(8), source: conn.source, target: conn.target, animated: true }
    ];
  }
</script>

<div
  class="relative h-full flex-1"
  role="region"
  ondragover={onDragOver}
  ondrop={onDrop}
>
  <SvelteFlow
    bind:nodes={design.nodes}
    bind:edges={design.edges}
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
