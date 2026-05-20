// Topology linter. Pure functions over a TopologySpec — no sim metrics
// needed. Emits a flat list of warnings the UI can render as a checklist.
//
// Each rule is intentionally small and self-contained so it can be cited
// from the inspector ("this triggered rule X") and disabled per-design
// later without breaking other rules.

import type { NodeDef, NodeKind, TopologySpec } from '$lib/types/topology';
import { CATALOG_BY_KIND } from '$lib/types/catalog';

export type LintLevel = 'info' | 'warn' | 'error';

export interface LintWarning {
  /** Stable rule id — referenced from docs and per-design suppression. */
  ruleId: string;
  /** Severity. 'error' should block run, 'warn' should nag, 'info' is FYI. */
  level: LintLevel;
  /** One-line summary shown in the warning list. */
  message: string;
  /** Optional explanation shown on expand. */
  detail?: string;
  /** Node ids the warning attaches to — used to highlight on canvas. */
  nodeIds?: string[];
}

// engineKind groupings used across rules
const SOURCE_KINDS = new Set<NodeKind>(['source', 'webClient', 'mobileClient', 'cronJob']);
const CACHE_KINDS = new Set<NodeKind>(['cache', 'redis', 'memcached', 'cdn']);
const DB_KINDS = new Set<NodeKind>([
  'database',
  'postgres',
  'mysql',
  'mongo',
  'dynamodb',
  'cassandra',
  'elasticsearch',
  'readReplica',
  'vectorDB',
  'timeseriesDB',
  'dataWarehouse',
  'blobStore'
]);
const QUEUE_KINDS = new Set<NodeKind>(['queue', 'kafka', 'rabbitmq', 'sqs', 'eventBus']);

function adjacency(spec: TopologySpec) {
  const out: Record<string, string[]> = {};
  const inc: Record<string, string[]> = {};
  for (const n of spec.nodes) {
    out[n.id] = [];
    inc[n.id] = [];
  }
  for (const e of spec.edges) {
    out[e.src]?.push(e.dst);
    inc[e.dst]?.push(e.src);
  }
  return { out, inc };
}

function kindOf(n: NodeDef): NodeKind {
  // spec stores engineKind in `kind`; the visual kind isn't in the spec.
  // The lint operates on the visual catalog kinds where possible — but
  // since the runtime spec is engine-kind-only, we use catalog where the
  // id matches a known visual kind, else fall back to the engine kind.
  return (n as unknown as { visualKind?: NodeKind }).visualKind ?? (n.kind as NodeKind);
}

function isKindIn(n: NodeDef, set: Set<NodeKind>): boolean {
  return set.has(kindOf(n));
}

// Rule R001 — dangling source: traffic generated but never lands anywhere.
function ruleDanglingSource(spec: TopologySpec, out: Record<string, string[]>): LintWarning[] {
  return spec.nodes
    .filter((n) => isKindIn(n, SOURCE_KINDS) && (out[n.id]?.length ?? 0) === 0)
    .map((n) => ({
      ruleId: 'R001',
      level: 'warn' as const,
      message: `${n.id}: source has no downstream`,
      detail: 'A traffic source with no outgoing edge does nothing. Connect it to the first hop.',
      nodeIds: [n.id]
    }));
}

// R002 — orphan non-source: never receives traffic.
function ruleOrphanNonSource(spec: TopologySpec, inc: Record<string, string[]>): LintWarning[] {
  return spec.nodes
    .filter((n) => !isKindIn(n, SOURCE_KINDS) && (inc[n.id]?.length ?? 0) === 0)
    .map((n) => ({
      ruleId: 'R002',
      level: 'info' as const,
      message: `${n.id}: no incoming traffic`,
      detail:
        'This node has no upstream edge — the simulator will leave it idle. Wire something into it, or delete it.',
      nodeIds: [n.id]
    }));
}

// R003 — DB on the request path with no cache in front. Heuristic: a DB
// directly downstream of a service is worth flagging on read-heavy stacks.
function ruleDbNoCache(spec: TopologySpec, inc: Record<string, string[]>): LintWarning[] {
  const nodeById = Object.fromEntries(spec.nodes.map((n) => [n.id, n]));
  return spec.nodes
    .filter((n) => isKindIn(n, DB_KINDS))
    .filter((db) => {
      const upstreams = (inc[db.id] ?? []).map((id) => nodeById[id]).filter(Boolean);
      if (upstreams.length === 0) return false;
      // Skip if any upstream is a cache or a queue (write-buffered path).
      return !upstreams.some((u) => isKindIn(u, CACHE_KINDS) || isKindIn(u, QUEUE_KINDS));
    })
    .map((n) => ({
      ruleId: 'R003',
      level: 'info' as const,
      message: `${n.id}: DB read path has no cache`,
      detail:
        'Direct service → DB works, but a cache in front cuts load 5–10× on read-heavy paths. Worth a redis hop.',
      nodeIds: [n.id]
    }));
}

// R004 — multiple service replicas without an LB in front.
function ruleNoLoadBalancer(
  spec: TopologySpec,
  inc: Record<string, string[]>,
  out: Record<string, string[]>
): LintWarning[] {
  const warnings: LintWarning[] = [];
  const nodeById = Object.fromEntries(spec.nodes.map((n) => [n.id, n]));
  // For each source/upstream that fans out to >1 same-kind service, warn.
  for (const n of spec.nodes) {
    const dsts = (out[n.id] ?? []).map((id) => nodeById[id]).filter(Boolean);
    if (dsts.length < 2) continue;
    // Group downstream by visual kind.
    const byKind = new Map<NodeKind, NodeDef[]>();
    for (const d of dsts) {
      const k = kindOf(d);
      if (!byKind.has(k)) byKind.set(k, []);
      byKind.get(k)!.push(d);
    }
    for (const [k, group] of byKind) {
      if (group.length < 2) continue;
      // Skip if the producer is itself a LB.
      if (kindOf(n) === 'loadbalancer') continue;
      // Only complain when downstreams are stateful-ish services.
      const entry = CATALOG_BY_KIND[k];
      if (!entry || entry.engineKind !== 'service') continue;
      warnings.push({
        ruleId: 'R004',
        level: 'warn',
        message: `${n.id}: fans out to ${group.length} ${k}s without a load balancer`,
        detail:
          'Round-robin fan-out works in the sim, but real deploys want an explicit LB for health checks and policies.',
        nodeIds: [n.id, ...group.map((g) => g.id)]
      });
    }
  }
  return warnings;
}

// R005 — cache with implausibly low hit rate.
function ruleLowCacheHitRate(spec: TopologySpec): LintWarning[] {
  return spec.nodes
    .filter((n) => isKindIn(n, CACHE_KINDS))
    .filter((n) => typeof n.props.hitRate === 'number' && n.props.hitRate < 0.3)
    .map((n) => ({
      ruleId: 'R005',
      level: 'warn' as const,
      message: `${n.id}: cache hit rate is ${Math.round((n.props.hitRate ?? 0) * 100)}%`,
      detail:
        'Below ~30% the cache adds more latency than it saves on the miss path. Either pre-warm, change the key, or remove the cache.',
      nodeIds: [n.id]
    }));
}

// R006 — queue downstream of a source where producer rate > drain rate.
function ruleQueueUnderdrained(
  spec: TopologySpec,
  inc: Record<string, string[]>
): LintWarning[] {
  const warnings: LintWarning[] = [];
  const nodeById = Object.fromEntries(spec.nodes.map((n) => [n.id, n]));
  for (const q of spec.nodes) {
    if (!isKindIn(q, QUEUE_KINDS)) continue;
    const drain = q.props.drainRPS ?? 0;
    if (drain <= 0) continue;
    // Walk one hop back to sum source RPS (approximate; ignores fan-out).
    const upstream = (inc[q.id] ?? []).map((id) => nodeById[id]).filter(Boolean);
    const producerRps = upstream.reduce(
      (sum, u) => sum + (isKindIn(u, SOURCE_KINDS) ? u.props.rps ?? 0 : 0),
      0
    );
    if (producerRps > drain * 1.5) {
      warnings.push({
        ruleId: 'R006',
        level: 'warn',
        message: `${q.id}: producers ~${producerRps} rps > drain ${drain} rps`,
        detail:
          'The queue will fill until it hits max and starts dropping. Raise drainRPS or add consumer replicas.',
        nodeIds: [q.id]
      });
    }
  }
  return warnings;
}

// R007 — queue with no consumer.
function ruleQueueNoConsumer(
  spec: TopologySpec,
  out: Record<string, string[]>
): LintWarning[] {
  return spec.nodes
    .filter((n) => isKindIn(n, QUEUE_KINDS) && (out[n.id]?.length ?? 0) === 0)
    .map((n) => ({
      ruleId: 'R007',
      level: 'warn' as const,
      message: `${n.id}: queue has no consumer`,
      detail: 'Messages will accumulate until the queue hits its max. Wire a Worker downstream.',
      nodeIds: [n.id]
    }));
}

// R008 — multiple distinct microservices share the same database.
function ruleSharedMonolithDb(
  spec: TopologySpec,
  inc: Record<string, string[]>
): LintWarning[] {
  const nodeById = Object.fromEntries(spec.nodes.map((n) => [n.id, n]));
  return spec.nodes
    .filter((n) => isKindIn(n, DB_KINDS))
    .map((db) => {
      const upstreams = (inc[db.id] ?? []).map((id) => nodeById[id]).filter(Boolean);
      const microHits = upstreams.filter((u) => kindOf(u) === 'microservice');
      return { db, microHits };
    })
    .filter(({ microHits }) => microHits.length >= 2)
    .map(({ db, microHits }) => ({
      ruleId: 'R008',
      level: 'info' as const,
      message: `${db.id}: shared by ${microHits.length} microservices`,
      detail:
        'Each microservice owning the same DB is the "shared monolith DB" anti-pattern — coordination tax on every migration.',
      nodeIds: [db.id, ...microHits.map((m) => m.id)]
    }));
}

// R009 — auth service as single point of failure on the request path.
function ruleAuthSpof(spec: TopologySpec, out: Record<string, string[]>): LintWarning[] {
  // Heuristic: only one auth service in the topology AND it fans out to
  // many downstreams — i.e. everyone passes through it.
  const auths = spec.nodes.filter((n) => kindOf(n) === 'authService');
  if (auths.length !== 1) return [];
  const auth = auths[0];
  const downstreams = out[auth.id] ?? [];
  if (downstreams.length < 2) return [];
  return [
    {
      ruleId: 'R009',
      level: 'info' as const,
      message: `${auth.id}: single auth service in front of ${downstreams.length} downstreams`,
      detail:
        'When this node degrades, every request 401s. Self-validating tokens (JWT) and aggressive caching reduce the blast radius.',
      nodeIds: [auth.id]
    }
  ];
}

export function lintTopology(spec: TopologySpec): LintWarning[] {
  const { out, inc } = adjacency(spec);
  return [
    ...ruleDanglingSource(spec, out),
    ...ruleOrphanNonSource(spec, inc),
    ...ruleDbNoCache(spec, inc),
    ...ruleNoLoadBalancer(spec, inc, out),
    ...ruleLowCacheHitRate(spec),
    ...ruleQueueUnderdrained(spec, inc),
    ...ruleQueueNoConsumer(spec, out),
    ...ruleSharedMonolithDb(spec, inc),
    ...ruleAuthSpof(spec, out)
  ];
}
