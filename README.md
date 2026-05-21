# Crucible

Browser-based system design simulator. Drag components onto a canvas, wire them up, drive traffic, inject failures, watch real-time metrics.

Not a diagramming tool. Architectures actually **run**.

![Running simulation](docs/screenshots/03-running.png)

---

## Features

- **23-kind component catalog** — clients, CDN, WAF, LB, services, caches, databases, queues, event bus
- **Live metrics** — per-node throughput, p50/p99 latency, in-flight, queue depth, error rate, sparklines
- **Chaos injection** — kill nodes, slow them down, drop packets
- **Traffic control** — 1 → 1,000,000 rps, 0.25x → max speed
- **Topology lint** — 9 rules, anti-pattern chips, worst-p99 diagnosis
- **Cost + SLO chips** — per-node $/mo + p99 budget
- **Templates + scenarios** — 13 starter architectures, 6 scripted drills
- **Export / import** as JSON

Built for system design interview prep, architecture validation, and teaching distributed systems.

---

## Run locally

Prereqs: `bun`, Go 1.22+, TinyGo.

```bash
cd apps/web && bun install
cd .. && make sim
cp $(tinygo env TINYGOROOT)/targets/wasm_exec.js apps/web/static/
cd apps/web && bun run dev
```

Open http://localhost:5173. Drag a Source → Service → Database, click Run.

### Other targets

```bash
make sim-go       # standard Go build (~2MB, full stdlib)
make clean

cd apps/web && bun run typecheck && bun run lint
cd sim && go test ./... && go vet ./...
```

---

## Stack

SvelteKit 2 + Svelte 5 runes · `@xyflow/svelte` · Tailwind · Go → TinyGo → WASM (~200KB) · Web Worker host · Vercel static deploy. No server — sim runs in your browser.

---

## Screenshots

Empty canvas — palette grouped by category.

![Empty canvas](docs/screenshots/01-canvas.png)

Templates tab — 13 starter architectures, labelled by node + edge count.

![Templates panel](docs/screenshots/02-templates.png)

Inspector — selected node shows engine props, live metrics, chaos buttons, anti-pattern chips.

![Inspector](docs/screenshots/04-inspector.png)

Microservices fan-out template — gateway routes to two independent service+store pairs in parallel.

![Microservices fan-out running](docs/screenshots/05-template-running.png)

Regenerate via `bun scripts/screenshots.ts` (dev server on `:5173`).

---

## More

**[Architecture deep-dive](docs/ARCHITECTURE.md)** — hybrid scheduler, determinism, node model, topology JSON, WASM bridge, design decisions.

## License

MIT
