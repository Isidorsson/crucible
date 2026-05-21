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
  Gauge,
  CircuitBoard,
  Lock,
  Plug,
  Workflow,
  Bot,
  BookCopy,
  BrainCircuit,
  Activity,
  Warehouse,
  ExternalLink,
  Repeat,
  KeyRound,
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
  /** Expand abbreviated labels (CDN, WAF, DNS, SQS, …). */
  acronym?: string;
  /** 2–3 ways this component fails in the wild. Pairs with chaos buttons. */
  failureModes?: string[];
  /** Components that commonly sit next to this one. Renders as chips. */
  pairsWith?: NodeKind[];
  /** One-line anti-pattern. The "don't use it like this" note. */
  whenNotToUse?: string;
  /** Anchors the dials — typical throughput / latency range in real systems. */
  realWorldRange?: string;
  /** How this component scales (horizontal, vertical, sharding, …). */
  scaling?: string;
  /** Rough monthly cost at the default scale, in USD. Used by cost overlay. */
  costPerMonth?: number;
  /** What a reasonable p99 latency target looks like for this node, in ms. */
  sloP99Ms?: number;
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
  rateLimiter: { capacity: 1000, queueLimit: 0, meanNs: 50_000, stdNs: 20_000 },
  circuitBreaker: { capacity: 10000, queueLimit: 0, meanNs: 20_000, stdNs: 5_000 },
  service: { capacity: 50, queueLimit: 500, meanNs: 2_000_000, stdNs: 1_000_000 },
  web: { capacity: 100, queueLimit: 1000, meanNs: 1_500_000, stdNs: 800_000 },
  app: { capacity: 75, queueLimit: 750, meanNs: 5_000_000, stdNs: 2_000_000 },
  micro: { capacity: 60, queueLimit: 500, meanNs: 3_000_000, stdNs: 1_500_000 },
  func: { capacity: 200, queueLimit: 1000, meanNs: 100_000_000, stdNs: 30_000_000 },
  worker: { capacity: 20, queueLimit: 5000, meanNs: 50_000_000, stdNs: 20_000_000 },
  authSvc: { capacity: 200, queueLimit: 1000, meanNs: 1_000_000, stdNs: 500_000 },
  idp: { capacity: 100, queueLimit: 500, meanNs: 50_000_000, stdNs: 20_000_000 },
  ws: { capacity: 5000, queueLimit: 1000, meanNs: 2_000_000, stdNs: 800_000 },
  stream: { capacity: 100, queueLimit: 10000, meanNs: 5_000_000, stdNs: 2_000_000 },
  mlSvc: { capacity: 8, queueLimit: 200, meanNs: 80_000_000, stdNs: 40_000_000 },
  workflow: { capacity: 50, queueLimit: 5000, meanNs: 50_000_000, stdNs: 30_000_000 },
  thirdParty: { capacity: 30, queueLimit: 200, meanNs: 200_000_000, stdNs: 100_000_000 },
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
  replica: { capacity: 80, queueLimit: 300 },
  vector: { capacity: 50, queueLimit: 300 },
  tsdb: { capacity: 100, queueLimit: 1000 },
  warehouse: { capacity: 5, queueLimit: 50 },
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
  {
    kind: 'rateLimiter',
    engineKind: 'service',
    category: 'edge',
    label: 'Rate Limiter',
    icon: Gauge,
    description: 'Token-bucket throttle — rejects excess fast.',
    details:
      'Throttle that caps how many requests per second a client (or IP, or tenant) can make. Above the limit, requests are rejected immediately — that fail-fast is the whole point. Sits in front of expensive services so abusive traffic never reaches them.',
    defaults: D.rateLimiter
  },
  {
    kind: 'circuitBreaker',
    engineKind: 'service',
    category: 'edge',
    label: 'Circuit Breaker',
    icon: CircuitBoard,
    description: 'Trips open on downstream failure; fails fast.',
    details:
      'Wraps a downstream call. When the failure rate crosses a threshold, the breaker "opens" and short-circuits requests — failing fast instead of waiting on timeouts. Lets the rest of the system stay healthy while a sick dependency recovers.',
    defaults: D.circuitBreaker
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
  {
    kind: 'authService',
    engineKind: 'service',
    category: 'compute',
    label: 'Auth Service',
    icon: Lock,
    description: 'Token / session validation — high fan-in.',
    details:
      'Centralized identity check (token validation, session lookup, RBAC). Almost every downstream call passes through it, which makes it a single point of failure for the whole product. Cache aggressively and design for graceful degradation.',
    defaults: D.authSvc
  },
  {
    kind: 'identityProvider',
    engineKind: 'service',
    category: 'edge',
    label: 'Identity Provider',
    icon: KeyRound,
    description: 'External IDP (Okta, Auth0, Clerk) — login & token issuance.',
    details:
      'External identity provider that owns the login flow and issues tokens (OAuth/OIDC). Unlike an internal Auth Service, you do not control its SLA — an IDP outage blocks new logins entirely. Cache validated tokens locally so existing sessions survive provider blips.',
    defaults: D.idp
  },
  {
    kind: 'websocketServer',
    engineKind: 'service',
    category: 'compute',
    label: 'WebSocket Server',
    icon: Plug,
    description: 'Long-lived connections for realtime.',
    details:
      'Holds persistent connections for realtime apps — chat, collaborative editing, live dashboards. Capacity here is "concurrent open sockets" not "rps", which is a very different scaling profile from a stateless HTTP service. Sticky sessions and graceful reconnection are the hard parts.',
    defaults: D.ws
  },
  {
    kind: 'streamProcessor',
    engineKind: 'service',
    category: 'compute',
    label: 'Stream Processor',
    icon: Workflow,
    description: 'Flink/Spark — windowed event processing.',
    details:
      'Consumes from a log (Kafka, Kinesis) and applies windowed transformations — aggregations, joins, enrichment. Lives between an event stream and a downstream sink (warehouse, search index, alerting). Slow tasks cause consumer lag, which is the metric you watch.',
    defaults: D.stream
  },
  {
    kind: 'mlModelServer',
    engineKind: 'service',
    category: 'compute',
    label: 'ML Model Server',
    icon: Bot,
    description: 'Inference endpoint — GPU-bound, slow.',
    details:
      'Serves predictions from a trained model (Triton, TorchServe, vLLM, SageMaker). GPU-bound, low effective capacity, fat tail on latency. Batch requests where possible — per-call overhead dominates throughput.',
    defaults: D.mlSvc
  },
  {
    kind: 'workflowEngine',
    engineKind: 'service',
    category: 'compute',
    label: 'Workflow Engine',
    icon: Repeat,
    description: 'Temporal / Step Functions — durable orchestration.',
    details:
      'Runs long-lived, durable workflows that survive process restarts (Temporal, AWS Step Functions, Cadence). Use for sagas, multi-step processes with compensation, and anything that takes longer than one request. Each step is checkpointed, so retries are exactly-once at the activity boundary.',
    defaults: D.workflow
  },
  {
    kind: 'thirdPartyAPI',
    engineKind: 'service',
    category: 'compute',
    label: 'Third-Party API',
    icon: ExternalLink,
    description: 'External SaaS dependency — Stripe, Twilio, SendGrid.',
    details:
      'A service you depend on but do not run (payments, SMS, email, geocoding). Latency is variable and outside your control — typical p99 is hundreds of milliseconds, occasionally much worse. Model it explicitly so the blast radius of "their" outage on "your" stack is visible. Always wrap with retry + circuit breaker.',
    defaults: D.thirdParty
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
  {
    kind: 'readReplica',
    engineKind: 'database',
    category: 'data',
    label: 'Read Replica',
    icon: BookCopy,
    description: 'Read-only DB copy — scales reads, lags writes.',
    details:
      'Asynchronous read-only copy of a primary database. Lets you fan reads out across many nodes while writes still go to the primary. Replication lag is the cost: a write returned 50ms ago may not be visible here yet — design read paths that can tolerate it.',
    defaults: D.replica
  },
  {
    kind: 'vectorDB',
    engineKind: 'database',
    category: 'data',
    label: 'Vector DB',
    icon: BrainCircuit,
    description: 'Embedding similarity search for RAG.',
    details:
      'Stores embedding vectors and answers nearest-neighbor queries (Pinecone, Weaviate, Qdrant, pgvector). The backbone of RAG and semantic-search stacks. Index build is expensive; query latency depends on index type (HNSW, IVF) and dimensionality.',
    defaults: D.vector
  },
  {
    kind: 'timeseriesDB',
    engineKind: 'database',
    category: 'data',
    label: 'Time-Series DB',
    icon: Activity,
    description: 'Write-optimized for metrics + telemetry.',
    details:
      'Append-only storage tuned for time-stamped data — metrics, IoT readings, observability. Writes are extremely cheap thanks to columnar compression and time-bucket partitioning. Range queries over recent data are fast; arbitrary cross-series joins are not.',
    defaults: D.tsdb
  },
  {
    kind: 'dataWarehouse',
    engineKind: 'database',
    category: 'data',
    label: 'Data Warehouse',
    icon: Warehouse,
    description: 'OLAP store — slow per-query, huge scans.',
    details:
      'Columnar OLAP store (Snowflake, BigQuery, Redshift, ClickHouse). Built for analytical scans across billions of rows, not user-facing reads. Per-query latency is seconds-to-minutes, but throughput on aggregation is enormous. Feed it from a stream processor, never query it from a request path.',
    defaults: D.warehouse
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

// Educational metadata layered on top of NODE_CATALOG. Kept separate so the
// shape stays auditable in one place and the headline catalog stays terse.
// Every field is optional — Inspector renders only what's present.
type ExtraMeta = Pick<
  NodeCatalogEntry,
  | 'acronym'
  | 'failureModes'
  | 'pairsWith'
  | 'whenNotToUse'
  | 'realWorldRange'
  | 'scaling'
  | 'costPerMonth'
  | 'sloP99Ms'
>;

const META: Partial<Record<NodeKind, ExtraMeta>> = {
  // ── sources ────────────────────────────────────────────────────────────
  source: {
    realWorldRange: '1–100k rps depending on test.',
    scaling: 'Synthetic generator — bump rps; no scaling story of its own.',
    failureModes: ['Drives load, does not experience failures.'],
    whenNotToUse: 'When you want a realistic client mix — use Web/Mobile Client instead.',
    pairsWith: ['cdn', 'loadbalancer', 'apiGateway']
  },
  webClient: {
    realWorldRange: 'Per-user ~0.1–2 rps; aggregate = DAU × actions/session.',
    scaling: 'Scale via traffic, not config.',
    failureModes: [
      'Flaky networks add tail latency on the client side.',
      'Browser cache can hide backend issues during testing.'
    ],
    whenNotToUse: 'For machine-to-machine load — use Traffic Source.',
    pairsWith: ['cdn', 'dns', 'loadbalancer']
  },
  mobileClient: {
    realWorldRange: 'Bursty — push fan-in can spike 10×–100× baseline in seconds.',
    scaling: 'Backend must absorb the bursts.',
    failureModes: [
      'Push-notification thundering herd after a campaign send.',
      'Cold-start spikes after app launch hit auth and feed APIs.'
    ],
    whenNotToUse: 'For steady server-to-server traffic.',
    pairsWith: ['apiGateway', 'cdn']
  },
  cronJob: {
    realWorldRange: '0.001–10 rps; scheduled nightly or hourly.',
    scaling: 'Shard the job and fan out; do not run one big task.',
    failureModes: [
      'Heavy job collides with peak user traffic on shared DB.',
      'Missed run cascades into next-day backlog.'
    ],
    whenNotToUse: 'For real-time work — use Worker + Queue.',
    pairsWith: ['worker', 'postgres', 'blobStore']
  },

  // ── edge ───────────────────────────────────────────────────────────────
  cdn: {
    acronym: 'Content Delivery Network',
    realWorldRange: 'Hit rate 80–99% static; <50% personalized content.',
    scaling: 'Horizontal by design — edge POPs scale by provider.',
    failureModes: [
      'Cache stampede on cold launch.',
      'Stale content lingers after origin update if TTL is long.',
      'Misconfigured Cache-Control leaks personalized data.'
    ],
    whenNotToUse: 'For dynamic per-user responses — wastes cache slots.',
    pairsWith: ['webServer', 'loadbalancer', 'blobStore']
  },
  apiGateway: {
    realWorldRange: '1k–100k rps per instance; new-instance cold start ~1–5s.',
    scaling: 'Horizontal; stateless when auth tokens self-validate (JWT).',
    failureModes: [
      'Connection exhaustion under burst.',
      'Rate-limiter false positives block legit users.',
      'Auth-service dependency cascades into 503s.'
    ],
    whenNotToUse: 'For internal service-to-service — overhead does not earn its keep.',
    pairsWith: ['waf', 'appServer', 'loadbalancer']
  },
  loadbalancer: {
    realWorldRange: '10k–500k rps per node (HAProxy/NGINX); cloud LBs scale further.',
    scaling: 'Anycast or DNS round-robin in front of multiple LBs.',
    failureModes: [
      'Sticky sessions pin load to one backend.',
      'Slow health checks route to dead nodes.',
      'leastInFlight can starve slow backends and amplify imbalance.'
    ],
    whenNotToUse: 'For single-backend services — skip the hop.',
    pairsWith: ['webServer', 'appServer', 'microservice']
  },
  reverseProxy: {
    realWorldRange: '10k–100k rps per NGINX/Envoy node; adds ~0.1–1ms.',
    scaling: 'Horizontal; usually paired with a load balancer.',
    failureModes: [
      'TLS handshake CPU spike under burst.',
      'Buffer exhaustion on slow clients.',
      'Config reload drops in-flight connections if not graceful.'
    ],
    whenNotToUse: 'For pure pass-through — skip it.',
    pairsWith: ['appServer', 'loadbalancer', 'waf']
  },
  waf: {
    acronym: 'Web Application Firewall',
    realWorldRange: 'Adds 0.3–2ms inspection; blocks ~1–5% of internet traffic.',
    scaling: 'Horizontal at edge; rules-engine cost grows with ruleset.',
    failureModes: [
      'False positives block legit users.',
      'Novel attack patterns bypass static rules.',
      'Rule update bumps p99 latency unexpectedly.'
    ],
    whenNotToUse: 'For internal/authenticated APIs — inspection wasted.',
    pairsWith: ['apiGateway', 'cdn']
  },
  dns: {
    acronym: 'Domain Name System',
    realWorldRange: 'TTL-cached lookups ~0ms; cold lookup 10–100ms.',
    scaling: 'Anycast resolvers; provider-managed.',
    failureModes: [
      'Resolver outage = total outage for affected zones.',
      'Long TTL slows propagation on record change.',
      'DDoS amplification target if recursion left open.'
    ],
    whenNotToUse: 'Inside a VPC for service-to-service — use service discovery.',
    pairsWith: ['cdn', 'loadbalancer']
  },

  // ── compute ────────────────────────────────────────────────────────────
  service: {
    realWorldRange: '~1k–50k rps stateless; ~100–5k rps with DB hops.',
    scaling: 'Horizontal; stateless if session kept out of memory.',
    failureModes: [
      'Slow downstream cascades into the service.',
      'Thread/connection pool exhaustion.',
      'Memory leak under sustained load.'
    ],
    whenNotToUse: 'When the specific shape matters — pick Web/App/Microservice.',
    pairsWith: ['postgres', 'redis', 'queue']
  },
  webServer: {
    realWorldRange: '10k–100k rps static; ~1k–10k as proxy to app server.',
    scaling: 'Horizontal; lightweight workers (NGINX, Caddy).',
    failureModes: [
      'File descriptor exhaustion.',
      'Slow client connections eat workers.',
      'Static content cache invalidation gaps.'
    ],
    whenNotToUse: 'For business logic — push to App Server.',
    pairsWith: ['appServer', 'cdn', 'loadbalancer']
  },
  appServer: {
    realWorldRange: '100–5k rps per instance; ~5–50ms p99 with DB calls.',
    scaling: 'Horizontal; usually behind a load balancer.',
    failureModes: [
      'DB connection pool exhaustion.',
      'GC pauses (JVM, Node) spike p99.',
      'Sync I/O blocks the worker thread/event loop.'
    ],
    whenNotToUse: 'For pure static-content serving — Web Server / CDN is cheaper.',
    pairsWith: ['postgres', 'redis', 'queue']
  },
  microservice: {
    realWorldRange: '100–10k rps per service; ~5–50ms p99 typical.',
    scaling: 'Horizontal; each service independently.',
    failureModes: [
      'Fan-out tail latency — N services = N chances for slow tail.',
      'Distributed-tracing gaps mask root causes.',
      'Network partition mid-saga leaves inconsistent state.'
    ],
    whenNotToUse: 'For small teams or simple domains — operational tax is high.',
    pairsWith: ['apiGateway', 'queue', 'postgres']
  },
  function: {
    realWorldRange: 'Cold start ~50–500ms; warm ~1–50ms. ~1k concurrent/region default.',
    scaling: 'Provider-managed; per-account concurrency limits.',
    failureModes: [
      'Cold-start latency on the first request after idle.',
      'Provider concurrency throttling at burst.',
      'Stateless reloads drop in-memory caches.'
    ],
    whenNotToUse: 'For sustained high-rps workloads — App Server is cheaper at scale.',
    pairsWith: ['apiGateway', 'dynamodb', 'sqs']
  },
  worker: {
    realWorldRange: '1–1000 tasks/sec per worker depending on task weight.',
    scaling: 'Horizontal; partition by queue/topic.',
    failureModes: [
      'Slow tasks block the worker pool.',
      'Retry storms on a persistent failure.',
      'Ungraceful shutdown loses in-flight work.'
    ],
    whenNotToUse: 'For sub-50ms request work — inline in App Server.',
    pairsWith: ['queue', 'kafka', 'postgres']
  },

  // ── caching ────────────────────────────────────────────────────────────
  cache: {
    realWorldRange: 'Hit rate 50–99%; sub-ms latency on hit.',
    scaling: 'Horizontal via sharding / consistent hashing.',
    failureModes: [
      'Cache stampede on cold key.',
      'Eviction storms when at capacity.',
      'Stale-data bugs from invalidation gaps.'
    ],
    whenNotToUse: 'For consistency-sensitive reads — go to the source DB.',
    pairsWith: ['postgres', 'mysql', 'appServer']
  },
  redis: {
    realWorldRange: '~50k–500k ops/sec per node; <1ms p99 in-network.',
    scaling: 'Cluster mode for horizontal; ~10s of GB per node.',
    failureModes: [
      'Single-thread bottleneck on a hot key.',
      'Eviction collapse when maxmemory hit.',
      'Async-replication failover can lose last writes.'
    ],
    whenNotToUse: 'For durable source-of-truth data — use a database.',
    pairsWith: ['postgres', 'appServer', 'queue']
  },
  memcached: {
    realWorldRange: '~100k–1M ops/sec per node; <1ms latency.',
    scaling: 'Horizontal via client-side consistent hashing.',
    failureModes: [
      'Losing a node evicts its shard entirely.',
      'No persistence — cold restart = empty cache.',
      'Large values fragment slabs and waste memory.'
    ],
    whenNotToUse: 'When you need data structures beyond KV — Redis.',
    pairsWith: ['appServer', 'mysql', 'postgres']
  },

  // ── data ───────────────────────────────────────────────────────────────
  database: {
    realWorldRange: '1k–50k QPS per node depending on engine + workload.',
    scaling: 'Read replicas easy; write scaling needs sharding.',
    failureModes: [
      'Connection-pool exhaustion.',
      'Replication lag under write burst.',
      'Lock contention on hot rows.'
    ],
    whenNotToUse: 'For non-transactional analytics — use a warehouse.',
    pairsWith: ['cache', 'appServer', 'worker']
  },
  postgres: {
    realWorldRange: '~5k–50k QPS/node; p99 ~5–20ms indexed; ~100–500 conns default.',
    scaling: 'Read replicas easy; write scaling via sharding (Citus/manual) — hard.',
    failureModes: [
      'Connection-pool exhaustion (use pgbouncer).',
      'Vacuum stalls on high-churn tables.',
      'Long transactions block DDL and bloat tables.',
      'Replication lag spikes under write burst.'
    ],
    whenNotToUse: 'For multi-region writes with low latency — pick a globally-distributed DB.',
    pairsWith: ['redis', 'appServer', 'worker']
  },
  mysql: {
    realWorldRange: '~5k–80k QPS/node; p99 ~5–15ms; thread-pool limits concurrency.',
    scaling: 'Read replicas; writes via Vitess or manual sharding.',
    failureModes: [
      'InnoDB lock waits on hot rows.',
      'Replica lag from row-based replication.',
      'Connection-thread limits cap concurrency.'
    ],
    whenNotToUse: 'For rich JSON/array querying — Postgres is better.',
    pairsWith: ['redis', 'appServer', 'memcached']
  },
  mongo: {
    realWorldRange: '~10k–100k ops/sec per shard; p99 ~5–20ms.',
    scaling: 'Sharded clusters; replica sets for HA.',
    failureModes: [
      'Lock contention on large documents.',
      'Unbounded array fields blow up document size.',
      'Chunk migration thrash under a hot shard key.'
    ],
    whenNotToUse: 'For multi-document transactional integrity — relational is safer.',
    pairsWith: ['appServer', 'redis']
  },
  dynamodb: {
    realWorldRange: 'Single-digit ms at any scale; ~3k read / 1k write units per partition.',
    scaling: 'Provider-managed; auto-scaling or on-demand capacity.',
    failureModes: [
      'Hot partition throttling on bad key design.',
      'Item growth past 400KB hard limit.',
      'Cost explosion from full-table scans.'
    ],
    whenNotToUse: 'For ad-hoc analytical queries — design access patterns up front.',
    pairsWith: ['function', 'apiGateway']
  },
  cassandra: {
    realWorldRange: '~10k–100k writes/sec per node; reads slower (~5k–30k).',
    scaling: 'Linear horizontal — add nodes, ring rebalances.',
    failureModes: [
      'Wide-partition collapse from bad partition keys.',
      'Read-repair storms on inconsistent replicas.',
      'Compaction backlog kills disk I/O.'
    ],
    whenNotToUse: 'For strong consistency or transactional workloads.',
    pairsWith: ['kafka', 'worker']
  },
  elasticsearch: {
    realWorldRange: '~1k–10k indexing/sec per node; reads vary by query shape.',
    scaling: 'Horizontal via shards + replicas.',
    failureModes: [
      'JVM heap pressure on large aggregations.',
      'Refresh interval too short kills write throughput.',
      'Mapping explosion on dynamic fields.'
    ],
    whenNotToUse: 'As a primary DB — eventually consistent, expensive writes.',
    pairsWith: ['kafka', 'postgres', 'worker']
  },
  blobStore: {
    realWorldRange: '~100–1k req/sec per prefix; effectively unlimited in parallel.',
    scaling: 'Provider-managed; spread keys across prefixes for parallelism.',
    failureModes: [
      'Prefix-rate throttling on hot key patterns.',
      'Eventual consistency on overwrite (some providers).',
      'Lifecycle-rule misconfig deletes live data.'
    ],
    whenNotToUse: 'As a database substitute — high per-request latency, no querying.',
    pairsWith: ['cdn', 'worker', 'function']
  },

  // ── messaging ──────────────────────────────────────────────────────────
  queue: {
    realWorldRange: '1k–100k msgs/sec; depth grows when consumer < producer.',
    scaling: 'Partition by key; one consumer per partition.',
    failureModes: [
      'Consumer slower than producer = unbounded growth.',
      'Poison message blocks the pipeline.',
      'Drop-at-max loses data silently if not alarmed.'
    ],
    whenNotToUse: 'For synchronous RPC — adds round-trip latency.',
    pairsWith: ['worker', 'appServer']
  },
  kafka: {
    realWorldRange: '100k–1M msgs/sec per broker; ms-scale producer ack.',
    scaling: 'Add brokers + partitions; consumer-group parallelism per partition.',
    failureModes: [
      'Unbalanced partitions stall one consumer.',
      'Disk fills before retention rotates.',
      'Rebalance storms freeze the consumer group.'
    ],
    whenNotToUse: 'For low-volume routing or RPC — RabbitMQ/SQS is simpler.',
    pairsWith: ['worker', 'elasticsearch', 'cassandra']
  },
  rabbitmq: {
    acronym: 'AMQP broker (Advanced Message Queuing Protocol)',
    realWorldRange: '10k–50k msgs/sec per node; ms-scale latency.',
    scaling: 'Federation/sharding; not built for Kafka-scale throughput.',
    failureModes: [
      'Memory alarm pauses producers.',
      'Mirror sync lag on cluster heal.',
      'Slow consumer holds messages unacked indefinitely.'
    ],
    whenNotToUse: 'For replay or high-throughput streams — Kafka.',
    pairsWith: ['worker', 'microservice']
  },
  sqs: {
    acronym: 'Simple Queue Service',
    realWorldRange: 'Standard: nearly unlimited; FIFO: ~3k msgs/sec/group with batching.',
    scaling: 'Provider-managed; auto-scales.',
    failureModes: [
      'Standard queues deliver out-of-order and may duplicate.',
      'Visibility-timeout too short = double processing.',
      'DLQ fills silently if not alarmed.'
    ],
    whenNotToUse: 'For ordered processing on standard — use FIFO or Kafka.',
    pairsWith: ['function', 'worker', 'eventBus']
  },
  eventBus: {
    realWorldRange: 'Fan-out throughput depends on backing broker.',
    scaling: 'Backing provider scales (SNS, EventBridge, Kafka topics).',
    failureModes: [
      'Slow consumer holds up others (broker-dependent).',
      'No replay on some backings — loss is permanent.',
      'Schema drift breaks consumers silently.'
    ],
    whenNotToUse: 'For point-to-point work — use a Queue.',
    pairsWith: ['function', 'worker', 'sqs']
  },

  // ── edge (additions) ───────────────────────────────────────────────────
  rateLimiter: {
    realWorldRange: '100k–1M decisions/sec; rejects in <1ms.',
    scaling: 'Horizontal; share state via Redis or sliding-window approximations.',
    failureModes: [
      'State store outage = either fail-open (DoS risk) or fail-closed (locks legit users out).',
      'Per-IP limits punish shared NAT / mobile carriers.',
      'Clock skew across nodes lets bursts slip through.'
    ],
    whenNotToUse: 'For internal trusted callers — wasted overhead.',
    pairsWith: ['apiGateway', 'authService', 'redis']
  },
  circuitBreaker: {
    realWorldRange: 'Sub-ms decision; trip on ~50% error rate over a sliding window.',
    scaling: 'Per-process state — no network hop needed.',
    failureModes: [
      'Threshold too tight = flapping; too loose = no protection.',
      'Half-open probe storm when many breakers retry at once.',
      'Hides root cause from upstream metrics if not surfaced.'
    ],
    whenNotToUse: 'For internal calls with no fallback — failing fast helps no one.',
    pairsWith: ['microservice', 'authService', 'database']
  },

  // ── compute (additions) ────────────────────────────────────────────────
  authService: {
    realWorldRange: '~1k–20k rps per instance; cache pushes effective rate 10×.',
    scaling: 'Horizontal + aggressive token caching at callers.',
    failureModes: [
      'Outage cascades into 401s everywhere downstream.',
      'Token-cache invalidation gaps let revoked sessions linger.',
      'JWT signing-key rotation breaks verifiers that pinned the old key.'
    ],
    whenNotToUse: 'For per-request signature checks that can be done locally (JWT verify).',
    pairsWith: ['apiGateway', 'redis', 'rateLimiter']
  },
  identityProvider: {
    acronym: 'IDP (Okta / Auth0 / Clerk / Cognito)',
    realWorldRange: 'Login ~100–500ms; token verify ~10–50ms; provider SLA ~99.9%.',
    scaling: 'Provider-managed; you pay for MAU + login throughput.',
    failureModes: [
      'Provider outage blocks all new logins immediately.',
      'JWKS endpoint slowness stalls token verification across the fleet.',
      'OAuth redirect domain change breaks every client without warning.',
      'Free-tier rate limits surprise teams at launch.'
    ],
    whenNotToUse: 'For internal service-to-service auth — mTLS or short-lived JWTs are cheaper.',
    pairsWith: ['apiGateway', 'authService', 'redis']
  },
  workflowEngine: {
    realWorldRange: '10–1000 workflows started/sec; per-workflow runtime seconds to days.',
    scaling: 'Horizontal workers per task queue; sharded history store underneath.',
    failureModes: [
      'Non-deterministic workflow code corrupts replay after a version bump.',
      'Activity timeouts tuned too tight cause infinite retries.',
      'History grows unbounded on long-running workflows — must continue-as-new.',
      'Backing DB (Cassandra/Postgres) becomes the bottleneck under load.'
    ],
    whenNotToUse: 'For sub-second request work — orchestration overhead dwarfs the task.',
    pairsWith: ['microservice', 'queue', 'thirdPartyAPI']
  },
  thirdPartyAPI: {
    realWorldRange: 'p50 50–300ms; p99 500ms–5s; SLA usually 99.9%, sometimes worse.',
    scaling: 'Outside your control — quotas, rate limits, and per-account caps apply.',
    failureModes: [
      'Provider rate-limits you under burst (429s).',
      'Region outage cascades into your request path.',
      'API deprecation window ends; old calls 410.',
      'Latency spikes mid-day with no warning or status page.'
    ],
    whenNotToUse: 'For latency-critical inline paths — push behind a queue + worker if possible.',
    pairsWith: ['circuitBreaker', 'queue', 'workflowEngine']
  },
  websocketServer: {
    realWorldRange: '10k–1M concurrent connections per node; per-msg p99 ~2–20ms.',
    scaling: 'Horizontal; sticky load balancing or pub/sub fan-out across nodes.',
    failureModes: [
      'File-descriptor exhaustion at scale.',
      'Reconnect storm after a deploy or LB flap.',
      'Broadcasting to many sockets serializes on one goroutine/thread.'
    ],
    whenNotToUse: 'For request/response semantics — HTTP is simpler.',
    pairsWith: ['loadbalancer', 'redis', 'eventBus']
  },
  streamProcessor: {
    realWorldRange: '10k–1M events/sec per worker; lag = backpressure signal.',
    scaling: 'Partition parallelism; one task per partition.',
    failureModes: [
      'Stateful operators (windows, joins) explode memory on skewed keys.',
      'Checkpoint stalls block the whole pipeline.',
      'Replay after failure re-emits side effects unless idempotent.'
    ],
    whenNotToUse: 'For sub-100ms request handling — use a service.',
    pairsWith: ['kafka', 'cassandra', 'elasticsearch', 'dataWarehouse']
  },
  mlModelServer: {
    realWorldRange: '~10–500 inferences/sec per GPU; p99 50–500ms.',
    scaling: 'Vertical (bigger GPU) or horizontal with model replicas; batching key for throughput.',
    failureModes: [
      'OOM on long inputs (LLMs).',
      'Cold-load of model weights blocks first requests for seconds.',
      'Queue fills before autoscaler reacts.'
    ],
    whenNotToUse: 'For deterministic transforms — a regular service is cheaper.',
    pairsWith: ['vectorDB', 'queue', 'apiGateway']
  },

  // ── data (additions) ───────────────────────────────────────────────────
  readReplica: {
    realWorldRange: '~5k–100k QPS/replica; replication lag typically <100ms, can spike under load.',
    scaling: 'Add replicas for read throughput; write throughput unchanged.',
    failureModes: [
      'Replication lag returns stale reads.',
      'Long write transactions block replay on replicas.',
      'Failover to a lagging replica loses last writes.'
    ],
    whenNotToUse: 'For read-your-writes consistency — go to primary or use a session-pin.',
    pairsWith: ['postgres', 'mysql', 'cache']
  },
  vectorDB: {
    realWorldRange: 'k-NN query ~5–50ms; 1k–10k QPS per node for ~768-d vectors.',
    scaling: 'Shard by id; replicate per shard for read parallelism.',
    failureModes: [
      'Recall drops as index grows without re-tuning HNSW params.',
      'Memory blowup on high-dimensional vectors.',
      'Embedding-model drift breaks similarity assumptions silently.'
    ],
    whenNotToUse: 'For exact lookups by id — a KV store is faster and simpler.',
    pairsWith: ['mlModelServer', 'appServer', 'blobStore']
  },
  timeseriesDB: {
    realWorldRange: '100k–10M writes/sec; range queries sub-second on recent data.',
    scaling: 'Time-bucket partitions + columnar compression — near-linear with hardware.',
    failureModes: [
      'High cardinality (per-user labels) explodes index size.',
      'Down-sampling job lag corrupts long-range queries.',
      'Retention misconfig keeps too much hot data, blows up storage cost.'
    ],
    whenNotToUse: 'For relational queries or transactional writes — use Postgres.',
    pairsWith: ['streamProcessor', 'kafka', 'worker']
  },
  dataWarehouse: {
    realWorldRange: 'Per-query seconds-to-minutes; scans 100M–10B rows comfortably.',
    scaling: 'Compute and storage scale independently; pay-per-query or per-warehouse-uptime.',
    failureModes: [
      'Cost explosion from unbounded SELECT *.',
      'Stale data when ETL pipeline lags.',
      'Concurrent queries queue behind a single heavy scan.'
    ],
    whenNotToUse: 'On the request path — latency is too high; pre-aggregate to a serving store.',
    pairsWith: ['streamProcessor', 'kafka', 'blobStore']
  }
};

// Cost + SLO anchors. Kept separate from META so the prose-heavy edu fields
// stay readable and the numeric anchors stay scan-able in one block.
//   costPerMonth — order-of-magnitude $/mo at default scale (AWS list price).
//   sloP99Ms     — typical p99 target for this kind on the request path;
//                  omitted for async / background components where p99 isn't
//                  the right metric.
const COST_SLO: Partial<Record<NodeKind, { costPerMonth?: number; sloP99Ms?: number }>> = {
  // sources — synthetic; cost belongs to whatever they hit
  source: { costPerMonth: 0 },
  webClient: { costPerMonth: 0 },
  mobileClient: { costPerMonth: 0 },
  cronJob: { costPerMonth: 0 },
  // edge
  cdn: { costPerMonth: 50, sloP99Ms: 100 },
  apiGateway: { costPerMonth: 40, sloP99Ms: 50 },
  loadbalancer: { costPerMonth: 20, sloP99Ms: 5 },
  reverseProxy: { costPerMonth: 30, sloP99Ms: 10 },
  waf: { costPerMonth: 50, sloP99Ms: 20 },
  dns: { costPerMonth: 5, sloP99Ms: 50 },
  rateLimiter: { costPerMonth: 20, sloP99Ms: 5 },
  circuitBreaker: { costPerMonth: 0, sloP99Ms: 1 },
  // compute
  service: { costPerMonth: 60, sloP99Ms: 100 },
  webServer: { costPerMonth: 60, sloP99Ms: 50 },
  appServer: { costPerMonth: 100, sloP99Ms: 200 },
  microservice: { costPerMonth: 80, sloP99Ms: 100 },
  function: { costPerMonth: 20, sloP99Ms: 1000 },
  worker: { costPerMonth: 80 },
  authService: { costPerMonth: 80, sloP99Ms: 50 },
  identityProvider: { costPerMonth: 200, sloP99Ms: 500 },
  websocketServer: { costPerMonth: 120, sloP99Ms: 50 },
  streamProcessor: { costPerMonth: 300 },
  mlModelServer: { costPerMonth: 1500, sloP99Ms: 1000 },
  workflowEngine: { costPerMonth: 400 },
  thirdPartyAPI: { costPerMonth: 0, sloP99Ms: 2000 },
  // caching
  cache: { costPerMonth: 80, sloP99Ms: 5 },
  redis: { costPerMonth: 80, sloP99Ms: 5 },
  memcached: { costPerMonth: 80, sloP99Ms: 5 },
  // data
  database: { costPerMonth: 200, sloP99Ms: 50 },
  postgres: { costPerMonth: 250, sloP99Ms: 50 },
  mysql: { costPerMonth: 250, sloP99Ms: 50 },
  mongo: { costPerMonth: 300, sloP99Ms: 50 },
  dynamodb: { costPerMonth: 100, sloP99Ms: 20 },
  cassandra: { costPerMonth: 500, sloP99Ms: 30 },
  elasticsearch: { costPerMonth: 400, sloP99Ms: 100 },
  blobStore: { costPerMonth: 30, sloP99Ms: 200 },
  readReplica: { costPerMonth: 200, sloP99Ms: 50 },
  vectorDB: { costPerMonth: 400, sloP99Ms: 50 },
  timeseriesDB: { costPerMonth: 250, sloP99Ms: 30 },
  dataWarehouse: { costPerMonth: 800 },
  // messaging — async; p99 lives at the consumer
  queue: { costPerMonth: 50 },
  kafka: { costPerMonth: 400 },
  rabbitmq: { costPerMonth: 80, sloP99Ms: 20 },
  sqs: { costPerMonth: 20 },
  eventBus: { costPerMonth: 30 }
};

export const CATALOG_BY_KIND: Record<NodeKind, NodeCatalogEntry> = Object.fromEntries(
  NODE_CATALOG.map((e) => [
    e.kind,
    { ...e, ...(META[e.kind] ?? {}), ...(COST_SLO[e.kind] ?? {}) }
  ])
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
