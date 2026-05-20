import {
  Globe,
  Layers,
  GitBranch,
  Network,
  Cloud,
  Workflow,
  BookCopy,
  Gauge,
  Plug,
  BrainCircuit,
  Activity,
  Search,
  Boxes,
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
const COL = 320;
const ROW = 170;

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
    description: 'Client → Producer → Event Bus → many consumers in parallel.',
    icon: Workflow,
    nodes: [
      // Producer needs an upstream source so the chain actually carries
      // traffic; service nodes don't generate requests on their own.
      { kind: 'webClient', dx: 0, dy: ROW },
      { kind: 'service', dx: COL, dy: ROW },
      { kind: 'eventBus', dx: COL * 2, dy: ROW },
      { kind: 'worker', dx: COL * 3, dy: 0 },
      { kind: 'worker', dx: COL * 3, dy: ROW },
      { kind: 'worker', dx: COL * 3, dy: ROW * 2 }
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 2, to: 4 },
      { from: 2, to: 5 }
    ]
  },
  {
    id: 'read-replicas',
    label: 'Master + Read Replicas',
    description: 'Reads fan out to replicas via a cache; writes go to primary.',
    icon: BookCopy,
    nodes: [
      { kind: 'webClient', dx: 0, dy: ROW },
      { kind: 'apiGateway', dx: COL, dy: ROW },
      { kind: 'redis', dx: COL * 2, dy: ROW },
      { kind: 'loadbalancer', dx: COL * 3, dy: ROW },
      { kind: 'readReplica', dx: COL * 4, dy: 0 },
      { kind: 'readReplica', dx: COL * 4, dy: ROW },
      { kind: 'postgres', dx: COL * 4, dy: ROW * 2 }
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 3, to: 5 },
      { from: 3, to: 6 }
    ]
  },
  {
    id: 'sharded-service',
    label: 'Sharded Service',
    description: 'Gateway shards requests across independent service+DB pairs.',
    icon: Boxes,
    nodes: [
      { kind: 'webClient', dx: 0, dy: ROW },
      { kind: 'apiGateway', dx: COL, dy: ROW },
      { kind: 'loadbalancer', dx: COL * 2, dy: ROW },
      { kind: 'microservice', dx: COL * 3, dy: 0 },
      { kind: 'microservice', dx: COL * 3, dy: ROW },
      { kind: 'microservice', dx: COL * 3, dy: ROW * 2 },
      { kind: 'postgres', dx: COL * 4, dy: 0 },
      { kind: 'postgres', dx: COL * 4, dy: ROW },
      { kind: 'postgres', dx: COL * 4, dy: ROW * 2 }
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 2, to: 4 },
      { from: 2, to: 5 },
      { from: 3, to: 6 },
      { from: 4, to: 7 },
      { from: 5, to: 8 }
    ]
  },
  {
    id: 'rate-limited-api',
    label: 'Rate-Limited API',
    description: 'Edge defense stack: WAF → rate limiter → circuit breaker → service.',
    icon: Gauge,
    nodes: [
      { kind: 'mobileClient', dx: 0, dy: 0 },
      { kind: 'waf', dx: COL, dy: 0 },
      { kind: 'rateLimiter', dx: COL * 2, dy: 0 },
      { kind: 'authService', dx: COL * 3, dy: 0 },
      { kind: 'circuitBreaker', dx: COL * 4, dy: 0 },
      { kind: 'appServer', dx: COL * 5, dy: 0 },
      { kind: 'postgres', dx: COL * 6, dy: 0 }
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 }
    ]
  },
  {
    id: 'realtime-chat',
    label: 'Realtime Chat',
    description: 'WebSocket fleet fans messages out via Redis pub/sub.',
    icon: Plug,
    nodes: [
      { kind: 'mobileClient', dx: 0, dy: 0 },
      { kind: 'webClient', dx: 0, dy: ROW * 2 },
      { kind: 'loadbalancer', dx: COL, dy: ROW },
      { kind: 'websocketServer', dx: COL * 2, dy: 0 },
      { kind: 'websocketServer', dx: COL * 2, dy: ROW * 2 },
      { kind: 'redis', dx: COL * 3, dy: ROW },
      { kind: 'postgres', dx: COL * 4, dy: ROW }
    ],
    edges: [
      { from: 0, to: 2 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 2, to: 4 },
      { from: 3, to: 5 },
      { from: 4, to: 5 },
      { from: 5, to: 6 }
    ]
  },
  {
    id: 'cdc-search',
    label: 'Search Index via CDC',
    description: 'Postgres writes → Kafka → stream processor → Elasticsearch.',
    icon: Search,
    nodes: [
      { kind: 'webClient', dx: 0, dy: ROW },
      { kind: 'appServer', dx: COL, dy: ROW },
      { kind: 'postgres', dx: COL * 2, dy: 0 },
      { kind: 'kafka', dx: COL * 3, dy: 0 },
      { kind: 'streamProcessor', dx: COL * 4, dy: 0 },
      { kind: 'elasticsearch', dx: COL * 5, dy: 0 },
      { kind: 'appServer', dx: COL * 2, dy: ROW * 2 }
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 1, to: 6 },
      { from: 6, to: 5 }
    ]
  },
  {
    id: 'rag-inference',
    label: 'RAG / LLM Inference',
    description: 'Query → embed → vector search → LLM → response.',
    icon: BrainCircuit,
    nodes: [
      { kind: 'webClient', dx: 0, dy: ROW },
      { kind: 'apiGateway', dx: COL, dy: ROW },
      { kind: 'appServer', dx: COL * 2, dy: ROW },
      { kind: 'mlModelServer', dx: COL * 3, dy: 0 },
      { kind: 'vectorDB', dx: COL * 4, dy: 0 },
      { kind: 'mlModelServer', dx: COL * 3, dy: ROW * 2 },
      { kind: 'redis', dx: COL * 4, dy: ROW * 2 }
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 2, to: 5 },
      { from: 2, to: 6 }
    ]
  },
  {
    id: 'observability-pipeline',
    label: 'Observability Pipeline',
    description: 'Services → Kafka → stream processor → time-series DB + warehouse.',
    icon: Activity,
    nodes: [
      { kind: 'webClient', dx: 0, dy: ROW },
      { kind: 'appServer', dx: COL, dy: 0 },
      { kind: 'appServer', dx: COL, dy: ROW * 2 },
      { kind: 'kafka', dx: COL * 2, dy: ROW },
      { kind: 'streamProcessor', dx: COL * 3, dy: ROW },
      { kind: 'timeseriesDB', dx: COL * 4, dy: 0 },
      { kind: 'dataWarehouse', dx: COL * 4, dy: ROW * 2 }
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 4, to: 6 }
    ]
  }
];

export const TEMPLATE_BY_ID: Record<string, Template> = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t])
);
