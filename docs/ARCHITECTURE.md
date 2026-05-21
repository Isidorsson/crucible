# Architecture

Deep dive on the simulator internals, contracts, and design choices. For the project pitch see [README](../README.md).

---

## Hybrid scheduler

Two clocks:

- **Sim clock** — event-driven. Jumps to next event time via a min-heap (`sim/engine/heap.go`). No idle ticks.
- **Render clock** — fixed cadence in the Worker. Snapshots metrics every ~33ms, posts to the main thread.

`Sim.Step(budgetSimNs, maxEvents)` advances events until the sim clock exceeds `now + budgetSimNs`, or `maxEvents` are processed — whichever first. Worker passes a **wall-time budget** (12ms) per tick; the Go side multiplies by `speed` to get the sim budget. `max` speed = giant sim budget, wall cap stops it.

Two ceilings, two failure modes covered: runaway producer (event cap), runaway sim time (wall cap).

## Determinism

PCG32 RNG seeded once. Min-heap with `(time, seq)` ordering. Integer nanosecond clock. Same seed + same topology = identical run, byte-for-byte. Share-replay falls out for free.

## Node model

```go
type Node interface {
    ID() string
    Kind() string
    OnRequest(*Sim, *Request)              // a request arrived
    OnEvent(*Sim, Event)                   // ServiceDone, Tick, fault toggle
    SetFaulted(FaultKind, bool)            // chaos hook
    Snapshot() NodeMetrics                 // cheap, called every render
}
```

Engine has 6 archetypes in `sim/nodes/`; the frontend catalog maps 23 UI kinds onto them via `engineKind`:

- **Source** — Poisson arrivals at configurable RPS (`ExpNs`); orphan sources fail requests instead of marking them complete
- **LoadBalancer** — round-robin / least-in-flight / random; filters faulted backends; round-robin fans out across multiple downstreams
- **Service** — capacity, queue limit, log-normal service time; propagates downstream failures back up the err_rate chain
- **Cache** — hit/miss; miss forwards downstream
- **Database** — slow service preset
- **Queue** — buffer + drain rate

Nodes and edges can be hot-added while the sim is running.

## Metrics

- Latency: 512-sample ring buffer per node, percentile via insertion-sort copy
- Throughput: 10 buckets × 100ms sliding window
- Faults: kill / slow / packet-loss flags propagate on the next `OnRequest`

---

## Topology JSON contract

Frontend serializes the Svelte Flow graph into:

```json
{
  "seed": 42,
  "nodes": [
    { "id": "src1", "kind": "source", "props": { "rps": 1000 } },
    { "id": "lb1",  "kind": "loadbalancer", "props": { "strategy": "leastInFlight" } },
    { "id": "svc1", "kind": "service", "props": { "capacity": 50, "meanNs": 2000000 } },
    { "id": "db1",  "kind": "database", "props": {} }
  ],
  "edges": [
    { "src": "src1", "dst": "lb1" },
    { "src": "lb1",  "dst": "svc1" },
    { "src": "svc1", "dst": "db1" }
  ]
}
```

Same spec parsed by `sim/topology/loader.go` to build the `Sim`. Serializable, diffable, replay-able.

## WASM bridge contract

Go exports a global `crucible` with:

| Function | Args | Returns |
|----------|------|---------|
| `load(specJson)` | string | `{ ok }` or `{ error }` |
| `step(wallBudgetMs)` | number | events processed |
| `snapshot()` | — | JSON string `{ now, born, completed, failed, nodes[] }` |
| `setSpeed(v)` | number | new speed |
| `setRPS(nodeId, rps)` | string, number | bool |
| `injectFault(nodeId, kind, on)` | string, FaultKind, bool | bool |
| `reset()` | — | bool |

Type contract in `apps/web/src/lib/sim/wasm_exec.d.ts`.

---

## Layout

```
crucible/
├── Makefile                  # tinygo build → static/sim.wasm
├── sim/                      # Go simulation engine
│   ├── main.go               # WASM bridge (syscall/js) — exports `crucible` global
│   ├── engine/               # Sim, heap, event, RNG, node interface, request
│   ├── nodes/                # source, service, loadbalancer, cache, database, queue
│   ├── chaos/                # fault injection
│   ├── metrics/              # latency ring, throughput window
│   └── topology/             # JSON spec ↔ Sim builder
└── apps/web/                 # SvelteKit + Svelte 5
    ├── svelte.config.js      # adapter-static
    ├── vite.config.ts        # COOP/COEP headers, worker ES format
    ├── src/lib/
    │   ├── types/            # topology spec, node catalog (icons)
    │   ├── stores/           # design (canvas state), sim (worker bridge) — runes
    │   ├── sim/              # sim.worker.ts — Worker + WASM loader
    │   ├── components/       # Palette, ControlBar, Inspector, nodes/CrucibleNode
    │   └── canvas/           # Canvas.svelte — Svelte Flow wrapper
    └── static/               # sim.wasm + wasm_exec.js drop here (build artifacts)
```

---

## Design decisions worth knowing

- **No SSR.** Single-page app. `ssr = false` in `+layout.ts`, `adapter-static` ships a CDN-only bundle.
- **COOP/COEP headers.** Set in `vite.config.ts` so `SharedArrayBuffer` is available later if we move to multi-threaded WASM.
- **TinyGo over standard Go.** 10x smaller bundle. Reflect-free code paths only. Missing stdlib feature? `make sim-go` falls back.
- **Insertion sort in `LatencyRing`.** 512 samples, mostly sorted between calls, tiny code, fits in instruction cache. `sort.Slice` is bigger in TinyGo output than this loop.
- **Snapshot at 30Hz, sim at unbounded Hz.** Render cadence and sim cadence are separate concerns. The animation overlay can run at 60Hz reading the same snapshot buffer.
- **Logarithmic RPS slider.** Linear is useless across 6 orders of magnitude. Map `slider [0,100] → 10^[0,6] rps`.
