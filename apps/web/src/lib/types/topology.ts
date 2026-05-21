// Visual kinds shown to user. Many map to the same engine kind — the
// simulator only knows the engine kinds (source/service/loadbalancer/
// cache/database/queue). Catalog entries declare both.
export type EngineKind = 'source' | 'service' | 'loadbalancer' | 'cache' | 'database' | 'queue';

export type NodeKind =
  // sources
  | 'source'
  | 'webClient'
  | 'mobileClient'
  | 'cronJob'
  // edge / networking
  | 'cdn'
  | 'apiGateway'
  | 'loadbalancer'
  | 'reverseProxy'
  | 'waf'
  | 'dns'
  | 'rateLimiter'
  | 'circuitBreaker'
  // compute
  | 'service'
  | 'webServer'
  | 'appServer'
  | 'microservice'
  | 'function'
  | 'worker'
  | 'authService'
  | 'identityProvider'
  | 'websocketServer'
  | 'streamProcessor'
  | 'mlModelServer'
  | 'workflowEngine'
  | 'thirdPartyAPI'
  // caching
  | 'cache'
  | 'redis'
  | 'memcached'
  // data
  | 'database'
  | 'postgres'
  | 'mysql'
  | 'mongo'
  | 'dynamodb'
  | 'cassandra'
  | 'elasticsearch'
  | 'blobStore'
  | 'readReplica'
  | 'vectorDB'
  | 'timeseriesDB'
  | 'dataWarehouse'
  // messaging
  | 'queue'
  | 'kafka'
  | 'rabbitmq'
  | 'sqs'
  | 'eventBus';

export type NodeCategory =
  | 'sources'
  | 'edge'
  | 'compute'
  | 'caching'
  | 'data'
  | 'messaging';

export type LBStrategy = 'roundRobin' | 'leastInFlight' | 'random';

// Per-node fault kinds (0..3) and the special-cased edge partition value
// (100) defined in engine/sim.go. Kept as a plain number union so JSON
// from the worker round-trips without a runtime narrow.
export type FaultKind = 0 | 1 | 2 | 3 | 100;
export const FaultNone: FaultKind = 0;
export const FaultKill: FaultKind = 1;
export const FaultSlow: FaultKind = 2;
export const FaultPacketLoss: FaultKind = 3;
export const FaultPartition: FaultKind = 100;

export interface NodeProps {
  rps?: number;
  capacity?: number;
  queueLimit?: number;
  meanNs?: number;
  stdNs?: number;
  strategy?: LBStrategy;
  hitRate?: number;
  drainRPS?: number;
  max?: number;
}

export interface NodeDef {
  id: string;
  kind: EngineKind;
  props: NodeProps;
}

export interface EdgeDef {
  src: string;
  dst: string;
}

export interface TopologySpec {
  seed: number;
  nodes: NodeDef[];
  edges: EdgeDef[];
}

export interface NodeMetrics {
  id: string;
  inFlight: number;
  queueDepth: number;
  throughput: number;
  p50: number;
  p99: number;
  errorRate: number;
  faulted: boolean;
}

export interface EdgeFlow {
  src: string;
  dst: string;
  count: number;
}

export interface PartitionPair {
  src: string;
  dst: string;
}

// One chaos toggle entry. `target` is a node id when `kind` is a per-node
// fault, and the `"src->dst"` form when `kind === FaultPartition`. Matches
// the JSON shape produced by engine.FaultEvent.
export interface FaultEvent {
  t: number;
  target: string;
  kind: FaultKind;
  on: boolean;
}

export interface SimSnapshot {
  now: number;
  born: number;
  completed: number;
  failed: number;
  inFlight: number;
  nodes: NodeMetrics[];
  edges: EdgeFlow[];
  partitions: PartitionPair[];
  faultLog: FaultEvent[];
}
