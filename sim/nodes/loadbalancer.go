package nodes

import "github.com/crucible/sim/engine"

// LoadBalancer routes incoming requests across downstream nodes using
// one of: RoundRobin, LeastInFlight, Random. Skips downstreams marked
// faulted via SetFaulted.
type LBStrategy uint8

const (
	LBRoundRobin LBStrategy = iota
	LBLeastInFlight
	LBRandom
)

type LoadBalancer struct {
	base
	strategy LBStrategy
	cursor   int
}

func NewLoadBalancer(id string, strategy LBStrategy) *LoadBalancer {
	return &LoadBalancer{base: newBase(id, "loadbalancer"), strategy: strategy}
}

func (l *LoadBalancer) OnRequest(sim *engine.Sim, req *engine.Request) {
	l.touch(sim.Now)
	l.totalRcv++

	if l.fault == engine.FaultKill {
		sim.FailReq(req, "lb down")
		l.recordError()
		return
	}

	pool := sim.Downstream(l.id)
	if len(pool) == 0 {
		sim.FailReq(req, "no backends")
		l.recordError()
		return
	}

	// filter healthy backends
	healthy := pool[:0:0]
	for _, id := range pool {
		n, ok := sim.Nodes[id]
		if !ok {
			continue
		}
		if n.Snapshot().Faulted {
			continue
		}
		healthy = append(healthy, id)
	}
	if len(healthy) == 0 {
		sim.FailReq(req, "all backends down")
		l.recordError()
		return
	}

	var target string
	switch l.strategy {
	case LBRoundRobin:
		target = healthy[l.cursor%len(healthy)]
		l.cursor++
	case LBLeastInFlight:
		best := healthy[0]
		bestLoad := sim.Nodes[best].Snapshot().InFlight
		for _, id := range healthy[1:] {
			if load := sim.Nodes[id].Snapshot().InFlight; load < bestLoad {
				best, bestLoad = id, load
			}
		}
		target = best
	case LBRandom:
		target = healthy[int(sim.RNG.Uint32())%len(healthy)]
	}

	sim.Schedule(sim.Now, engine.EvRequestArrive, target, req.ID, nil)
	l.recordCompletion()
}

func (l *LoadBalancer) OnEvent(sim *engine.Sim, ev engine.Event) {
	l.touch(sim.Now)
}
