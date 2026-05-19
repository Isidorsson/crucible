import {
  Globe,
  Server,
  Database,
  Layers,
  Network,
  Inbox,
  Smartphone,
  Monitor,
  Clock,
  Cloud,
  ShieldCheck,
  Shield,
  ArrowLeftRight,
  Cpu,
  Box,
  Zap,
  Cog,
  Flame,
  HardDrive,
  Leaf,
  TreePine,
  Search,
  Archive,
  GitBranch,
  Send,
  Radio,
  type Icon as LucideIcon
} from '@lucide/svelte';
import type { EngineKind, NodeCategory, NodeKind, NodeProps } from './topology';

export interface NodeCatalogEntry {
  kind: NodeKind;
  engineKind: EngineKind;
  category: NodeCategory;
  label: string;
  icon: typeof LucideIcon;
  description: string;
  defaults: NodeProps;
}

export interface CategoryMeta {
  id: NodeCategory;
  label: string;
  blurb: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'sources', label: 'Sources', blurb: 'Where traffic originates.' },
  { id: 'edge', label: 'Edge & Networking', blurb: 'CDNs, gateways, balancers.' },
  { id: 'compute', label: 'Compute', blurb: 'Services that do the work.' },
  { id: 'caching', label: 'Caching', blurb: 'Fast key/value stores.' },
  { id: 'data', label: 'Data Stores', blurb: 'Persistent state.' },
  { id: 'messaging', label: 'Messaging', blurb: 'Queues, brokers, buses.' }
];

// Defaults reuse the engine-kind's parameters. Specialized variants tune
// values to match what users expect from that real-world component (e.g.
// Postgres = lower capacity than a stateless service; Kafka = high drain).
const D = {
  source: { rps: 100 },
  client: { rps: 50 },
  cron: { rps: 1 },
  cdn: { hitRate: 0.9, capacity: 5000 },
  gateway: { capacity: 200, queueLimit: 2000, meanNs: 500_000, stdNs: 200_000 },
  lb: { strategy: 'roundRobin' as const },
  proxy: { capacity: 200, queueLimit: 1000, meanNs: 200_000, stdNs: 100_000 },
  waf: { capacity: 300, queueLimit: 1000, meanNs: 300_000, stdNs: 150_000 },
  dns: { capacity: 500, queueLimit: 500, meanNs: 100_000, stdNs: 50_000 },
  service: { capacity: 50, queueLimit: 500, meanNs: 2_000_000, stdNs: 1_000_000 },
  web: { capacity: 100, queueLimit: 1000, meanNs: 1_500_000, stdNs: 800_000 },
  app: { capacity: 75, queueLimit: 750, meanNs: 5_000_000, stdNs: 2_000_000 },
  micro: { capacity: 60, queueLimit: 500, meanNs: 3_000_000, stdNs: 1_500_000 },
  func: { capacity: 200, queueLimit: 1000, meanNs: 100_000_000, stdNs: 30_000_000 },
  worker: { capacity: 20, queueLimit: 5000, meanNs: 50_000_000, stdNs: 20_000_000 },
  cache: { hitRate: 0.8, capacity: 1000 },
  redis: { hitRate: 0.92, capacity: 5000 },
  memcached: { hitRate: 0.88, capacity: 5000 },
  db: { capacity: 20, queueLimit: 200 },
  postgres: { capacity: 25, queueLimit: 200 },
  mysql: { capacity: 30, queueLimit: 200 },
  mongo: { capacity: 40, queueLimit: 300 },
  dynamo: { capacity: 100, queueLimit: 500 },
  cassandra: { capacity: 60, queueLimit: 400 },
  elastic: { capacity: 30, queueLimit: 300 },
  blob: { capacity: 200, queueLimit: 1000 },
  queue: { drainRPS: 100, max: 10000 },
  kafka: { drainRPS: 500, max: 1_000_000 },
  rabbit: { drainRPS: 200, max: 50_000 },
  sqs: { drainRPS: 150, max: 120_000 },
  bus: { drainRPS: 1000, max: 100_000 }
} satisfies Record<string, NodeProps>;

export const NODE_CATALOG: NodeCatalogEntry[] = [
  // ── sources ──────────────────────────────────────────────────────────
  {
    kind: 'source',
    engineKind: 'source',
    category: 'sources',
    label: 'Traffic Source',
    icon: Globe,
    description: 'Generic traffic generator with configurable RPS.',
    defaults: D.source
  },
  {
    kind: 'webClient',
    engineKind: 'source',
    category: 'sources',
    label: 'Web Client',
    icon: Monitor,
    description: 'Browser users hitting the system.',
    defaults: D.client
  },
  {
    kind: 'mobileClient',
    engineKind: 'source',
    category: 'sources',
    label: 'Mobile Client',
    icon: Smartphone,
    description: 'Mobile app users — typically bursty.',
    defaults: D.client
  },
  {
    kind: 'cronJob',
    engineKind: 'source',
    category: 'sources',
    label: 'Cron Job',
    icon: Clock,
    description: 'Low-rate scheduled traffic.',
    defaults: D.cron
  },

  // ── edge ─────────────────────────────────────────────────────────────
  {
    kind: 'cdn',
    engineKind: 'cache',
    category: 'edge',
    label: 'CDN',
    icon: Cloud,
    description: 'Edge cache; high hit rate, near users.',
    defaults: D.cdn
  },
  {
    kind: 'apiGateway',
    engineKind: 'service',
    category: 'edge',
    label: 'API Gateway',
    icon: ShieldCheck,
    description: 'Auth, rate limiting, routing at the edge.',
    defaults: D.gateway
  },
  {
    kind: 'loadbalancer',
    engineKind: 'loadbalancer',
    category: 'edge',
    label: 'Load Balancer',
    icon: Network,
    description: 'Routes requests across healthy backends.',
    defaults: D.lb
  },
  {
    kind: 'reverseProxy',
    engineKind: 'service',
    category: 'edge',
    label: 'Reverse Proxy',
    icon: ArrowLeftRight,
    description: 'NGINX/Envoy-style traffic forwarder.',
    defaults: D.proxy
  },
  {
    kind: 'waf',
    engineKind: 'service',
    category: 'edge',
    label: 'WAF',
    icon: Shield,
    description: 'Web Application Firewall — inspects and blocks.',
    defaults: D.waf
  },
  {
    kind: 'dns',
    engineKind: 'service',
    category: 'edge',
    label: 'DNS',
    icon: Globe,
    description: 'Name resolution — fast, cached.',
    defaults: D.dns
  },

  // ── compute ──────────────────────────────────────────────────────────
  {
    kind: 'service',
    engineKind: 'service',
    category: 'compute',
    label: 'Service',
    icon: Server,
    description: 'Generic stateless service.',
    defaults: D.service
  },
  {
    kind: 'webServer',
    engineKind: 'service',
    category: 'compute',
    label: 'Web Server',
    icon: Server,
    description: 'Serves HTTP — usually CPU-light.',
    defaults: D.web
  },
  {
    kind: 'appServer',
    engineKind: 'service',
    category: 'compute',
    label: 'App Server',
    icon: Cpu,
    description: 'Application logic — heavier work per request.',
    defaults: D.app
  },
  {
    kind: 'microservice',
    engineKind: 'service',
    category: 'compute',
    label: 'Microservice',
    icon: Box,
    description: 'Bounded-context service in a fleet.',
    defaults: D.micro
  },
  {
    kind: 'function',
    engineKind: 'service',
    category: 'compute',
    label: 'Function',
    icon: Zap,
    description: 'Lambda/serverless — cold-start latency.',
    defaults: D.func
  },
  {
    kind: 'worker',
    engineKind: 'service',
    category: 'compute',
    label: 'Worker',
    icon: Cog,
    description: 'Background job processor — long tasks.',
    defaults: D.worker
  },

  // ── caching ──────────────────────────────────────────────────────────
  {
    kind: 'cache',
    engineKind: 'cache',
    category: 'caching',
    label: 'Cache',
    icon: Layers,
    description: 'Generic cache; miss forwards downstream.',
    defaults: D.cache
  },
  {
    kind: 'redis',
    engineKind: 'cache',
    category: 'caching',
    label: 'Redis',
    icon: Flame,
    description: 'In-memory key/value — very high hit rate.',
    defaults: D.redis
  },
  {
    kind: 'memcached',
    engineKind: 'cache',
    category: 'caching',
    label: 'Memcached',
    icon: Layers,
    description: 'Distributed memory cache.',
    defaults: D.memcached
  },

  // ── data ─────────────────────────────────────────────────────────────
  {
    kind: 'database',
    engineKind: 'database',
    category: 'data',
    label: 'Database',
    icon: Database,
    description: 'Generic OLTP store — long-tail latency.',
    defaults: D.db
  },
  {
    kind: 'postgres',
    engineKind: 'database',
    category: 'data',
    label: 'Postgres',
    icon: Database,
    description: 'Relational DB — modest capacity per node.',
    defaults: D.postgres
  },
  {
    kind: 'mysql',
    engineKind: 'database',
    category: 'data',
    label: 'MySQL',
    icon: Database,
    description: 'Relational DB — read-heavy workloads.',
    defaults: D.mysql
  },
  {
    kind: 'mongo',
    engineKind: 'database',
    category: 'data',
    label: 'MongoDB',
    icon: Leaf,
    description: 'Document store.',
    defaults: D.mongo
  },
  {
    kind: 'dynamodb',
    engineKind: 'database',
    category: 'data',
    label: 'DynamoDB',
    icon: HardDrive,
    description: 'Managed KV — predictable single-digit ms.',
    defaults: D.dynamo
  },
  {
    kind: 'cassandra',
    engineKind: 'database',
    category: 'data',
    label: 'Cassandra',
    icon: TreePine,
    description: 'Wide-column, write-optimized.',
    defaults: D.cassandra
  },
  {
    kind: 'elasticsearch',
    engineKind: 'database',
    category: 'data',
    label: 'Elasticsearch',
    icon: Search,
    description: 'Search index — moderate write cost.',
    defaults: D.elastic
  },
  {
    kind: 'blobStore',
    engineKind: 'database',
    category: 'data',
    label: 'Blob Store',
    icon: Archive,
    description: 'S3/GCS-style object storage.',
    defaults: D.blob
  },

  // ── messaging ────────────────────────────────────────────────────────
  {
    kind: 'queue',
    engineKind: 'queue',
    category: 'messaging',
    label: 'Queue',
    icon: Inbox,
    description: 'Generic FIFO buffer.',
    defaults: D.queue
  },
  {
    kind: 'kafka',
    engineKind: 'queue',
    category: 'messaging',
    label: 'Kafka',
    icon: GitBranch,
    description: 'Partitioned log — high throughput, durable.',
    defaults: D.kafka
  },
  {
    kind: 'rabbitmq',
    engineKind: 'queue',
    category: 'messaging',
    label: 'RabbitMQ',
    icon: Send,
    description: 'AMQP broker — flexible routing.',
    defaults: D.rabbit
  },
  {
    kind: 'sqs',
    engineKind: 'queue',
    category: 'messaging',
    label: 'SQS',
    icon: Inbox,
    description: 'Managed cloud queue.',
    defaults: D.sqs
  },
  {
    kind: 'eventBus',
    engineKind: 'queue',
    category: 'messaging',
    label: 'Event Bus',
    icon: Radio,
    description: 'Pub/sub fan-out — many consumers.',
    defaults: D.bus
  }
];

export const CATALOG_BY_KIND: Record<NodeKind, NodeCatalogEntry> = Object.fromEntries(
  NODE_CATALOG.map((e) => [e.kind, e])
) as Record<NodeKind, NodeCatalogEntry>;

export const CATALOG_BY_CATEGORY: Record<NodeCategory, NodeCatalogEntry[]> = (() => {
  const out: Record<NodeCategory, NodeCatalogEntry[]> = {
    sources: [],
    edge: [],
    compute: [],
    caching: [],
    data: [],
    messaging: []
  };
  for (const e of NODE_CATALOG) out[e.category].push(e);
  return out;
})();
