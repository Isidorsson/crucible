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
  /** Headline shown on the palette card. One sentence. */
  description: string;
  /**
   * Longer prose for the tooltip — 2-3 sentences aimed at someone meeting
   * this component for the first time. Should answer: what it is, when to
   * use it, and one key thing to know about it.
   */
  details: string;
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
    details:
      'Drives synthetic traffic into the system at a fixed rate. Use it as a stand-in when you don’t care about the exact client mix — just "X requests per second arriving here". Dial rps in the Inspector to ramp load up or down.',
    defaults: D.source
  },
  {
    kind: 'webClient',
    engineKind: 'source',
    category: 'sources',
    label: 'Web Client',
    icon: Monitor,
    description: 'Browser users hitting the system.',
    details:
      'Models browser users hitting your stack — a steady stream of HTTP requests from real humans. Useful as the baseline "is the happy path fast?" load. Pair with a CDN or load balancer to see how the edge absorbs it.',
    defaults: D.client
  },
  {
    kind: 'mobileClient',
    engineKind: 'source',
    category: 'sources',
    label: 'Mobile Client',
    icon: Smartphone,
    description: 'Mobile app users — typically bursty.',
    details:
      'Phone-app traffic. Real apps tend to be bursty (push-notification fan-in, cold-start spikes); the simulator treats this as another source you can tune. Good for stress-testing API gateways and auth.',
    defaults: D.client
  },
  {
    kind: 'cronJob',
    engineKind: 'source',
    category: 'sources',
    label: 'Cron Job',
    icon: Clock,
    description: 'Low-rate scheduled traffic.',
    details:
      'Scheduled, low-rate traffic — backups, reports, nightly aggregations. Set rps low (1–10). Useful for showing how heavy but infrequent jobs contend with live user traffic on shared databases.',
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
    details:
      'Edge cache close to users (Cloudflare, Fastly, CloudFront). Most read requests hit the CDN and never reach origin; misses fall through. Raise hitRate to model a warm cache, lower it for cold launches or uncacheable content.',
    defaults: D.cdn
  },
  {
    kind: 'apiGateway',
    engineKind: 'service',
    category: 'edge',
    label: 'API Gateway',
    icon: ShieldCheck,
    description: 'Auth, rate limiting, routing at the edge.',
    details:
      'Front door for HTTP APIs — handles auth, rate limiting, routing. Tends to be the first thing to saturate under burst traffic. Capacity here represents how many concurrent connections it can hold open.',
    defaults: D.gateway
  },
  {
    kind: 'loadbalancer',
    engineKind: 'loadbalancer',
    category: 'edge',
    label: 'Load Balancer',
    icon: Network,
    description: 'Routes requests across healthy backends.',
    details:
      'Distributes requests across multiple backends. The strategy prop picks the rule: roundRobin spreads evenly, leastInFlight prefers the least-busy backend, random is the lazy option. Has no queue of its own — backends absorb load.',
    defaults: D.lb
  },
  {
    kind: 'reverseProxy',
    engineKind: 'service',
    category: 'edge',
    label: 'Reverse Proxy',
    icon: ArrowLeftRight,
    description: 'NGINX/Envoy-style traffic forwarder.',
    details:
      'Traffic forwarder sitting in front of services (NGINX, Envoy, HAProxy). Adds a few hundred microseconds of latency but lets you concentrate TLS termination, retries, and observability in one place. Behaves like a thin load balancer with its own queue.',
    defaults: D.proxy
  },
  {
    kind: 'waf',
    engineKind: 'service',
    category: 'edge',
    label: 'WAF',
    icon: Shield,
    description: 'Web Application Firewall — inspects and blocks.',
    details:
      'Web Application Firewall — inspects each request for attacks (SQLi, XSS, scrapers) and blocks the bad ones. Costs a few hundred microseconds of inspection per request. Put it before your gateway for defense in depth.',
    defaults: D.waf
  },
  {
    kind: 'dns',
    engineKind: 'service',
    category: 'edge',
    label: 'DNS',
    icon: Globe,
    description: 'Name resolution — fast, cached.',
    details:
      'Name resolution (Route 53, Cloudflare DNS, Bind). Almost free per request because answers cache aggressively, but a DNS outage takes everything down. Model it explicitly when you want to demonstrate that single point of failure.',
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
    details:
      'A generic stateless worker. Use this when the specific framework doesn’t matter — you just want "a thing that processes requests". Capacity = how many in parallel; queueLimit = how many can wait before drops start.',
    defaults: D.service
  },
  {
    kind: 'webServer',
    engineKind: 'service',
    category: 'compute',
    label: 'Web Server',
    icon: Server,
    description: 'Serves HTTP — usually CPU-light.',
    details:
      'HTTP-serving process (NGINX, Apache, Caddy). CPU-light because it mostly shuffles bytes — the real work usually lives further downstream in an app server. Put one in front of multiple app servers as a fan-out point.',
    defaults: D.web
  },
  {
    kind: 'appServer',
    engineKind: 'service',
    category: 'compute',
    label: 'App Server',
    icon: Cpu,
    description: 'Application logic — heavier work per request.',
    details:
      'Application logic — Django, Rails, Spring, Express. Heavier per-request CPU and memory than a web server. This is usually where you first see queueing show up under load, so it’s a good place to tune capacity and queueLimit.',
    defaults: D.app
  },
  {
    kind: 'microservice',
    engineKind: 'service',
    category: 'compute',
    label: 'Microservice',
    icon: Box,
    description: 'Bounded-context service in a fleet.',
    details:
      'A bounded-context service in a fleet of many. Same shape as a Service but smaller in scope. Useful when modeling fan-out: a request that touches five microservices is five chances for tail latency to bite.',
    defaults: D.micro
  },
  {
    kind: 'function',
    engineKind: 'service',
    category: 'compute',
    label: 'Function',
    icon: Zap,
    description: 'Lambda/serverless — cold-start latency.',
    details:
      'Serverless function (AWS Lambda, GCP Cloud Functions, Cloudflare Workers). High parallelism but cold starts add latency to the first request after an idle period. The default mean latency here bakes in a ~100 ms cold-start average.',
    defaults: D.func
  },
  {
    kind: 'worker',
    engineKind: 'service',
    category: 'compute',
    label: 'Worker',
    icon: Cog,
    description: 'Background job processor — long tasks.',
    details:
      'Background job processor that pulls from a queue. Long per-task service times (think image resize, email send, report generation). Put a queue in front of it and watch the queue fill when drainRPS is below incoming load.',
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
    details:
      'Generic in-memory key/value store sitting in front of slower storage. On a hit it returns instantly; on a miss the request falls through to the next node — usually a database. That fall-through is where badly tuned hitRate hurts.',
    defaults: D.cache
  },
  {
    kind: 'redis',
    engineKind: 'cache',
    category: 'caching',
    label: 'Redis',
    icon: Flame,
    description: 'In-memory key/value — very high hit rate.',
    details:
      'In-memory KV with rich data types (strings, sets, sorted sets, streams). The default "fast cache" — high hit rate, single-digit-ms latency. Watch capacity: when it fills, evictions kick in and hit rate collapses.',
    defaults: D.redis
  },
  {
    kind: 'memcached',
    engineKind: 'cache',
    category: 'caching',
    label: 'Memcached',
    icon: Layers,
    description: 'Distributed memory cache.',
    details:
      'Older but battle-tested distributed cache. Pure string KV — less feature-rich than Redis but extremely predictable under load. Reach for it when all you need is "fast, forgetful storage" with a tiny operational footprint.',
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
    details:
      'Generic OLTP database — use when the specific engine doesn’t matter. The default profile has long-tail latency: most queries are fast, but a slow tail shows up under contention. Low capacity per node — scale by adding replicas, not by raising the dial.',
    defaults: D.db
  },
  {
    kind: 'postgres',
    engineKind: 'database',
    category: 'data',
    label: 'Postgres',
    icon: Database,
    description: 'Relational DB — modest capacity per node.',
    details:
      'Relational SQL database. Modest capacity per node; pair it with a cache in front for read-heavy workloads. Strong consistency and rich features (JSON, full-text, extensions) make it the safe default for transactional data.',
    defaults: D.postgres
  },
  {
    kind: 'mysql',
    engineKind: 'database',
    category: 'data',
    label: 'MySQL',
    icon: Database,
    description: 'Relational DB — read-heavy workloads.',
    details:
      'Relational SQL database tuned for read-heavy workloads. Slightly higher capacity in this sim than Postgres. The choice between MySQL and Postgres is usually about ecosystem and features, not throughput.',
    defaults: D.mysql
  },
  {
    kind: 'mongo',
    engineKind: 'database',
    category: 'data',
    label: 'MongoDB',
    icon: Leaf,
    description: 'Document store.',
    details:
      'Document store — JSON-shaped records. Higher capacity per node because schemas are flexible and many queries are point reads. Good fit for catalogs, user profiles, content — anywhere the schema varies between records.',
    defaults: D.mongo
  },
  {
    kind: 'dynamodb',
    engineKind: 'database',
    category: 'data',
    label: 'DynamoDB',
    icon: HardDrive,
    description: 'Managed KV — predictable single-digit ms.',
    details:
      'AWS-managed KV/document store. Predictable single-digit-ms latency at any scale because you pay for provisioned throughput. The trade-off is query flexibility — you have to design your access patterns up front.',
    defaults: D.dynamo
  },
  {
    kind: 'cassandra',
    engineKind: 'database',
    category: 'data',
    label: 'Cassandra',
    icon: TreePine,
    description: 'Wide-column, write-optimized.',
    details:
      'Wide-column, write-optimized distributed database. Built for huge write volumes (telemetry, logs, time series). Reads can be slower than a SQL DB and consistency is tunable per query — pick CL=QUORUM unless you know better.',
    defaults: D.cassandra
  },
  {
    kind: 'elasticsearch',
    engineKind: 'database',
    category: 'data',
    label: 'Elasticsearch',
    icon: Search,
    description: 'Search index — moderate write cost.',
    details:
      'Search and analytics index. Optimized for full-text and aggregation queries against large document corpora. Writes are more expensive than a SQL DB because the inverted index has to be updated on every insert — batch them.',
    defaults: D.elastic
  },
  {
    kind: 'blobStore',
    engineKind: 'database',
    category: 'data',
    label: 'Blob Store',
    icon: Archive,
    description: 'S3/GCS-style object storage.',
    details:
      'Object storage (S3, GCS, Azure Blob). Designed for large opaque blobs — images, video, backups, logs. Cheap per byte and effectively unlimited parallel throughput; per-request latency is higher than a database, so don’t use it as one.',
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
    details:
      'Generic FIFO buffer between a producer and a consumer. Use it to absorb bursts and decouple components. If consumers can’t keep up (incoming rps > drainRPS), the queue fills until it hits max and starts dropping messages.',
    defaults: D.queue
  },
  {
    kind: 'kafka',
    engineKind: 'queue',
    category: 'messaging',
    label: 'Kafka',
    icon: GitBranch,
    description: 'Partitioned log — high throughput, durable.',
    details:
      'Partitioned, durable log. Built for high-throughput event streams (analytics, change-data-capture, telemetry). Messages are retained on disk, so consumers can replay history — a real advantage over plain in-memory queues.',
    defaults: D.kafka
  },
  {
    kind: 'rabbitmq',
    engineKind: 'queue',
    category: 'messaging',
    label: 'RabbitMQ',
    icon: Send,
    description: 'AMQP broker — flexible routing.',
    details:
      'AMQP broker with flexible routing (exchanges, bindings, topics, dead-letter queues). A better fit than Kafka when you need rich per-message routing and lower per-second throughput is acceptable.',
    defaults: D.rabbit
  },
  {
    kind: 'sqs',
    engineKind: 'queue',
    category: 'messaging',
    label: 'SQS',
    icon: Inbox,
    description: 'Managed cloud queue.',
    details:
      'AWS-managed queue. Fully hosted, scales transparently, dirt simple to operate. The trade-off is that you give up Kafka-style replay and broker-style routing — it’s a queue, not a broker.',
    defaults: D.sqs
  },
  {
    kind: 'eventBus',
    engineKind: 'queue',
    category: 'messaging',
    label: 'Event Bus',
    icon: Radio,
    description: 'Pub/sub fan-out — many consumers.',
    details:
      'Pub/sub fan-out. One producer publishes; many independent consumers each get a copy of every event. Good for broadcast-style events ("user signed up", "order placed") that several downstream systems care about.',
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
