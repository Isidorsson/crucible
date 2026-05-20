// Scenarios = pre-baked drills. Each one bundles a topology, a scripted
// sequence of events (RPS bumps, fault injection, fault clear), and a
// goal sentence the user reads before starting. The simulator then plays
// the events at the listed sim-time offsets and you watch what happens.
//
// Pure data — same shape as templates plus a `script` array. A future
// commit will wire a "Run scenario" button into the ControlBar that
// loads the topology and schedules the events through the existing sim
// store, but the data file ships on its own so engineers can audit it.

import {
  Flame,
  Zap,
  Bug,
  Hourglass,
  Skull,
  Snail,
  type Icon as LucideIcon
} from '@lucide/svelte';
import type { FaultKind, NodeKind, NodeProps } from './topology';

export interface ScenarioNode {
  /** Stable id within the scenario, referenced from edges + script. */
  id: string;
  kind: NodeKind;
  dx: number;
  dy: number;
  propsOverride?: Partial<NodeProps>;
}

export interface ScenarioEdge {
  from: string;
  to: string;
}

export type ScenarioEvent =
  | { atSec: number; kind: 'setRPS'; target: string; rps: number }
  | { atSec: number; kind: 'injectFault'; target: string; fault: FaultKind; durationSec?: number }
  | { atSec: number; kind: 'clearFault'; target: string }
  | { atSec: number; kind: 'note'; text: string };

export interface Scenario {
  id: string;
  label: string;
  /** One-line description shown in the picker. */
  blurb: string;
  /** What the user is supposed to learn. */
  goal: string;
  icon: typeof LucideIcon;
  /** Suggested overall duration in simulated seconds. */
  durationSec: number;
  /** What "passing" looks like — checked manually for now. */
  passCondition: string;
  nodes: ScenarioNode[];
  edges: ScenarioEdge[];
  /** Sorted by atSec ascending. */
  script: ScenarioEvent[];
}

const COL = 320;
const ROW = 170;

export const SCENARIOS: Scenario[] = [
  {
    id: 'black-friday',
    label: 'Black Friday spike',
    blurb: 'Traffic 10× baseline for 30 seconds. Does the stack survive without dropping?',
    goal: 'See how a cached read path absorbs a flash crowd. Then turn the cache off and watch it collapse.',
    icon: Flame,
    durationSec: 60,
    passCondition: 'err rate stays below 1% throughout the spike.',
    nodes: [
      { id: 'src', kind: 'webClient', dx: 0, dy: 0 },
      { id: 'gw', kind: 'apiGateway', dx: COL, dy: 0 },
      { id: 'cache', kind: 'redis', dx: COL * 2, dy: 0 },
      { id: 'svc', kind: 'appServer', dx: COL * 3, dy: 0 },
      { id: 'db', kind: 'postgres', dx: COL * 4, dy: 0 }
    ],
    edges: [
      { from: 'src', to: 'gw' },
      { from: 'gw', to: 'cache' },
      { from: 'cache', to: 'svc' },
      { from: 'svc', to: 'db' }
    ],
    script: [
      { atSec: 0, kind: 'note', text: 'Baseline traffic at 100 rps.' },
      { atSec: 5, kind: 'setRPS', target: 'src', rps: 100 },
      { atSec: 10, kind: 'note', text: 'Spike begins — 10× load.' },
      { atSec: 10, kind: 'setRPS', target: 'src', rps: 1000 },
      { atSec: 40, kind: 'note', text: 'Spike ends, return to baseline.' },
      { atSec: 40, kind: 'setRPS', target: 'src', rps: 100 }
    ]
  },
  {
    id: 'cache-stampede',
    label: 'Cache stampede',
    blurb: 'Cache goes cold mid-flight. Watch the DB absorb the miss storm.',
    goal: 'See why "cache as source of truth" fails and why warming matters.',
    icon: Bug,
    durationSec: 60,
    passCondition: 'DB p99 stays under 200ms.',
    nodes: [
      { id: 'src', kind: 'webClient', dx: 0, dy: 0, propsOverride: { rps: 500 } },
      { id: 'cache', kind: 'redis', dx: COL, dy: 0 },
      { id: 'svc', kind: 'appServer', dx: COL * 2, dy: 0 },
      { id: 'db', kind: 'postgres', dx: COL * 3, dy: 0 }
    ],
    edges: [
      { from: 'src', to: 'cache' },
      { from: 'cache', to: 'svc' },
      { from: 'svc', to: 'db' }
    ],
    script: [
      { atSec: 0, kind: 'note', text: 'Hot cache, baseline load.' },
      { atSec: 10, kind: 'note', text: 'Cache goes cold — all reads fall through.' },
      { atSec: 10, kind: 'injectFault', target: 'cache', fault: 1, durationSec: 20 },
      { atSec: 30, kind: 'note', text: 'Cache restored. Recovery time?' }
    ]
  },
  {
    id: 'db-failover',
    label: 'Database failover',
    blurb: 'Primary DB dies. Traffic should reach the read replica without total outage.',
    goal: 'Quantify the cost of having (or not having) a replica failover.',
    icon: Skull,
    durationSec: 60,
    passCondition: 'Throughput recovers within 15s of primary kill.',
    nodes: [
      { id: 'src', kind: 'webClient', dx: 0, dy: ROW, propsOverride: { rps: 300 } },
      { id: 'gw', kind: 'apiGateway', dx: COL, dy: ROW },
      { id: 'lb', kind: 'loadbalancer', dx: COL * 2, dy: ROW },
      { id: 'primary', kind: 'postgres', dx: COL * 3, dy: 0 },
      { id: 'replica', kind: 'readReplica', dx: COL * 3, dy: ROW * 2 }
    ],
    edges: [
      { from: 'src', to: 'gw' },
      { from: 'gw', to: 'lb' },
      { from: 'lb', to: 'primary' },
      { from: 'lb', to: 'replica' }
    ],
    script: [
      { atSec: 0, kind: 'note', text: 'Both DBs healthy.' },
      { atSec: 10, kind: 'note', text: 'Primary fails.' },
      { atSec: 10, kind: 'injectFault', target: 'primary', fault: 1 },
      { atSec: 40, kind: 'note', text: 'Primary recovers.' },
      { atSec: 40, kind: 'clearFault', target: 'primary' }
    ]
  },
  {
    id: 'slow-leak',
    label: 'Slow-leak service',
    blurb: 'One service gets 10× slower. Does backpressure propagate cleanly?',
    goal: 'Spot the bottleneck and see how queues fill upstream of the slow node.',
    icon: Snail,
    durationSec: 90,
    passCondition: 'No upstream node hits its queue limit.',
    nodes: [
      { id: 'src', kind: 'webClient', dx: 0, dy: 0, propsOverride: { rps: 200 } },
      { id: 'lb', kind: 'loadbalancer', dx: COL, dy: 0 },
      { id: 'a', kind: 'microservice', dx: COL * 2, dy: 0 },
      { id: 'b', kind: 'microservice', dx: COL * 3, dy: 0 },
      { id: 'db', kind: 'postgres', dx: COL * 4, dy: 0 }
    ],
    edges: [
      { from: 'src', to: 'lb' },
      { from: 'lb', to: 'a' },
      { from: 'a', to: 'b' },
      { from: 'b', to: 'db' }
    ],
    script: [
      { atSec: 0, kind: 'note', text: 'All services healthy.' },
      { atSec: 15, kind: 'note', text: 'Service B starts running slow.' },
      { atSec: 15, kind: 'injectFault', target: 'b', fault: 2, durationSec: 60 },
      { atSec: 75, kind: 'note', text: 'B recovers — does the queue drain?' }
    ]
  },
  {
    id: 'thundering-herd',
    label: 'Thundering herd',
    blurb: 'Every client reconnects at once after a brief outage.',
    goal: 'See why jittered retries matter — and what un-jittered ones do.',
    icon: Hourglass,
    durationSec: 60,
    passCondition: 'Auth service stays under 80% of capacity during reconnect.',
    nodes: [
      { id: 'src', kind: 'mobileClient', dx: 0, dy: 0, propsOverride: { rps: 50 } },
      { id: 'gw', kind: 'apiGateway', dx: COL, dy: 0 },
      { id: 'auth', kind: 'authService', dx: COL * 2, dy: 0 },
      { id: 'svc', kind: 'appServer', dx: COL * 3, dy: 0 },
      { id: 'db', kind: 'postgres', dx: COL * 4, dy: 0 }
    ],
    edges: [
      { from: 'src', to: 'gw' },
      { from: 'gw', to: 'auth' },
      { from: 'auth', to: 'svc' },
      { from: 'svc', to: 'db' }
    ],
    script: [
      { atSec: 0, kind: 'note', text: 'Baseline.' },
      { atSec: 10, kind: 'injectFault', target: 'gw', fault: 1, durationSec: 5 },
      { atSec: 15, kind: 'note', text: 'Outage cleared — clients reconnect en masse.' },
      { atSec: 15, kind: 'setRPS', target: 'src', rps: 800 },
      { atSec: 25, kind: 'setRPS', target: 'src', rps: 50 }
    ]
  },
  {
    id: 'noisy-neighbor',
    label: 'Noisy neighbor',
    blurb: 'A cron job hammers the shared DB during peak hours.',
    goal: 'Understand how a low-priority workload can ruin the request-path SLO.',
    icon: Zap,
    durationSec: 90,
    passCondition: 'User-facing p99 stays under the SLO target for that DB.',
    nodes: [
      { id: 'users', kind: 'webClient', dx: 0, dy: 0, propsOverride: { rps: 200 } },
      { id: 'svc', kind: 'appServer', dx: COL, dy: 0 },
      { id: 'cron', kind: 'cronJob', dx: 0, dy: ROW * 2, propsOverride: { rps: 1 } },
      { id: 'worker', kind: 'worker', dx: COL, dy: ROW * 2 },
      { id: 'db', kind: 'postgres', dx: COL * 2, dy: ROW }
    ],
    edges: [
      { from: 'users', to: 'svc' },
      { from: 'svc', to: 'db' },
      { from: 'cron', to: 'worker' },
      { from: 'worker', to: 'db' }
    ],
    script: [
      { atSec: 0, kind: 'note', text: 'Quiet cron.' },
      { atSec: 15, kind: 'note', text: 'Cron spikes — heavy batch starts.' },
      { atSec: 15, kind: 'setRPS', target: 'cron', rps: 50 },
      { atSec: 60, kind: 'note', text: 'Cron quiets back down.' },
      { atSec: 60, kind: 'setRPS', target: 'cron', rps: 1 }
    ]
  }
];

export const SCENARIO_BY_ID: Record<string, Scenario> = Object.fromEntries(
  SCENARIOS.map((s) => [s.id, s])
);
