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

// Sticky-note data. Lives on the same Svelte-Flow node array as crucible
// nodes but uses `type: 'note'` so Canvas can pick a different renderer.
// Notes have no engine counterpart — toSpec() skips them and the mutation
// listener never sees them.
export interface NoteData extends Record<string, unknown> {
  text: string;
}

export type AnyNode =
  | (Node<CrucibleNodeData> & { type: 'crucible' })
  | (Node<NoteData> & { type: 'note' });

export function isNote(n: Node): n is Node<NoteData> & { type: 'note' } {
  return n.type === 'note';
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
  // Both crucible nodes and sticky-note nodes share the same array
  // because SvelteFlow's bind:nodes wants a single source of truth.
  // Consumers narrow via `isNote(n)` or `n.type === 'crucible'` before
  // touching kind-specific fields.
  let nodes = $state<Node[]>([]);
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
    if (src.type === 'note') {
      const note = src as Node<NoteData>;
      const copy: Node<NoteData> = {
        ...note,
        id: nanoid(8),
        position: { x: src.position.x + 40, y: src.position.y + 40 },
        data: { text: note.data.text },
        selected: false
      };
      nodes = [...nodes, copy];
      return copy.id;
    }
    const cn = src as Node<CrucibleNodeData>;
    const copy: Node<CrucibleNodeData> = {
      ...cn,
      id: nanoid(8),
      dragHandle: DRAG_HANDLE,
      position: { x: src.position.x + 40, y: src.position.y + 40 },
      data: { ...cn.data, props: { ...cn.data.props } },
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
  // Canvas.svelte. Returns the new edge id, or null on a self-loop.
  //
  // Idempotency note: xyflow's `bind:edges` mutates the array itself when
  // the user completes a connection (Handle.svelte calls store.addEdge
  // before firing onconnect). Our own onConnect then calls back into this
  // function — so for user-drawn edges, the edge is already present here.
  // We still forward to the listener in that case; otherwise mid-sim
  // wiring is silently dropped and the engine never picks up new traffic.
  function addEdge(source: string, target: string): string | null {
    if (source === target) return null;
    const existing = edges.find((e) => e.source === source && e.target === target);
    // Annotation edges: if either endpoint is a sticky note the edge is a
    // visual link, not a data path. We tag it 'note-link' so the renderer
    // picks the dashed annotation style and the sim listener is skipped —
    // the engine has no concept of notes.
    const srcNode = nodes.find((n) => n.id === source);
    const tgtNode = nodes.find((n) => n.id === target);
    if (!srcNode || !tgtNode) return null;
    const isAnnotation = srcNode.type === 'note' || tgtNode.type === 'note';
    if (existing) {
      if (!isAnnotation) listener.onAddEdge?.(source, target);
      return existing.id;
    }
    const id = `${source}->${target}-${nanoid(4)}`;
    edges = [
      ...edges,
      {
        id,
        source,
        target,
        type: isAnnotation ? 'note-link' : 'flow',
        selectable: true
      }
    ];
    if (!isAnnotation) listener.onAddEdge?.(source, target);
    return id;
  }

  function updateNodeProps(id: string, patch: Partial<NodeProps>) {
    nodes = nodes.map((n) => {
      if (n.id !== id || n.type !== 'crucible') return n;
      const cn = n as Node<CrucibleNodeData>;
      return { ...cn, data: { ...cn.data, props: { ...cn.data.props, ...patch } } };
    });
  }

  // ── notes ──────────────────────────────────────────────────────────────
  function addNote(position: { x: number; y: number }, text = ''): string {
    const id = nanoid(8);
    const note: Node<NoteData> = {
      id,
      type: 'note',
      position,
      width: 200,
      height: 100,
      data: { text }
    };
    nodes = [...nodes, note];
    return id;
  }

  function updateNoteText(id: string, text: string) {
    nodes = nodes.map((n) =>
      n.id === id && n.type === 'note'
        ? { ...n, data: { ...(n.data as NoteData), text } }
        : n
    );
  }

  function toSpec(): TopologySpec {
    const engineNodes = nodes.filter((n) => n.type === 'crucible') as Node<CrucibleNodeData>[];
    // Annotation edges connect notes; the engine has no notes, so skip them
    // before forwarding the spec. Without this the worker would crash on an
    // unknown node id the moment the user links a note.
    const engineEdges = edges.filter((e) => e.type !== 'note-link');
    return {
      seed,
      nodes: engineNodes.map((n) => ({
        id: n.id,
        kind: CATALOG_BY_KIND[n.data.kind].engineKind,
        props: n.data.props
      })),
      edges: engineEdges.map((e) => ({ src: e.source, dst: e.target }))
    };
  }

  // Canvas-level serialization. Keeps the visual NodeKind + positions
  // alongside the props so a paste-back fully restores the design — the
  // engine-only TopologySpec would lose the visual variant.
  interface SerializedNode {
    id: string;
    kind: NodeKind;
    position: { x: number; y: number };
    props: NodeProps;
  }
  interface SerializedEdge {
    id: string;
    source: string;
    target: string;
  }
  interface SerializedNote {
    id: string;
    position: { x: number; y: number };
    width?: number;
    height?: number;
    text: string;
  }
  interface SerializedDesign {
    version: 1;
    seed: number;
    nodes: SerializedNode[];
    edges: SerializedEdge[];
    notes?: SerializedNote[];
  }

  function toJSON(): SerializedDesign {
    const cn = nodes.filter((n) => n.type === 'crucible') as Node<CrucibleNodeData>[];
    const nn = nodes.filter((n) => n.type === 'note') as Node<NoteData>[];
    return {
      version: 1,
      seed,
      nodes: cn.map((n) => ({
        id: n.id,
        kind: n.data.kind,
        position: { ...n.position },
        props: { ...n.data.props }
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      notes: nn.map((n) => ({
        id: n.id,
        position: { ...n.position },
        width: typeof n.width === 'number' ? n.width : undefined,
        height: typeof n.height === 'number' ? n.height : undefined,
        text: n.data.text
      }))
    };
  }

  // Replace the whole canvas from a serialized payload. Returns an error
  // message on a malformed input so the caller can surface it; the design
  // is left untouched on failure.
  function fromJSON(input: unknown): string | null {
    if (!input || typeof input !== 'object') return 'not an object';
    const d = input as Partial<SerializedDesign>;
    if (d.version !== 1) return `unsupported version ${d.version ?? '<missing>'}`;
    if (!Array.isArray(d.nodes) || !Array.isArray(d.edges)) return 'nodes/edges must be arrays';
    // Validate every node kind exists in the catalog so we don't crash on
    // render. Bad kinds get rejected wholesale rather than silently dropped.
    for (const n of d.nodes) {
      if (!n || typeof n.id !== 'string' || typeof n.kind !== 'string') return 'malformed node';
      if (!CATALOG_BY_KIND[n.kind as NodeKind]) return `unknown node kind: ${n.kind}`;
    }
    const nextNodes: Node<CrucibleNodeData>[] = d.nodes.map((n) => {
      const entry = CATALOG_BY_KIND[n.kind as NodeKind];
      return {
        id: n.id,
        type: 'crucible',
        dragHandle: DRAG_HANDLE,
        position: { ...n.position },
        data: {
          kind: n.kind as NodeKind,
          label: entry.label,
          props: { ...entry.defaults, ...n.props }
        }
      };
    });
    const nextNotes: Node<NoteData>[] = (d.notes ?? []).map((nt) => ({
      id: nt.id,
      type: 'note',
      position: { ...nt.position },
      width: nt.width,
      height: nt.height,
      data: { text: nt.text ?? '' }
    }));
    // Derive edge type from endpoints so an imported design's note links
    // restore as dashed annotations rather than data paths. The serialized
    // format doesn't carry an explicit type — endpoint identity is enough.
    const noteIds = new Set(nextNotes.map((n) => n.id));
    const nextEdges: Edge[] = d.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: noteIds.has(e.source) || noteIds.has(e.target) ? 'note-link' : 'flow'
    }));
    nodes = [...nextNodes, ...nextNotes];
    edges = nextEdges;
    if (typeof d.seed === 'number') seed = d.seed;
    return null;
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
    addNote,
    updateNoteText,
    toSpec,
    toJSON,
    fromJSON
  };
}

export const design = createDesignStore();
