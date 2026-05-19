import {
  Globe,
  Server,
  Database,
  Layers,
  Network,
  Inbox,
  type Icon as LucideIcon
} from '@lucide/svelte';
import type { NodeKind, NodeProps } from './topology';

export interface NodeCatalogEntry {
  kind: NodeKind;
  label: string;
  icon: typeof LucideIcon;
  description: string;
  defaults: NodeProps;
  accent: string; // tailwind ring color class
}

export const NODE_CATALOG: NodeCatalogEntry[] = [
  {
    kind: 'source',
    label: 'Source',
    icon: Globe,
    description: 'Generates traffic at a configurable RPS (Poisson arrivals).',
    defaults: { rps: 100 },
    accent: 'ring-accent'
  },
  {
    kind: 'loadbalancer',
    label: 'Load Balancer',
    icon: Network,
    description: 'Routes requests across healthy backends.',
    defaults: { strategy: 'roundRobin' },
    accent: 'ring-warn'
  },
  {
    kind: 'service',
    label: 'Service',
    icon: Server,
    description: 'Stateless worker with capacity, queue, and service time.',
    defaults: { capacity: 50, queueLimit: 500, meanNs: 2_000_000, stdNs: 1_000_000 },
    accent: 'ring-ok'
  },
  {
    kind: 'cache',
    label: 'Cache',
    icon: Layers,
    description: 'Fast hit path; miss forwards to downstream.',
    defaults: { hitRate: 0.8, capacity: 1000 },
    accent: 'ring-accent'
  },
  {
    kind: 'database',
    label: 'Database',
    icon: Database,
    description: 'Slow service with long-tail latency.',
    defaults: { capacity: 20, queueLimit: 200 },
    accent: 'ring-err'
  },
  {
    kind: 'queue',
    label: 'Queue',
    icon: Inbox,
    description: 'Buffers requests; drains at configured rate.',
    defaults: { drainRPS: 100, max: 10000 },
    accent: 'ring-muted'
  }
];

export const CATALOG_BY_KIND: Record<NodeKind, NodeCatalogEntry> = Object.fromEntries(
  NODE_CATALOG.map((e) => [e.kind, e])
) as Record<NodeKind, NodeCatalogEntry>;
