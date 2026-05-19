import type { Edge, Node } from '@xyflow/svelte';
import type { NodeDef, NodeKind, NodeProps, TopologySpec } from '$lib/types/topology';
import { CATALOG_BY_KIND } from '$lib/types/catalog';
import { TEMPLATE_BY_ID } from '$lib/types/templates';
import { nanoid } from 'nanoid';

export interface CrucibleNodeData extends Record<string, unknown> {
  kind: NodeKind;
  label: string;
  props: NodeProps;
}

// Mutation listener — the sim store registers itself here so graph
// additions can be forwarded to the running engine without design.svelte
// having to import sim.svelte (which would create a circular import: sim
// already imports design to read the spec on start).
export interface MutationListener {
  onAddNode?: (node: NodeDef) => void;
  onAddEdge?: (src: string, dst: string) => void;
}
let listener: MutationListener = {};
export function setMutationListener(l: MutationListener) {
  listener = l;
}

// Svelte 5 runes-based store. One source of truth for the canvas.
function createDesignStore() {
  let nodes = $state<Node<CrucibleNodeData>[]>([]);
  let edges = $state<Edge[]>([]);
  let seed = $state<number>(1);

  // dragHandle scopes node-move drags to the header strip in CrucibleNode,
  // freeing the rest of the body to start a connection in Loose mode.
  const DRAG_HANDLE = '.node-drag-handle';

  function addNode(kind: NodeKind, position: { x: number; y: number }) {
    const entry = CATALOG_BY_KIND[kind];
    const node: Node<CrucibleNodeData> = {
      id: nanoid(8),
      type: 'crucible',
      dragHandle: DRAG_HANDLE,
      position,
      data: {
        kind,
        label: entry.label,
        props: { ...entry.defaults }
      }
    };
    nodes = [...nodes, node];
    listener.onAddNode?.({
      id: node.id,
      kind: entry.engineKind,
      props: { ...entry.defaults }
    });
    return node.id;
  }

  function removeNode(id: string) {
    nodes = nodes.filter((n) => n.id !== id);
    edges = edges.filter((e) => e.source !== id && e.target !== id);
  }

  function removeNodes(ids: string[]) {
    if (ids.length === 0) return;
    const drop = new Set(ids);
    nodes = nodes.filter((n) => !drop.has(n.id));
    edges = edges.filter((e) => !drop.has(e.source) && !drop.has(e.target));
  }

  function removeEdge(id: string) {
    edges = edges.filter((e) => e.id !== id);
  }

  function removeEdges(ids: string[]) {
    if (ids.length === 0) return;
    const drop = new Set(ids);
    edges = edges.filter((e) => !drop.has(e.id));
  }

  function duplicateNode(id: string) {
    const src = nodes.find((n) => n.id === id);
    if (!src) return null;
    const copy: Node<CrucibleNodeData> = {
      ...src,
      id: nanoid(8),
      dragHandle: DRAG_HANDLE,
      position: { x: src.position.x + 40, y: src.position.y + 40 },
      data: { ...src.data, props: { ...src.data.props } },
      selected: false
    };
    nodes = [...nodes, copy];
    listener.onAddNode?.({
      id: copy.id,
      kind: CATALOG_BY_KIND[copy.data.kind].engineKind,
      props: { ...copy.data.props }
    });
    return copy.id;
  }

  // Insert a whole template subgraph at `anchor` (flow coords).
  // Template node positions are relative; here we materialize them with
  // fresh ids and wire the edges by remapping template indices → new ids.
  // Returns the new node ids so the caller can fitView/select if needed.
  function applyTemplate(templateId: string, anchor: { x: number; y: number }): string[] {
    const tpl = TEMPLATE_BY_ID[templateId];
    if (!tpl) return [];

    const newIds: string[] = [];
    const newNodes: Node<CrucibleNodeData>[] = tpl.nodes.map((tn) => {
      const id = nanoid(8);
      newIds.push(id);
      const entry = CATALOG_BY_KIND[tn.kind];
      return {
        id,
        type: 'crucible',
        dragHandle: DRAG_HANDLE,
        position: { x: anchor.x + tn.dx, y: anchor.y + tn.dy },
        data: {
          kind: tn.kind,
          label: entry.label,
          props: { ...entry.defaults, ...(tn.propsOverride ?? {}) }
        }
      };
    });

    const newEdges: Edge[] = tpl.edges.map((te) => {
      const source = newIds[te.from];
      const target = newIds[te.to];
      return {
        id: `${source}->${target}-${nanoid(4)}`,
        source,
        target,
        type: 'flow'
      };
    });

    nodes = [...nodes, ...newNodes];
    edges = [...edges, ...newEdges];
    // Forward the whole subgraph to a running sim. Nodes first so the
    // engine has both endpoints by the time we wire the edges.
    if (listener.onAddNode || listener.onAddEdge) {
      for (const n of newNodes) {
        const entry = CATALOG_BY_KIND[n.data.kind];
        listener.onAddNode?.({
          id: n.id,
          kind: entry.engineKind,
          props: { ...n.data.props }
        });
      }
      for (const e of newEdges) {
        listener.onAddEdge?.(e.source, e.target);
      }
    }
    return newIds;
  }

  // Centralised edge creation so the mutation listener (and hot-running
  // sim) catches every wire — even those drawn by user gestures in
  // Canvas.svelte. Returns the new edge id, or null if the connection is
  // rejected as a duplicate or self-loop.
  function addEdge(source: string, target: string): string | null {
    if (source === target) return null;
    if (edges.some((e) => e.source === source && e.target === target)) return null;
    const id = `${source}->${target}-${nanoid(4)}`;
    edges = [
      ...edges,
      {
        id,
        source,
        target,
        type: 'flow'
      }
    ];
    listener.onAddEdge?.(source, target);
    return id;
  }

  function updateNodeProps(id: string, patch: Partial<NodeProps>) {
    nodes = nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, props: { ...n.data.props, ...patch } } } : n
    );
  }

  function toSpec(): TopologySpec {
    return {
      seed,
      nodes: nodes.map((n) => ({
        id: n.id,
        kind: CATALOG_BY_KIND[n.data.kind].engineKind,
        props: n.data.props
      })),
      edges: edges.map((e) => ({ src: e.source, dst: e.target }))
    };
  }

  return {
    get nodes() {
      return nodes;
    },
    set nodes(v) {
      nodes = v;
    },
    get edges() {
      return edges;
    },
    set edges(v) {
      edges = v;
    },
    get seed() {
      return seed;
    },
    set seed(v) {
      seed = v;
    },
    addNode,
    addEdge,
    applyTemplate,
    removeNode,
    removeNodes,
    removeEdge,
    removeEdges,
    duplicateNode,
    updateNodeProps,
    toSpec
  };
}

export const design = createDesignStore();
