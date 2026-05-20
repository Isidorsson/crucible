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
  | { type: 'injectFault'; nodeId: string; kind: FaultKind; on: boolean }
  | { type: 'addNode'; node: { id: string; kind: string; props: Record<string, unknown> } }
  | { type: 'addEdge'; src: string; dst: string };

type OutMsg =
  | { type: 'ready' }
  | { type: 'snapshot'; payload: SimSnapshot }
  | { type: 'error'; payload: string };

const post = (m: OutMsg) => (self as unknown as Worker).postMessage(m);

let running = false;
let loaded = false;
let lastSnapshot = 0;
// If `start` arrives while `load` is still awaiting WASM boot, stash the
// requested speed here and fire the start sequence at the tail of the
// load case. Without this the start handler races the boot and touches
// `crucible` before the Go runtime has installed the global.
let pendingStartSpeed: number | null = null;

// 60Hz render cadence, but snapshots throttled to ~30Hz to keep
// postMessage cost down.
const SNAPSHOT_INTERVAL_MS = 33;
// Per-tick wall budget. Hybrid scheduler: sim clock advances event-driven,
// but we cap how much real time we burn in each tick to keep the worker
// responsive to control messages.
const TICK_BUDGET_MS = 12;

async function bootWasm(): Promise<void> {
  // Vite spawns this as a module Worker, which forbids importScripts().
  // Load wasm_exec.js by fetching its source and running it through
  // indirect eval — `(0, eval)(text)` evaluates in the worker's global
  // scope, so the `Go` constructor lands on globalThis just like a
  // classic <script> tag would have done.
  const execResp = await fetch('/wasm_exec.js');
  if (!execResp.ok) throw new Error(`fetch /wasm_exec.js failed: ${execResp.status}`);
  const execText = await execResp.text();
  (0, eval)(execText);

  const go = new Go();
  const resp = await fetch('/sim.wasm');
  if (!resp.ok) throw new Error(`fetch /sim.wasm failed: ${resp.status}`);
  const bytes = await resp.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, go.importObject);
  // run() returns when main() exits. Our main blocks on `select{}` so this
  // promise stays pending — start the run without awaiting. If Go panics
  // during init, surface it instead of silently swallowing.
  void go.run(instance).catch((e: unknown) => {
    post({ type: 'error', payload: `wasm runtime: ${(e as Error).message}` });
  });
  // Go's main() registers `crucible` on globalThis after the WASM module
  // hands control back. setTimeout(0) is not enough — poll until the
  // global appears so callers don't race the runtime.
  const deadline = Date.now() + 5000;
  while (typeof (self as unknown as { crucible?: unknown }).crucible === 'undefined') {
    if (Date.now() > deadline) {
      throw new Error('wasm init timed out: crucible global never appeared');
    }
    await new Promise<void>((r) => setTimeout(r, 10));
  }
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
        // jsLoad in Go returns either {ok: true} (object) on success or a
        // JSON string '{"error":"..."}' on failure (via errVal). Handle both.
        const res = crucible.load(JSON.stringify(msg.spec)) as unknown;
        if (typeof res === 'string') {
          try {
            const parsed = JSON.parse(res) as { error?: string };
            if (parsed.error) {
              post({ type: 'error', payload: parsed.error });
              return;
            }
          } catch {
            // not JSON — treat as opaque error
            post({ type: 'error', payload: res });
            return;
          }
        } else if (res && typeof res === 'object' && 'error' in (res as Record<string, unknown>)) {
          post({ type: 'error', payload: String((res as { error: unknown }).error) });
          return;
        }
        post({ type: 'ready' });
        // Drain a start that arrived during boot.
        if (pendingStartSpeed !== null) {
          crucible.setSpeed(pendingStartSpeed);
          pendingStartSpeed = null;
          running = true;
          lastSnapshot = 0;
          tickLoop();
        }
        return;
      }
      case 'start':
        if (!loaded) {
          pendingStartSpeed = msg.speed;
          return;
        }
        crucible.setSpeed(msg.speed);
        running = true;
        lastSnapshot = 0;
        tickLoop();
        return;
      // Speed changes that arrive while the WASM module is still booting used
      // to be silently dropped, so a user who clicked Play and then nudged
      // the speed mid-boot ended up with the engine running at the original
      // start-time speed while the UI chip showed their newer pick.
      // Latch the latest value into pendingStartSpeed instead — the load
      // handler drains it on ready and the engine boots at the speed the
      // user actually wanted.
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
        pendingStartSpeed = null;
        if (loaded) crucible.reset();
        return;
      case 'setSpeed':
        if (!loaded) {
          pendingStartSpeed = msg.value;
          return;
        }
        crucible.setSpeed(msg.value);
        return;
      case 'setRPS':
        if (!loaded) return;
        crucible.setRPS(msg.nodeId, msg.rps);
        return;
      case 'injectFault':
        if (!loaded) return;
        crucible.injectFault(msg.nodeId, msg.kind, msg.on);
        return;
      case 'addNode': {
        if (!loaded) return;
        const res = crucible.addNode(JSON.stringify(msg.node)) as unknown;
        if (typeof res === 'string') {
          // Engine returns an error JSON string on failure; surface it
          // so the UI can see why the new node didn't take traffic.
          try {
            const parsed = JSON.parse(res) as { error?: string };
            if (parsed.error) post({ type: 'error', payload: parsed.error });
          } catch {
            post({ type: 'error', payload: res });
          }
        }
        return;
      }
      case 'addEdge': {
        if (!loaded) return;
        const res = crucible.addEdge(msg.src, msg.dst) as unknown;
        if (typeof res === 'string') {
          try {
            const parsed = JSON.parse(res) as { error?: string };
            if (parsed.error) post({ type: 'error', payload: parsed.error });
          } catch {
            post({ type: 'error', payload: res });
          }
        }
        return;
      }
    }
  } catch (e) {
    post({ type: 'error', payload: (e as Error).message });
  }
};
