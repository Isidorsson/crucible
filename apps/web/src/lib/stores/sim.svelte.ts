import type { SimSnapshot, NodeMetrics, FaultKind, EdgeFlow } from '$lib/types/topology';
import { design } from './design.svelte';

export type SimState = 'idle' | 'loading' | 'running' | 'paused';

interface WorkerMsg {
  type: 'snapshot' | 'ready' | 'error';
  payload?: SimSnapshot | string;
}

// Key edges by `${src}->${dst}` to match the way Svelte Flow Edge IDs are
// typically constructed downstream. Keep both raw + keyed lookups.
function edgeKey(e: EdgeFlow): string {
  return `${e.src}->${e.dst}`;
}

function createSimStore() {
  let state = $state<SimState>('idle');
  let speed = $state<number>(1);
  let snapshot = $state<SimSnapshot | null>(null);
  let metricsByNode = $state<Record<string, NodeMetrics>>({});
  let edgeFlowByKey = $state<Record<string, number>>({});
  let error = $state<string | null>(null);

  let worker: Worker | null = null;
  // Wall time of the previous snapshot — used to convert per-window edge
  // counts into a true rate (rps) so we don't display "packets per ~33ms".
  let lastSnapshotWallMs = 0;
  // Exponential moving average smoothing factor for edge flow. 0.35 keeps
  // the pill responsive to real load changes (~3 ticks to converge) but
  // smooths out the on/off aliasing when source RPS is low enough that a
  // single packet straddles snapshot windows.
  const EDGE_EMA_ALPHA = 0.35;
  // Drop edges from the map once their smoothed rate decays below this
  // threshold so a long-disconnected edge stops occupying memory.
  const EDGE_PRUNE_BELOW = 0.05;

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(new URL('../sim/sim.worker.ts', import.meta.url), {
      type: 'module'
    });
    worker.onmessage = (ev: MessageEvent<WorkerMsg>) => {
      const m = ev.data;
      if (m.type === 'snapshot' && m.payload && typeof m.payload !== 'string') {
        snapshot = m.payload;
        const nodeMap: Record<string, NodeMetrics> = {};
        for (const n of m.payload.nodes) nodeMap[n.id] = n;
        metricsByNode = nodeMap;

        // Convert per-window counts → instantaneous rate, then EMA-smooth
        // against the previous edgeFlowByKey so visuals don't blink on/off
        // when traffic is sparse enough to straddle snapshot windows.
        const now = performance.now();
        const dtMs = lastSnapshotWallMs === 0 ? 33 : Math.max(1, now - lastSnapshotWallMs);
        lastSnapshotWallMs = now;
        const rateScale = 1000 / dtMs;

        const fresh: Record<string, number> = {};
        for (const e of m.payload.edges) fresh[edgeKey(e)] = e.count * rateScale;

        const next: Record<string, number> = {};
        const prev = edgeFlowByKey;
        const seen = new Set<string>();
        for (const k of Object.keys(prev)) seen.add(k);
        for (const k of Object.keys(fresh)) seen.add(k);
        for (const k of seen) {
          const p = prev[k] ?? 0;
          const f = fresh[k] ?? 0;
          const ema = EDGE_EMA_ALPHA * f + (1 - EDGE_EMA_ALPHA) * p;
          if (ema >= EDGE_PRUNE_BELOW) next[k] = ema;
        }
        edgeFlowByKey = next;
      } else if (m.type === 'error' && typeof m.payload === 'string') {
        error = m.payload;
        state = 'idle';
      } else if (m.type === 'ready') {
        state = 'running';
      }
    };
    return worker;
  }

  async function start() {
    error = null;
    state = 'loading';
    const w = ensureWorker();
    // Svelte 5 $state values are Proxies that structured clone can't
    // serialize. JSON round-trip strips the reactive layer and leaves
    // plain data postMessage can transfer to the worker.
    const spec = JSON.parse(JSON.stringify(design.toSpec()));
    w.postMessage({ type: 'load', spec });
    w.postMessage({ type: 'start', speed });
  }

  function pause() {
    worker?.postMessage({ type: 'pause' });
    state = 'paused';
  }

  function resume() {
    worker?.postMessage({ type: 'resume', speed });
    state = 'running';
  }

  function stop() {
    worker?.postMessage({ type: 'stop' });
    state = 'idle';
    snapshot = null;
    metricsByNode = {};
    edgeFlowByKey = {};
    lastSnapshotWallMs = 0;
  }

  function setSpeed(v: number) {
    speed = v;
    worker?.postMessage({ type: 'setSpeed', value: v });
  }

  function setRPS(nodeId: string, rps: number) {
    worker?.postMessage({ type: 'setRPS', nodeId, rps });
  }

  function injectFault(nodeId: string, kind: FaultKind, on: boolean) {
    worker?.postMessage({ type: 'injectFault', nodeId, kind, on });
  }

  return {
    get state() {
      return state;
    },
    get speed() {
      return speed;
    },
    get snapshot() {
      return snapshot;
    },
    get metricsByNode() {
      return metricsByNode;
    },
    get edgeFlowByKey() {
      return edgeFlowByKey;
    },
    get error() {
      return error;
    },
    start,
    pause,
    resume,
    stop,
    setSpeed,
    setRPS,
    injectFault
  };
}

export const sim = createSimStore();
