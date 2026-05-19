import type {
  SimSnapshot,
  NodeMetrics,
  FaultKind,
  EdgeFlow,
  NodeDef
} from '$lib/types/topology';
import { design, setMutationListener } from './design.svelte';

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

  // ── Time-series ring buffers ────────────────────────────────────────────
  // Last N samples per node/edge feed sparklines and trend arrows in the
  // UI. Fixed-size arrays so memory stays bounded for very long sessions.
  const HISTORY_LEN = 32;
  interface NodeHistory {
    rps: number[];
    p99: number[];
    inFlight: number[];
  }
  let nodeHistory = $state<Record<string, NodeHistory>>({});
  let edgeHistory = $state<Record<string, number[]>>({});

  function pushSample(arr: number[], v: number): number[] {
    // Out-of-place push so $state proxies see a fresh array each tick;
    // mutating in place wouldn't notify subscribers.
    const next = arr.length >= HISTORY_LEN ? arr.slice(1) : arr.slice();
    next.push(v);
    return next;
  }

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

        // Append a sample per node. Skip nodes that disappeared (e.g. were
        // deleted mid-run) so their history doesn't grow indefinitely.
        const nextNodeHist: Record<string, NodeHistory> = {};
        for (const n of m.payload.nodes) {
          const prev = nodeHistory[n.id] ?? { rps: [], p99: [], inFlight: [] };
          nextNodeHist[n.id] = {
            rps: pushSample(prev.rps, n.throughput),
            p99: pushSample(prev.p99, n.p99),
            inFlight: pushSample(prev.inFlight, n.inFlight)
          };
        }
        nodeHistory = nextNodeHist;

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

        // Mirror the surviving edges into the history map; pruned edges
        // drop their history too so memory stays bounded.
        const nextEdgeHist: Record<string, number[]> = {};
        for (const k of Object.keys(next)) {
          nextEdgeHist[k] = pushSample(edgeHistory[k] ?? [], next[k]);
        }
        edgeHistory = nextEdgeHist;
      } else if (m.type === 'error' && typeof m.payload === 'string') {
        error = m.payload;
        state = 'idle';
      } else if (m.type === 'ready') {
        state = 'running';
        // Drain any graph mutations the user fired during the boot window
        // so the engine ends up consistent with the on-screen design.
        flushPending();
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
    nodeHistory = {};
    edgeHistory = {};
    lastSnapshotWallMs = 0;
    pendingMutations.length = 0;
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

  // Hot-mutate the live sim. While the WASM module is booting (state ==
  // 'loading') we queue mutations and flush them on 'ready' so the user
  // can drop nodes during the ~250ms boot window without losing them.
  // Outside of loading/running/paused, mutations are dropped — the next
  // start() will pick up design.toSpec() in full anyway.
  type PendingMutation =
    | { type: 'addNode'; node: NodeDef }
    | { type: 'addEdge'; src: string; dst: string };
  const pendingMutations: PendingMutation[] = [];

  function flushPending() {
    if (pendingMutations.length === 0) return;
    for (const m of pendingMutations) {
      if (m.type === 'addNode') worker?.postMessage(m);
      else worker?.postMessage(m);
    }
    pendingMutations.length = 0;
  }

  function isLive(): boolean {
    return state === 'running' || state === 'paused';
  }

  function addNode(node: NodeDef) {
    // Strip Svelte $state proxies before crossing the worker boundary;
    // postMessage can't structured-clone the Proxy traps.
    const plain = JSON.parse(JSON.stringify(node)) as NodeDef;
    if (state === 'loading') {
      pendingMutations.push({ type: 'addNode', node: plain });
      return;
    }
    if (!isLive()) return;
    worker?.postMessage({ type: 'addNode', node: plain });
  }

  function addEdge(src: string, dst: string) {
    if (state === 'loading') {
      pendingMutations.push({ type: 'addEdge', src, dst });
      return;
    }
    if (!isLive()) return;
    worker?.postMessage({ type: 'addEdge', src, dst });
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
    get nodeHistory() {
      return nodeHistory;
    },
    get edgeHistory() {
      return edgeHistory;
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
    addNode,
    addEdge,
    injectFault,
    injectFaultFor,
    setFault,
    clearFault
  };
}

export const sim = createSimStore();

// Forward every design-side graph mutation to the engine. The sim store's
// addNode/addEdge are guarded by state, so calls before start() / after
// stop() are silently dropped — no need to gate at the call site.
setMutationListener({
  onAddNode: (node) => sim.addNode(node),
  onAddEdge: (src, dst) => sim.addEdge(src, dst)
});
