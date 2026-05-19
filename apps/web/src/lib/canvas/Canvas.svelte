<script lang="ts">
  import {
    SvelteFlow,
    useSvelteFlow,
    ConnectionMode,
    ConnectionLineType,
    Background,
    Controls,
    MiniMap,
    type NodeTypes,
    type EdgeTypes,
    type Connection,
    type Edge
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

  const { screenToFlowPosition } = useSvelteFlow();

  // Context menu position + target. Null = closed.
  let ctx = $state<{ x: number; y: number; target: CtxTarget } | null>(null);

  function openMenu(event: MouseEvent, target: CtxTarget) {
    event.preventDefault();
    event.stopPropagation();
    // Defer the state write so the contextmenu event finishes bubbling
    // before the ContextMenu mounts its svelte:window listeners. Without
    // this, the same right-click would reach the window listener and
    // immediately close the menu we are about to open.
    queueMicrotask(() => {
      ctx = { x: event.clientX, y: event.clientY, target };
    });
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const kind = e.dataTransfer?.getData('application/crucible-kind') as NodeKind | '';
    if (!kind) return;
    // Convert cursor screen coords → flow coords so pan/zoom is respected,
    // then offset by half the node footprint (~180×60) to center on cursor.
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    design.addNode(kind, { x: pos.x - 90, y: pos.y - 30 });
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

  // Reject self-loops and duplicate edges before SvelteFlow fires onConnect.
  // Strict mode already prevents source→source / target→target, so here we
  // only need to enforce graph-level rules.
  function isValidConnection(conn: Edge | Connection): boolean {
    if (!conn.source || !conn.target) return false;
    if (conn.source === conn.target) return false;
    return !design.edges.some((e) => e.source === conn.source && e.target === conn.target);
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
    connectionRadius={28}
    connectionMode={ConnectionMode.Strict}
    connectionLineType={ConnectionLineType.Bezier}
    {isValidConnection}
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
