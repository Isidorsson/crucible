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

  // Sim worker only reports `faulted: bool` per node; it never tells us
  // *which* fault is active. The UI needs that to highlight the right
  // chaos button and to schedule an auto-clear. Mirror it locally — the
  // store is the only place that mutates faults, so this map stays in
  // sync with the worker by construction.
  let activeFaultByNode = $state<Record<string, FaultKind>>({});
  // Auto-clear timers keyed by node id. Cleared on stop() and whenever
  // a new fault is injected on the same node.
  const faultTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
    for (const t of faultTimers.values()) clearTimeout(t);
    faultTimers.clear();
    activeFaultByNode = {};
  }

  function setSpeed(v: number) {
    speed = v;
    worker?.postMessage({ type: 'setSpeed', value: v });
  }

  function setRPS(nodeId: string, rps: number) {
    worker?.postMessage({ type: 'setRPS', nodeId, rps });
  }

  function injectFault(nodeId: string, kind: FaultKind, on: boolean) {
    // Clear any pending auto-clear for this node — superseded by this call.
    const existing = faultTimers.get(nodeId);
    if (existing) {
      clearTimeout(existing);
      faultTimers.delete(nodeId);
    }
    worker?.postMessage({ type: 'injectFault', nodeId, kind, on });
    if (on && kind !== 0) {
      activeFaultByNode = { ...activeFaultByNode, [nodeId]: kind };
    } else {
      const next = { ...activeFaultByNode };
      delete next[nodeId];
      activeFaultByNode = next;
    }
  }

  // Inject a fault and automatically clear it after `durationMs` of wall
  // time. The clear runs through `injectFault` so the active-fault map and
  // any subsequent timers stay consistent.
  function injectFaultFor(nodeId: string, kind: FaultKind, durationMs: number) {
    injectFault(nodeId, kind, true);
    if (durationMs <= 0) return;
    const t = setTimeout(() => {
      faultTimers.delete(nodeId);
      injectFault(nodeId, 0, false);
    }, durationMs);
    faultTimers.set(nodeId, t);
  }

  // Swap to a different fault kind on the same node. If the requested
  // kind is already active, this is a no-op so a double-click doesn't
  // flicker.
  function setFault(nodeId: string, kind: FaultKind) {
    if (activeFaultByNode[nodeId] === kind) return;
    injectFault(nodeId, kind, true);
  }

  function clearFault(nodeId: string) {
    if (!activeFaultByNode[nodeId]) return;
    injectFault(nodeId, 0, false);
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
    get activeFaultByNode() {
      return activeFaultByNode;
    },
    start,
    pause,
    resume,
    stop,
    setSpeed,
    setRPS,
    injectFault,
    injectFaultFor,
    setFault,
    clearFault
  };
}

export const sim = createSimStore();
