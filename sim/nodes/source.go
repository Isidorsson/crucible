package nodes

import "github.com/crucible/sim/engine"

// Source generates requests at a target RPS, fanning out to one downstream.
// Inter-arrival times are exponential, giving a Poisson process.
type Source struct {
	base
	rps      float64
	nextID   uint64
}

func NewSource(id string, rps float64) *Source {
	return &Source{base: newBase(id, "source"), rps: rps}
}

func (s *Source) SetRPS(rps float64) { s.rps = rps }

// Tick schedules the next request emission. Called once by the sim to bootstrap.
func (s *Source) Bootstrap(sim *engine.Sim) {
	s.scheduleNext(sim)
}

func (s *Source) scheduleNext(sim *engine.Sim) {
	if s.rps <= 0 {
		return
	}
	delta := sim.RNG.ExpNs(s.rps)
	sim.ScheduleAfter(delta, engine.EvTick, s.id, 0, nil)
}

func (s *Source) OnRequest(sim *engine.Sim, req *engine.Request) {
	// Sources do not receive requests; route immediately downstream.
	s.routeOut(sim, req)
}

func (s *Source) OnEvent(sim *engine.Sim, ev engine.Event) {
	s.touch(sim.Now)
	switch ev.Kind {
	case engine.EvTick:
		// emit one request, schedule the next, and count the emission as
		// throughput so the node's own rps reflects what it just produced.
		// Without this, edge flow downstream shows traffic but the source
		// node itself reads 0 rps — confusing for anyone reading the UI.
		sim.Emit(s.id)
		s.recordCompletion()
		s.scheduleNext(sim)
	}
}

func (s *Source) routeOut(sim *engine.Sim, req *engine.Request) {
	downstream := sim.Downstream(s.id)
	if len(downstream) == 0 {
		sim.Complete(req)
		return
	}
	target := downstream[0]
	sim.Schedule(sim.Now, engine.EvRequestArrive, target, req.ID, nil)
}
