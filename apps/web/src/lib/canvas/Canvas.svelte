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
  import NoteNode from '$lib/components/nodes/NoteNode.svelte';
  import FlowEdge from './FlowEdge.svelte';
  import ContextMenu, { type CtxTarget } from './ContextMenu.svelte';
  import ConnectPopover from './ConnectPopover.svelte';
  import { design } from '$lib/stores/design.svelte';
  import type { NodeKind } from '$lib/types/topology';

  const nodeTypes: NodeTypes = {
    crucible: CrucibleNode as never,
    note: NoteNode as never
  };
  const edgeTypes: EdgeTypes = { flow: FlowEdge as never };

  let { onSelect }: { onSelect: (id: string | null) => void } = $props();

  const { screenToFlowPosition } = useSvelteFlow();

  // Context menu position + target. Null = closed.
  let ctx = $state<{ x: number; y: number; target: CtxTarget } | null>(null);

  // Drop-to-create popover. Opens when a connection drag releases on empty
  // pane; the picked component spawns at the drop position and is wired up
  // to the originating node in a single gesture.
  let drop = $state<{
    x: number;
    y: number;
    flowX: number;
    flowY: number;
    fromId: string;
    fromHandleType: 'source' | 'target';
  } | null>(null);

  // Tracked across connectstart → connectend so we know what to wire up.
  let connectFrom: { id: string; handleType: 'source' | 'target' } | null = null;

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
    // Convert cursor screen coords → flow coords so pan/zoom is respected.
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });

    const tplId = e.dataTransfer?.getData('application/crucible-template');
    if (tplId) {
      // Drop anchor = top-left of first template node; center on cursor.
      design.applyTemplate(tplId, { x: pos.x - 90, y: pos.y - 30 });
      return;
    }

    const kind = e.dataTransfer?.getData('application/crucible-kind') as NodeKind | '';
    if (!kind) return;
    // Offset by half the node footprint (~180×60) to center on cursor.
    design.addNode(kind, { x: pos.x - 90, y: pos.y - 30 });
  }

  function onConnect(conn: Connection) {
    if (!conn.source || !conn.target) return;
    design.addEdge(conn.source, conn.target);
  }

  // Reject self-loops and duplicate edges. In Loose mode the user can grab
  // either end, so we also normalise direction at edge-creation time below.
  function isValidConnection(conn: Edge | Connection): boolean {
    if (!conn.source || !conn.target) return false;
    if (conn.source === conn.target) return false;
    return !design.edges.some((e) => e.source === conn.source && e.target === conn.target);
  }

  function onConnectStart(_event: unknown, params: { nodeId: string | null; handleType: 'source' | 'target' | null }) {
    if (!params.nodeId || !params.handleType) return;
    connectFrom = { id: params.nodeId, handleType: params.handleType };
  }

  // If the user releases on empty pane, open the connect popover so we can
  // spawn a new node and wire it without a second drag. xyflow's connectend
  // event fires regardless of where the pointer lands.
  function onConnectEnd(event: MouseEvent | TouchEvent) {
    const from = connectFrom;
    connectFrom = null;
    if (!from) return;

    const target = event.target as HTMLElement | null;
    // Drops onto an existing node go through normal onConnect, not us.
    const droppedOnPane = !!target?.closest('.svelte-flow__pane');
    if (!droppedOnPane) return;

    const pt =
      'touches' in event
        ? event.changedTouches?.[0] ?? event.touches?.[0]
        : event;
    if (!pt) return;
    const { clientX, clientY } = pt as { clientX: number; clientY: number };
    const flow = screenToFlowPosition({ x: clientX, y: clientY });
    drop = {
      x: clientX,
      y: clientY,
      flowX: flow.x,
      flowY: flow.y,
      fromId: from.id,
      fromHandleType: from.handleType
    };
  }

  function onPickFromDrop(kind: NodeKind) {
    if (!drop) return;
    const newId = design.addNode(kind, { x: drop.flowX - 90, y: drop.flowY - 30 });
    // handleType describes the END the user grabbed: 'source' = they
    // dragged from a source-side, so the new node is the target. With
    // Loose mode every cover-handle is type=source, but a user still
    // intuitively expects the drag direction to set edge direction.
    if (drop.fromHandleType === 'source') {
      design.addEdge(drop.fromId, newId);
    } else {
      design.addEdge(newId, drop.fromId);
    }
    drop = null;
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
    connectionRadius={60}
    connectionMode={ConnectionMode.Loose}
    connectionLineType={ConnectionLineType.Bezier}
    {isValidConnection}
    onconnect={onConnect}
    onconnectstart={onConnectStart}
    onconnectend={onConnectEnd}
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

  {#if drop}
    <ConnectPopover
      x={drop.x}
      y={drop.y}
      onPick={onPickFromDrop}
      onClose={() => (drop = null)}
    />
  {/if}
</div>
