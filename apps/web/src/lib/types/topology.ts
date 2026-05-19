export type NodeKind =
  | 'source'
  | 'service'
  | 'loadbalancer'
  | 'cache'
  | 'database'
  | 'queue';

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
  kind: NodeKind;
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
