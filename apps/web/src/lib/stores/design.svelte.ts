import type { Edge, Node } from '@xyflow/svelte';
import type { NodeKind, NodeProps, TopologySpec } from '$lib/types/topology';
import { CATALOG_BY_KIND } from '$lib/types/catalog';
import { nanoid } from 'nanoid';

export interface CrucibleNodeData extends Record<string, unknown> {
  kind: NodeKind;
  label: string;
  props: NodeProps;
}

// Svelte 5 runes-based store. One source of truth for the canvas.
function createDesignStore() {
  let nodes = $state<Node<CrucibleNodeData>[]>([]);
  let edges = $state<Edge[]>([]);
  let seed = $state<number>(1);

  function addNode(kind: NodeKind, position: { x: number; y: number }) {
    const entry = CATALOG_BY_KIND[kind];
    const node: Node<CrucibleNodeData> = {
      id: nanoid(8),
      type: 'crucible',
      position,
      data: {
        kind,
        label: entry.label,
        props: { ...entry.defaults }
      }
    };
    nodes = [...nodes, node];
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
      position: { x: src.position.x + 40, y: src.position.y + 40 },
      data: { ...src.data, props: { ...src.data.props } },
      selected: false
    };
    nodes = [...nodes, copy];
    return copy.id;
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
