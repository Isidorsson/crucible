/// <reference lib="webworker" />
import type { TopologySpec, FaultKind, SimSnapshot } from '$lib/types/topology';

// This file runs in a Web Worker. The main thread posts control messages;
// we run the sim loop here so the UI stays at 60fps regardless of sim load.

type InMsg =
  | { type: 'load'; spec: TopologySpec }
  | { type: 'start'; speed: number }
  | { type: 'pause' }
  | { type: 'resume'; speed: number }
  | { type: 'stop' }
  | { type: 'setSpeed'; value: number }
  | { type: 'setRPS'; nodeId: string; rps: number }
  | { type: 'injectFault'; nodeId: string; kind: FaultKind; on: boolean };

type OutMsg =
  | { type: 'ready' }
  | { type: 'snapshot'; payload: SimSnapshot }
  | { type: 'error'; payload: string };

const post = (m: OutMsg) => (self as unknown as Worker).postMessage(m);

let running = false;
let loaded = false;
let lastSnapshot = 0;

// 60Hz render cadence, but snapshots throttled to ~30Hz to keep
// postMessage cost down.
const SNAPSHOT_INTERVAL_MS = 33;
// Per-tick wall budget. Hybrid scheduler: sim clock advances event-driven,
// but we cap how much real time we burn in each tick to keep the worker
// responsive to control messages.
const TICK_BUDGET_MS = 12;

async function bootWasm(): Promise<void> {
  // wasm_exec.js exposes `Go` on globalThis. We import it via a script tag
  // injected by the main app and rely on it being present here.
  // Workers cannot use document.createElement; importScripts works for the
  // classic Go runtime but not for ES modules. We use fetch + instantiate.
  importScripts('/wasm_exec.js');
  // @ts-expect-error Go is set by wasm_exec.js
  const go = new Go();
  const resp = await fetch('/sim.wasm');
  const bytes = await resp.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, go.importObject);
  // run() returns when main() exits. Our main blocks on `select{}` so this
  // promise stays pending — start the run without awaiting.
  void go.run(instance);
  // give Go a microtask to register the `crucible` global
  await new Promise<void>((r) => setTimeout(r, 0));
}

function tickLoop() {
  if (!running) return;
  try {
    crucible.step(TICK_BUDGET_MS);
    const now = performance.now();
    if (now - lastSnapshot >= SNAPSHOT_INTERVAL_MS) {
      const raw = crucible.snapshot();
      const snap = JSON.parse(raw) as SimSnapshot;
      post({ type: 'snapshot', payload: snap });
      lastSnapshot = now;
    }
  } catch (e) {
    post({ type: 'error', payload: (e as Error).message });
    running = false;
    return;
  }
  // Use setTimeout(0) instead of rAF — workers do not have requestAnimationFrame
  // and we want to yield to incoming control messages between ticks.
  setTimeout(tickLoop, 0);
}

self.onmessage = async (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case 'load': {
        if (!loaded) {
          await bootWasm();
          loaded = true;
        }
        const res = crucible.load(JSON.stringify(msg.spec));
        if (typeof res === 'object' && 'error' in res) {
          post({ type: 'error', payload: res.error });
          return;
        }
        post({ type: 'ready' });
        return;
      }
      case 'start':
        crucible.setSpeed(msg.speed);
        running = true;
        lastSnapshot = 0;
        tickLoop();
        return;
      case 'pause':
        running = false;
        return;
      case 'resume':
        crucible.setSpeed(msg.speed);
        running = true;
        tickLoop();
        return;
      case 'stop':
        running = false;
        crucible.reset();
        return;
      case 'setSpeed':
        crucible.setSpeed(msg.value);
        return;
      case 'setRPS':
        crucible.setRPS(msg.nodeId, msg.rps);
        return;
      case 'injectFault':
        crucible.injectFault(msg.nodeId, msg.kind, msg.on);
        return;
    }
  } catch (e) {
    post({ type: 'error', payload: (e as Error).message });
  }
};
