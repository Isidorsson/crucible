package chaos

import "github.com/crucible/sim/engine"

// Inject toggles a fault on a node. Returns false if node missing.
func Inject(sim *engine.Sim, nodeID string, kind engine.FaultKind, on bool) bool {
	n, ok := sim.Nodes[nodeID]
	if !ok {
		return false
	}
	n.SetFaulted(kind, on)
	return true
}

// ScheduleFlap toggles a fault on/off at fixed intervals, simulating
// a flapping node. period is in nanoseconds.
func ScheduleFlap(sim *engine.Sim, nodeID string, kind engine.FaultKind, periodNs int64) {
	sim.ScheduleAfter(periodNs, engine.EvFaultStart, nodeID, 0, kind)
}
