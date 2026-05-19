<script lang="ts">
  import {
    SvelteFlow,
    Background,
    Controls,
    MiniMap,
    type NodeTypes,
    type EdgeTypes,
    type Connection
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import CrucibleNode from '$lib/components/nodes/CrucibleNode.svelte';
  import FlowEdge from './FlowEdge.svelte';
  import ContextMenu, { type CtxTarget } from './ContextMenu.svelte';
  import { design } from '$lib/stores/design.svelte';
  import type { NodeKind } from '$lib/types/topology';
  import { nanoid } from 'nanoid';

  const nodeTypes: NodeTypes = { crucible: CrucibleNode as never };
  const edgeTypes: EdgeTypes = { flow: FlowEdge as never };

  let { onSelect }: { onSelect: (id: string | null) => void } = $props();

  // Context menu position + target. Null = closed.
  let ctx = $state<{ x: number; y: number; target: CtxTarget } | null>(null);

  function openMenu(event: MouseEvent, target: CtxTarget) {
    event.preventDefault();
    ctx = { x: event.clientX, y: event.clientY, target };
  }

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
      {
        id: `${conn.source}->${conn.target}-${nanoid(4)}`,
        source: conn.source,
        target: conn.target,
        type: 'flow'
      }
    ];
  }
</script>

<div
  id="canvas"
  class="relative h-full min-w-0 flex-1"
  role="region"
  aria-label="System design canvas. Drag components from the palette, connect ports to define request flow. Right-click for actions. Delete key removes selection."
  ondragover={onDragOver}
  ondrop={onDrop}
>
  <SvelteFlow
    bind:nodes={design.nodes}
    bind:edges={design.edges}
    {nodeTypes}
    {edgeTypes}
    defaultEdgeOptions={{ type: 'flow' }}
    deleteKey={['Delete', 'Backspace']}
    multiSelectionKey={['Shift', 'Meta', 'Control']}
    onconnect={onConnect}
    onnodeclick={({ node }) => onSelect(node.id)}
    onpaneclick={() => {
      onSelect(null);
      ctx = null;
    }}
    onnodecontextmenu={({ node, event }) => openMenu(event, { kind: 'node', id: node.id })}
    onedgecontextmenu={({ edge, event }) => openMenu(event, { kind: 'edge', id: edge.id })}
    onpanecontextmenu={({ event }) => openMenu(event, { kind: 'pane' })}
    fitView
    proOptions={{ hideAttribution: true }}
  >
    <Background gap={24} />
    <Controls showLock={false} />
    <MiniMap pannable zoomable />
  </SvelteFlow>

  {#if ctx}
    <ContextMenu x={ctx.x} y={ctx.y} target={ctx.target} onClose={() => (ctx = null)} />
  {/if}
</div>
