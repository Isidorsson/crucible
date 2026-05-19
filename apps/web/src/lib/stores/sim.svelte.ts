import type { SimSnapshot, NodeMetrics, FaultKind } from '$lib/types/topology';
import { design } from './design.svelte';

export type SimState = 'idle' | 'loading' | 'running' | 'paused';

interface WorkerMsg {
  type: 'snapshot' | 'ready' | 'error';
  payload?: SimSnapshot | string;
}

function createSimStore() {
  let state = $state<SimState>('idle');
  let speed = $state<number>(1);
  let snapshot = $state<SimSnapshot | null>(null);
  let metricsByNode = $state<Record<string, NodeMetrics>>({});
  let error = $state<string | null>(null);

  let worker: Worker | null = null;

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(new URL('../sim/sim.worker.ts', import.meta.url), {
      type: 'module'
    });
    worker.onmessage = (ev: MessageEvent<WorkerMsg>) => {
      const m = ev.data;
      if (m.type === 'snapshot' && m.payload && typeof m.payload !== 'string') {
        snapshot = m.payload;
        const map: Record<string, NodeMetrics> = {};
        for (const n of m.payload.nodes) map[n.id] = n;
        metricsByNode = map;
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
    const spec = design.toSpec();
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
