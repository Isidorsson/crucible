import {
  Globe,
  Layers,
  GitBranch,
  Network,
  Cloud,
  Workflow,
  type Icon as LucideIcon
} from '@lucide/svelte';
import type { NodeKind, NodeProps } from './topology';

// A template = a small, named subgraph the user can drop onto the canvas
// as a starting point. Positions are *relative* to the drop point; ids
// are assigned fresh at apply-time so the same template can be inserted
// many times without collision.
export interface TemplateNode {
  kind: NodeKind;
  // Relative offset from the drop anchor (in flow coords).
  dx: number;
  dy: number;
  // Optional prop overrides on top of the catalog defaults.
  propsOverride?: Partial<NodeProps>;
}

export interface TemplateEdge {
  // Indices into the template's `nodes` array.
  from: number;
  to: number;
}

export interface Template {
  id: string;
  label: string;
  description: string;
  icon: typeof LucideIcon;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}

// Grid step matches the on-canvas node footprint (~180×60) plus breathing
// room. Tuned to keep edges readable after `fitView`.
const COL = 220;
const ROW = 110;

export const TEMPLATES: Template[] = [
  {
    id: 'simple-web',
    label: 'Simple Web App',
    description: 'Client → Load Balancer → Service → Postgres.',
    icon: Globe,
    nodes: [
      { kind: 'webClient', dx: 0, dy: 0 },
      { kind: 'loadbalancer', dx: COL, dy: 0 },
      { kind: 'service', dx: COL * 2, dy: 0 },
      { kind: 'postgres', dx: COL * 3, dy: 0 }
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 }
    ]
  },
  {
    id: 'cached-read',
    label: 'Cached Read Path',
    description: 'Client → API Gateway → Redis (miss → Postgres).',
    icon: Layers,
    nodes: [
      { kind: 'webClient', dx: 0, dy: 0 },
      { kind: 'apiGateway', dx: COL, dy: 0 },
      { kind: 'redis', dx: COL * 2, dy: 0 },
      { kind: 'postgres', dx: COL * 3, dy: 0 }
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 }
    ]
  },
  {
    id: 'event-driven',
    label: 'Event-Driven Pipeline',
    description: 'Client → Service → Kafka → Worker → Postgres.',
    icon: GitBranch,
    nodes: [
      { kind: 'webClient', dx: 0, dy: 0 },
      { kind: 'service', dx: COL, dy: 0 },
      { kind: 'kafka', dx: COL * 2, dy: 0 },
      { kind: 'worker', dx: COL * 3, dy: 0 },
      { kind: 'postgres', dx: COL * 4, dy: 0 }
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 }
    ]
  },
  {
    id: 'microservices',
    label: 'Microservices Fan-Out',
    description: 'Gateway routes to two services, each with its own store.',
    icon: Network,
    nodes: [
      { kind: 'webClient', dx: 0, dy: ROW },
      { kind: 'apiGateway', dx: COL, dy: ROW },
      { kind: 'microservice', dx: COL * 2, dy: 0 },
      { kind: 'microservice', dx: COL * 2, dy: ROW * 2 },
      { kind: 'postgres', dx: COL * 3, dy: 0 },
      { kind: 'mongo', dx: COL * 3, dy: ROW * 2 }
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 4 },
      { from: 3, to: 5 }
    ]
  },
  {
    id: 'cdn-edge',
    label: 'CDN-Fronted Site',
    description: 'CDN absorbs reads; misses hit origin LB → web servers.',
    icon: Cloud,
    nodes: [
      { kind: 'webClient', dx: 0, dy: 0 },
      { kind: 'cdn', dx: COL, dy: 0 },
      { kind: 'loadbalancer', dx: COL * 2, dy: 0 },
      { kind: 'webServer', dx: COL * 3, dy: -ROW / 2 },
      { kind: 'webServer', dx: COL * 3, dy: ROW / 2 }
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 2, to: 4 }
    ]
  },
  {
    id: 'pubsub-fanout',
    label: 'Pub/Sub Fan-Out',
    description: 'Producer → Event Bus → many consumers in parallel.',
    icon: Workflow,
    nodes: [
      { kind: 'service', dx: 0, dy: ROW },
      { kind: 'eventBus', dx: COL, dy: ROW },
      { kind: 'worker', dx: COL * 2, dy: 0 },
      { kind: 'worker', dx: COL * 2, dy: ROW },
      { kind: 'worker', dx: COL * 2, dy: ROW * 2 }
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 1, to: 3 },
      { from: 1, to: 4 }
    ]
  }
];

export const TEMPLATE_BY_ID: Record<string, Template> = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t])
);
