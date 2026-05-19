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
  // compute
  | 'service'
  | 'webServer'
  | 'appServer'
  | 'microservice'
  | 'function'
  | 'worker'
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

export type FaultKind = 0 | 1 | 2 | 3;
export const FaultNone: FaultKind = 0;
export const FaultKill: FaultKind = 1;
export const FaultSlow: FaultKind = 2;
export const FaultPacketLoss: FaultKind = 3;

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

export interface SimSnapshot {
  now: number;
  born: number;
  completed: number;
  failed: number;
  inFlight: number;
  nodes: NodeMetrics[];
  edges: EdgeFlow[];
}
