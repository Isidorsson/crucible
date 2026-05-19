package topology

import (
	"encoding/json"

	"github.com/crucible/sim/engine"
	"github.com/crucible/sim/nodes"
)

// Spec is the JSON contract between the JS frontend and the sim.
// The frontend produces this from the Svelte Flow graph.
type Spec struct {
	Seed  uint64    `json:"seed"`
	Nodes []NodeDef `json:"nodes"`
	Edges []EdgeDef `json:"edges"`
}

type NodeDef struct {
	ID    string         `json:"id"`
	Kind  string         `json:"kind"`
	Props map[string]any `json:"props"`
}

type EdgeDef struct {
	Src string `json:"src"`
	Dst string `json:"dst"`
}

// Build constructs a Sim from a JSON byte slice. Returns the sim and the
// list of bootstrap nodes (sources, queues) that need a kickoff event.
func Build(jsonBytes []byte) (*engine.Sim, []Bootstrapper, error) {
	var spec Spec
	if err := json.Unmarshal(jsonBytes, &spec); err != nil {
		return nil, nil, err
	}
	sim := engine.NewSim(spec.Seed)
	var boots []Bootstrapper

	for _, n := range spec.Nodes {
		if b := AddNodeFromDef(sim, n); b != nil {
			boots = append(boots, b)
		}
	}
	for _, e := range spec.Edges {
		sim.Connect(e.Src, e.Dst)
	}
	return sim, boots, nil
}

// AddNodeFromDef builds and inserts a single node into an existing sim,
// returning a Bootstrapper if the kind needs a kickoff event (sources,
// queues). Pulled out of Build so the WASM bridge can hot-add nodes
// mid-run with the same construction logic.
func AddNodeFromDef(sim *engine.Sim, n NodeDef) Bootstrapper {
	switch n.Kind {
	case "source":
		rps := floatProp(n.Props, "rps", 100)
		s := nodes.NewSource(n.ID, rps)
		sim.AddNode(s)
		return s
	case "service":
		cap := intProp(n.Props, "capacity", 50)
		ql := intProp(n.Props, "queueLimit", 500)
		mean := floatProp(n.Props, "meanNs", 2_000_000)
		std := floatProp(n.Props, "stdNs", 1_000_000)
		sim.AddNode(nodes.NewService(n.ID, cap, ql, mean, std))
	case "loadbalancer":
		strat := nodes.LBRoundRobin
		switch n.Props["strategy"] {
		case "leastInFlight":
			strat = nodes.LBLeastInFlight
		case "random":
			strat = nodes.LBRandom
		}
		sim.AddNode(nodes.NewLoadBalancer(n.ID, strat))
	case "cache":
		hr := floatProp(n.Props, "hitRate", 0.8)
		sim.AddNode(nodes.NewCache(n.ID, hr))
	case "database":
		sim.AddNode(nodes.NewDatabase(n.ID))
	case "queue":
		drain := floatProp(n.Props, "drainRPS", 100)
		max := intProp(n.Props, "max", 10000)
		q := nodes.NewQueue(n.ID, drain, max)
		sim.AddNode(q)
		return q
	}
	return nil
}

type Bootstrapper interface {
	Bootstrap(*engine.Sim)
}

func floatProp(m map[string]any, k string, def float64) float64 {
	if v, ok := m[k]; ok {
		if f, ok := v.(float64); ok {
			return f
		}
	}
	return def
}

func intProp(m map[string]any, k string, def int) int {
	if v, ok := m[k]; ok {
		if f, ok := v.(float64); ok {
			return int(f)
		}
	}
	return def
}
