# Static assets

Build artifacts dropped here at build time:

- `sim.wasm` — produced by `make sim` (TinyGo) or `make sim-go`
- `wasm_exec.js` — copy from your Go/TinyGo toolchain:
  - TinyGo: `cp $(tinygo env TINYGOROOT)/targets/wasm_exec.js ./`
  - Standard Go: `cp $(go env GOROOT)/misc/wasm/wasm_exec.js ./` (Go <1.22) or `$(go env GOROOT)/lib/wasm/wasm_exec.js` (Go >=1.22)

`wasm_exec.js` is intentionally not committed — keep it pinned to the toolchain that built `sim.wasm`.
