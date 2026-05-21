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
  Inbox,
  Webhook,
  Film,
  MessageCircle,
  ShoppingCart,
  Globe2,
  Car,
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
    id: 'outbox-pattern',
    label: 'Outbox Pattern',
    description: 'Write DB + outbox in one txn → CDC → Kafka → consumers. Kills dual-write.',
    icon: Inbox,
    nodes: [
      { kind: 'webClient', dx: 0, dy: ROW },
      { kind: 'appServer', dx: COL, dy: ROW },
      { kind: 'postgres', dx: COL * 2, dy: ROW },
      { kind: 'streamProcessor', dx: COL * 3, dy: ROW },
      { kind: 'kafka', dx: COL * 4, dy: ROW },
      { kind: 'worker', dx: COL * 5, dy: 0 },
      { kind: 'worker', dx: COL * 5, dy: ROW * 2 },
      { kind: 'elasticsearch', dx: COL * 6, dy: 0 },
      { kind: 'thirdPartyAPI', dx: COL * 6, dy: ROW * 2 }
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 4, to: 6 },
      { from: 5, to: 7 },
      { from: 6, to: 8 }
    ]
  },
  {
    id: 'webhook-delivery',
    label: 'Webhook Delivery + DLQ',
    description: 'Queue → worker → third-party API; failures land in dead-letter queue.',
    icon: Webhook,
    nodes: [
      { kind: 'webClient', dx: 0, dy: ROW },
      { kind: 'appServer', dx: COL, dy: ROW },
      { kind: 'queue', dx: COL * 2, dy: ROW },
      { kind: 'worker', dx: COL * 3, dy: ROW },
      { kind: 'circuitBreaker', dx: COL * 4, dy: 0 },
      { kind: 'thirdPartyAPI', dx: COL * 5, dy: 0 },
      { kind: 'sqs', dx: COL * 4, dy: ROW * 2, propsOverride: { drainRPS: 5, max: 50_000 } }
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 3, to: 6 }
    ]
  },
  {
    id: 'video-streaming',
    label: 'Video Streaming Platform',
    description:
      'Netflix-style: CDN-fronted playback, catalog, recs, IDP auth, and analytics fan-out to a warehouse.',
    icon: Film,
    nodes: [
      // viewers
      { kind: 'webClient', dx: 0, dy: 0, propsOverride: { rps: 200 } },
      { kind: 'mobileClient', dx: 0, dy: ROW * 2, propsOverride: { rps: 400 } },
      // edge
      { kind: 'cdn', dx: COL, dy: ROW, propsOverride: { hitRate: 0.95, capacity: 20000 } },
      { kind: 'loadbalancer', dx: COL * 2, dy: ROW },
      { kind: 'apiGateway', dx: COL * 3, dy: ROW, propsOverride: { capacity: 800 } },
      { kind: 'identityProvider', dx: COL * 4, dy: -ROW },
      // services
      { kind: 'microservice', dx: COL * 4, dy: 0 }, // catalog
      { kind: 'microservice', dx: COL * 4, dy: ROW }, // playback
      { kind: 'microservice', dx: COL * 4, dy: ROW * 2 }, // recommendations
      // data
      { kind: 'mongo', dx: COL * 5, dy: 0 },
      { kind: 'redis', dx: COL * 5, dy: ROW },
      { kind: 'blobStore', dx: COL * 6, dy: ROW, propsOverride: { capacity: 1000 } },
      { kind: 'vectorDB', dx: COL * 5, dy: ROW * 2 },
      // analytics tributary
      { kind: 'kafka', dx: COL * 5, dy: ROW * 3, propsOverride: { drainRPS: 2000 } },
      { kind: 'streamProcessor', dx: COL * 6, dy: ROW * 3 },
      { kind: 'dataWarehouse', dx: COL * 7, dy: ROW * 3 }
    ],
    edges: [
      { from: 0, to: 2 }, // web → cdn
      { from: 1, to: 2 }, // mobile → cdn
      { from: 2, to: 3 }, // cdn → lb
      { from: 3, to: 4 }, // lb → gw
      { from: 4, to: 5 }, // gw → idp
      { from: 4, to: 6 }, // gw → catalog
      { from: 4, to: 7 }, // gw → playback
      { from: 4, to: 8 }, // gw → recs
      { from: 6, to: 9 }, // catalog → mongo
      { from: 7, to: 10 }, // playback → redis
      { from: 7, to: 11 }, // playback → blob (manifest/chunk)
      { from: 8, to: 12 }, // recs → vector
      { from: 7, to: 13 }, // playback events → kafka
      { from: 6, to: 13 }, // catalog events → kafka
      { from: 13, to: 14 }, // kafka → stream
      { from: 14, to: 15 } // stream → warehouse
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
