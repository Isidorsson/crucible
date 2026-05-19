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
		"addNode":     js.FuncOf(jsAddNode),
		"addEdge":     js.FuncOf(jsAddEdge),
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

type edgeFlowJSON struct {
	Src   string `json:"src"`
	Dst   string `json:"dst"`
	Count uint32 `json:"count"`
}

func jsSnapshot(this js.Value, args []js.Value) any {
	if sim == nil {
		return js.ValueOf("[]")
	}
	nodesOut := make([]engine.NodeMetrics, 0, len(sim.Nodes))
	for _, n := range sim.Nodes {
		nodesOut = append(nodesOut, n.Snapshot())
	}
	drained := sim.DrainEdgeFlow()
	edgesOut := make([]edgeFlowJSON, 0, len(drained))
	for k, v := range drained {
		edgesOut = append(edgesOut, edgeFlowJSON{Src: k.Src, Dst: k.Dst, Count: v})
	}
	payload := map[string]any{
		"now":       sim.Now,
		"born":      sim.Born,
		"completed": sim.Completed,
		"failed":    sim.Failed,
		"inFlight":  len(sim.Requests),
		"nodes":     nodesOut,
		"edges":     edgesOut,
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

// jsAddNode inserts a node into a running sim. Bootstraps the node if it
// needs a kickoff event (source, queue) so traffic starts flowing on the
// next Step() — the user sees the new component take its share of load
// without having to stop+restart the sim.
//
// args[0]: NodeDef JSON
func jsAddNode(this js.Value, args []js.Value) any {
	if sim == nil {
		return errVal("no sim")
	}
	if len(args) < 1 {
		return errVal("missing node json")
	}
	var def topology.NodeDef
	if err := json.Unmarshal([]byte(args[0].String()), &def); err != nil {
		return errVal(err.Error())
	}
	if _, exists := sim.Nodes[def.ID]; exists {
		// Idempotent: a stale UI-side replay shouldn't double-bootstrap.
		return js.ValueOf(true)
	}
	if b := topology.AddNodeFromDef(sim, def); b != nil {
		b.Bootstrap(sim)
		boots = append(boots, b)
	}
	return js.ValueOf(true)
}

// jsAddEdge wires up a (src, dst) edge on a running sim. Existing in-flight
// requests already routed elsewhere are unaffected; new requests arriving
// at src after this call may be routed via the new edge depending on the
// node's routing strategy (round-robin LBs pick it up immediately).
//
// args[0]: src id, args[1]: dst id
func jsAddEdge(this js.Value, args []js.Value) any {
	if sim == nil {
		return errVal("no sim")
	}
	if len(args) < 2 {
		return errVal("missing src/dst")
	}
	src := args[0].String()
	dst := args[1].String()
	if _, ok := sim.Nodes[src]; !ok {
		return errVal("unknown src node")
	}
	if _, ok := sim.Nodes[dst]; !ok {
		return errVal("unknown dst node")
	}
	// Idempotent: don't double-connect if the edge already exists.
	for _, d := range sim.Downstream(src) {
		if d == dst {
			return js.ValueOf(true)
		}
	}
	sim.Connect(src, dst)
	return js.ValueOf(true)
}

func errVal(msg string) js.Value {
	b, _ := json.Marshal(map[string]any{"error": msg})
	return js.ValueOf(string(b))
}
