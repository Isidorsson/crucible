// Named anti-patterns engineers run into when comparing builds. Each one
// is a short essay (one bullet of cause, one of symptom, one of fix) that
// the UI can surface from the Inspector or a future "lint" panel.
//
// Anti-patterns are the negative space of the catalog: components are
// "what to use", these are "what not to do with them". Kept in a separate
// data file so the catalog stays focused on per-node info.

import type { NodeKind } from './topology';

export interface AntiPattern {
  id: string;
  /** Short label — chip-sized. */
  label: string;
  /** One-sentence summary surfaced in tooltips and lint warnings. */
  blurb: string;
  /** What goes wrong — the cause. */
  cause: string;
  /** What it looks like in metrics / the canvas — the symptom. */
  symptom: string;
  /** The standard fix or mitigation. */
  fix: string;
  /** Node kinds that commonly participate; used by lint heuristics. */
  involves: NodeKind[];
}

export const ANTI_PATTERNS: AntiPattern[] = [
  {
    id: 'n-plus-one',
    label: 'N+1 reads',
    blurb: 'One parent query spawns N child queries — death by 1000 round trips.',
    cause:
      'Loading a list of N items and then calling the database once per item to fetch a relation, instead of joining or batching.',
    symptom:
      'Database p99 looks fine per-query, but the request-path service shows long tail latency that scales with list size.',
    fix: 'Batch with IN/ANY queries, use a JOIN, or pre-aggregate in a denormalized read model.',
    involves: ['appServer', 'microservice', 'postgres', 'mysql', 'mongo']
  },
  {
    id: 'sync-rpc-chain',
    label: 'Sync RPC chain',
    blurb: 'Long synchronous chain of microservice calls — tail latency stacks.',
    cause:
      'Service A calls B which calls C which calls D, all blocking. Each hop adds its own queue and its own tail.',
    symptom:
      'p50 stays low at each individual hop, but end-to-end p99 is the sum of N tails — way worse than any one node looks.',
    fix: 'Fan out in parallel, push work behind a queue, or collapse the chain into one service that owns the path.',
    involves: ['microservice', 'service', 'apiGateway']
  },
  {
    id: 'cache-as-source-of-truth',
    label: 'Cache as source of truth',
    blurb: 'Treating the cache as durable storage — data vanishes on restart.',
    cause:
      'Writing to cache without writing through to a backing store, or relying on cache invalidation to be reliable.',
    symptom:
      'Data loss after a node restart or eviction; subtle bugs when the cache and DB drift apart.',
    fix: 'Write-through or write-behind to a real database; treat the cache as advisory.',
    involves: ['redis', 'memcached', 'cache']
  },
  {
    id: 'hot-partition',
    label: 'Hot partition',
    blurb: 'A single shard / partition takes most of the load.',
    cause:
      'Partition key has low cardinality (e.g. timestamp bucket, or "tenant_id" with one giant tenant) so all traffic lands on one shard.',
    symptom:
      'One node in the cluster runs hot — high CPU, throttling, queueing — while the rest sit idle.',
    fix: 'Add a high-cardinality dimension to the key (user_id, request_id) or write-through a smaller cache.',
    involves: ['dynamodb', 'cassandra', 'kafka', 'postgres']
  },
  {
    id: 'unbounded-queue',
    label: 'Unbounded queue',
    blurb: 'No upper limit — the queue absorbs forever until the system dies.',
    cause:
      'Producer faster than consumer, and the queue is configured without a max. Memory or disk fills silently.',
    symptom:
      'End-to-end latency climbs over hours/days; eventually OOM, broker crash, or disk-full alert.',
    fix: 'Cap the queue, alarm on depth, and reject (or shed) at the producer when it fills.',
    involves: ['queue', 'kafka', 'rabbitmq', 'sqs']
  },
  {
    id: 'shared-db',
    label: 'Shared monolith DB',
    blurb: 'Many microservices share one database — coupling without the wins.',
    cause:
      'Services were split for autonomy but still hit the same Postgres. Schema changes block every team.',
    symptom:
      'Coordination tax on every migration; one service\'s slow query degrades all others sharing the connection pool.',
    fix: 'Each service owns its data; cross-service reads go via API or CDC into a read model.',
    involves: ['microservice', 'postgres', 'mysql']
  },
  {
    id: 'dual-write',
    label: 'Dual write',
    blurb: 'Write to two systems in sequence — they will eventually disagree.',
    cause:
      'Service writes to DB and Kafka (or DB and cache) in two separate calls. If the second fails the systems drift.',
    symptom:
      'Search index missing rows, cache showing stale data, downstream sinks losing events.',
    fix: 'Single write to the DB; let CDC propagate to the secondary. Or use an outbox pattern.',
    involves: ['appServer', 'postgres', 'kafka', 'elasticsearch']
  },
  {
    id: 'retry-storm',
    label: 'Retry storm',
    blurb: 'Failures trigger aggressive retries that amplify the outage.',
    cause:
      'Caller retries on timeout with no jitter; downstream still slow; effective load doubles each round.',
    symptom:
      'Recovery takes much longer than the original incident; metrics show a multiplied request rate post-fault.',
    fix: 'Exponential backoff with jitter, request hedging caps, circuit breaker upstream.',
    involves: ['microservice', 'appServer', 'circuitBreaker']
  },
  {
    id: 'oltp-on-warehouse',
    label: 'OLTP query on warehouse',
    blurb: 'Request path hits a data warehouse — multi-second latency baked in.',
    cause:
      'Treating Snowflake / BigQuery / Redshift as an interactive store. Per-query overhead is seconds even for simple lookups.',
    symptom:
      'User-facing p99 in the seconds range; warehouse credits burning on tiny queries.',
    fix: 'Pre-aggregate to a serving store (Postgres, Redis, DynamoDB) on a schedule; query that instead.',
    involves: ['dataWarehouse', 'appServer']
  },
  {
    id: 'auth-spof',
    label: 'Auth as SPOF',
    blurb: 'Every request validates with one auth service — outage = total outage.',
    cause:
      'Token validation always reaches the auth service synchronously; no local verify, no cache.',
    symptom:
      'When auth degrades, every downstream service starts returning 401/503 in sympathy.',
    fix: 'Self-validating tokens (JWT signature verify locally), aggressive token caching, fall-open for low-risk reads.',
    involves: ['authService', 'apiGateway']
  },
  {
    id: 'no-backpressure',
    label: 'No backpressure',
    blurb: 'Upstream keeps pushing while downstream drowns.',
    cause:
      'Producer has no signal that the consumer is overwhelmed — no queue depth limit, no rate limit, no breaker.',
    symptom:
      'In-flight count explodes, GC pauses, OOM. Latency climbs faster than throughput grows.',
    fix: 'Bounded queues, reject-at-limit, rate limits at the edge, or pull-based consumers.',
    involves: ['service', 'queue', 'rateLimiter', 'circuitBreaker']
  }
];

export const ANTI_PATTERNS_BY_KIND: Record<NodeKind, AntiPattern[]> = (() => {
  const out = {} as Record<NodeKind, AntiPattern[]>;
  for (const ap of ANTI_PATTERNS) {
    for (const k of ap.involves) {
      (out[k] ??= []).push(ap);
    }
  }
  return out;
})();
