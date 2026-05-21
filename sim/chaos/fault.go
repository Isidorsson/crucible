package chaos

import "github.com/crucible/sim/engine"

// Inject toggles a fault on a node and records the event on the sim's
// timeline. Returns false if the node is missing.
func Inject(sim *engine.Sim, nodeID string, kind engine.FaultKind, on bool) bool {
	n, ok := sim.Nodes[nodeID]
	if !ok {
		return false
	}
	n.SetFaulted(kind, on)
	sim.LogFault(nodeID, kind, on)
	return true
}

// Partition severs (or restores) a directed edge in the sim. Requests
// that would traverse a severed (src,dst) pair are failed at dispatch
// with reason "link partitioned" — models a network split, AZ break, or
// firewall rule. Returns false when src or dst is missing, or the toggle
// is redundant (already in the requested state).
func Partition(sim *engine.Sim, src, dst string, on bool) bool {
	if _, ok := sim.Nodes[src]; !ok {
		return false
	}
	if _, ok := sim.Nodes[dst]; !ok {
		return false
	}
	if !sim.SetPartition(src, dst, on) {
		return false
	}
	sim.LogFault(src+"->"+dst, engine.FaultPartition, on)
	return true
}

// ScheduleFlap toggles a fault on/off at fixed intervals, simulating
// a flapping node. period is in nanoseconds.
func ScheduleFlap(sim *engine.Sim, nodeID string, kind engine.FaultKind, periodNs int64) {
	sim.ScheduleAfter(periodNs, engine.EvFaultStart, nodeID, 0, kind)
}
