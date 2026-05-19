//go:build js && wasm

package main

import (
	"encoding/json"
	"syscall/js"

	"github.com/crucible/sim/chaos"
	"github.com/crucible/sim/engine"
	"github.com/crucible/sim/nodes"
	"github.com/crucible/sim/topology"
)

// Globals are the simplest path for a single-instance WASM module. If we
// ever support multi-sim, wrap state in a per-instance struct keyed by handle.
var (
	sim   *engine.Sim
	boots []topology.Bootstrapper

	// Speed knobs set by the JS side. The Worker calls step() each render
	// frame and supplies a wall-budget; we translate to a sim-budget via speed.
	speed float64 = 1.0
)

func main() {
	js.Global().Set("crucible", js.ValueOf(map[string]any{
		"load":        js.FuncOf(jsLoad),
		"step":        js.FuncOf(jsStep),
		"snapshot":    js.FuncOf(jsSnapshot),
		"setSpeed":    js.FuncOf(jsSetSpeed),
		"setRPS":      js.FuncOf(jsSetRPS),
		"injectFault": js.FuncOf(jsInjectFault),
		"reset":       js.FuncOf(jsReset),
	}))
	select {} // keep WASM alive
}

func jsLoad(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return errVal("missing topology json")
	}
	raw := args[0].String()
	s, b, err := topology.Build([]byte(raw))
	if err != nil {
		return errVal(err.Error())
	}
	sim = s
	boots = b
	for _, bt := range boots {
		bt.Bootstrap(sim)
	}
	return js.ValueOf(map[string]any{"ok": true})
}

// jsStep advances the sim.
// args[0]: wallBudgetMs (number)  — real-time budget the Worker is willing to spend
// returns: events processed
func jsStep(this js.Value, args []js.Value) any {
	if sim == nil {
		return js.ValueOf(0)
	}
	wallMs := args[0].Float()
	// sim ns = wall ms * 1e6 * speed
	simBudget := int64(wallMs * 1e6 * speed)
	if simBudget <= 0 {
		simBudget = 1
	}
	// cap events to avoid pegging the worker
	processed := sim.Step(simBudget, 50_000)
	return js.ValueOf(processed)
}

func jsSnapshot(this js.Value, args []js.Value) any {
	if sim == nil {
		return js.ValueOf("[]")
	}
	out := make([]engine.NodeMetrics, 0, len(sim.Nodes))
	for _, n := range sim.Nodes {
		out = append(out, n.Snapshot())
	}
	payload := map[string]any{
		"now":       sim.Now,
		"born":      sim.Born,
		"completed": sim.Completed,
		"failed":    sim.Failed,
		"nodes":     out,
	}
	b, _ := json.Marshal(payload)
	return js.ValueOf(string(b))
}

func jsSetSpeed(this js.Value, args []js.Value) any {
	speed = args[0].Float()
	if speed < 0 {
		speed = 0
	}
	return js.ValueOf(speed)
}

func jsSetRPS(this js.Value, args []js.Value) any {
	if sim == nil {
		return errVal("no sim")
	}
	id := args[0].String()
	rps := args[1].Float()
	if src, ok := sim.Nodes[id].(*nodes.Source); ok {
		src.SetRPS(rps)
	}
	return js.ValueOf(true)
}

func jsInjectFault(this js.Value, args []js.Value) any {
	if sim == nil {
		return errVal("no sim")
	}
	id := args[0].String()
	kind := engine.FaultKind(args[1].Int())
	on := args[2].Bool()
	ok := chaos.Inject(sim, id, kind, on)
	return js.ValueOf(ok)
}

func jsReset(this js.Value, args []js.Value) any {
	sim = nil
	boots = nil
	return js.ValueOf(true)
}

func errVal(msg string) js.Value {
	b, _ := json.Marshal(map[string]any{"error": msg})
	return js.ValueOf(string(b))
}
