package engine

// Sim holds the entire simulation state. One instance per running design.
//
// Hybrid scheduler:
//   - Sim clock advances event-driven (jump to next event time).
//   - Step(budgetNs) runs events whose Time <= now+budgetNs, capped by
//     a real-wallclock budget supplied by the host (the Worker tick).
//   - Speed multiplier scales how much sim-time we try to cover per
//     real-time frame. "max" mode supplies a large budget and lets the
//     wall-clock cap stop us.
type Sim struct {
	Now      int64 // ns since start
	Heap     *EventHeap
	RNG      *RNG
	Nodes    map[string]Node
	Edges    map[string][]string // src -> dsts
	Requests map[uint64]*Request

	seq   uint64
	reqID uint64

	// global metrics
	Completed uint64
	Failed    uint64
	Born      uint64

	// EdgeFlow counts request traversals per (src,dst) edge inside the
	// current snapshot window. UI consumes + resets it on Snapshot() so
	// edges pulse only while traffic actually flows. Bounded by edge count.
	EdgeFlow map[edgeKey]uint32

	// Partitions records edges the operator has severed via chaos. Any
	// EvRequestArrive event whose (prevHop, dst) pair is in the set is
	// dropped at dispatch and the in-flight request is failed. Modeled
	// as a set (struct{} value) for O(1) membership.
	Partitions map[edgeKey]struct{}

	// FaultLog buffers chaos events between snapshots. Drained + reset by
	// DrainFaultLog so the UI can render a timeline without us holding
	// onto every event for the life of the sim.
	FaultLog []FaultEvent
}

type edgeKey struct{ Src, Dst string }

// FaultEvent is a single chaos toggle entry surfaced to the UI timeline.
// Target identifies the affected resource: a node id, or an edge encoded
// as "src->dst" when Kind == FaultPartition.
type FaultEvent struct {
	Time   int64     `json:"t"`
	Target string    `json:"target"`
	Kind   FaultKind `json:"kind"`
	On     bool      `json:"on"`
}

func NewSim(seed uint64) *Sim {
	return &Sim{
		Heap:       NewEventHeap(4096),
		RNG:        NewRNG(seed),
		Nodes:      make(map[string]Node, 32),
		Edges:      make(map[string][]string, 32),
		Requests:   make(map[uint64]*Request, 1024),
		EdgeFlow:   make(map[edgeKey]uint32, 64),
		Partitions: make(map[edgeKey]struct{}, 8),
		FaultLog:   make([]FaultEvent, 0, 32),
	}
}

func (s *Sim) AddNode(n Node)                  { s.Nodes[n.ID()] = n }
func (s *Sim) Connect(src, dst string)         { s.Edges[src] = append(s.Edges[src], dst) }
func (s *Sim) Downstream(src string) []string  { return s.Edges[src] }

// Schedule pushes an event at absolute sim time t.
func (s *Sim) Schedule(t int64, kind EventKind, nodeID string, reqID uint64, data any) {
	s.seq++
	s.Heap.Push(Event{Time: t, Kind: kind, NodeID: nodeID, ReqID: reqID, Seq: s.seq, Data: data})
}

// ScheduleAfter pushes an event delta ns from now.
func (s *Sim) ScheduleAfter(delta int64, kind EventKind, nodeID string, reqID uint64, data any) {
	s.Schedule(s.Now+delta, kind, nodeID, reqID, data)
}

func (s *Sim) NewRequestID() uint64 {
	s.reqID++
	return s.reqID
}

// Step advances the simulation. Returns number of events processed.
//
// budgetSimNs: maximum sim-time delta we are allowed to cover this call.
// maxEvents:   safety cap so a runaway producer cannot freeze the worker.
func (s *Sim) Step(budgetSimNs int64, maxEvents int) int {
	deadline := s.Now + budgetSimNs
	processed := 0
	for processed < maxEvents {
		ev, ok := s.Heap.Peek()
		if !ok {
			break
		}
		if ev.Time > deadline {
			// jump sim clock forward to deadline so wall-time stays honest
			s.Now = deadline
			break
		}
		s.Heap.Pop()
		s.Now = ev.Time
		s.dispatch(ev)
		processed++
	}
	return processed
}

func (s *Sim) dispatch(ev Event) {
	n, ok := s.Nodes[ev.NodeID]
	if !ok {
		return
	}
	switch ev.Kind {
	case EvRequestArrive:
		req := s.Requests[ev.ReqID]
		if req == nil {
			return
		}
		prev := req.CurrentID
		// Partition check happens before Hop so the request still
		// shows its last-seen node in failure-trace tooling. The hop
		// across the severed link never occurred.
		if prev != "" && prev != ev.NodeID {
			if _, severed := s.Partitions[edgeKey{Src: prev, Dst: ev.NodeID}]; severed {
				s.FailReq(req, "link partitioned")
				if src, ok := s.Nodes[prev]; ok {
					src.RecordUpstreamError()
				}
				return
			}
		}
		req.Hop(ev.NodeID)
		if prev != "" && prev != ev.NodeID {
			s.EdgeFlow[edgeKey{Src: prev, Dst: ev.NodeID}]++
		}
		n.OnRequest(s, req)
	default:
		n.OnEvent(s, ev)
	}
}

// Emit a new request from a source node.
func (s *Sim) Emit(originID string) {
	id := s.NewRequestID()
	req := &Request{ID: id, BornAt: s.Now, Origin: originID, CurrentID: originID}
	s.Requests[id] = req
	s.Born++
	s.Schedule(s.Now, EvRequestArrive, originID, id, nil)
}

// Complete and Fail are accounting hooks for sink/error paths.
// Both free the request from the map so memory stays bounded by
// in-flight count, not by lifetime total. The req pointer remains
// valid for the caller's stack frame; we only drop the map entry.
func (s *Sim) Complete(req *Request) {
	req.Finish(s.Now)
	s.Completed++
	delete(s.Requests, req.ID)
}

func (s *Sim) FailReq(req *Request, reason string) {
	req.Fail(reason, s.Now)
	s.Failed++
	// Propagate the error up the chain so every prior hop's err_rate
	// reflects requests that died downstream. The failing node already
	// called recordError() in its own handler, so we exclude it here.
	// Dedupe self-requeue loops (a service requeues by re-arriving at
	// itself, which appends a duplicate hop) to avoid double-counting.
	if hops := len(req.Hops); hops >= 2 {
		last := req.Hops[hops-1]
		seen := make(map[string]struct{}, hops)
		for i := 0; i < hops-1; i++ {
			id := req.Hops[i]
			if id == last {
				continue
			}
			if _, dup := seen[id]; dup {
				continue
			}
			seen[id] = struct{}{}
			if n, ok := s.Nodes[id]; ok {
				n.RecordUpstreamError()
			}
		}
	}
	delete(s.Requests, req.ID)
}

// DrainEdgeFlow returns and resets the edge-flow counters. Called by the
// WASM snapshot path so the UI can animate edges that saw traffic in the
// last frame.
func (s *Sim) DrainEdgeFlow() map[edgeKey]uint32 {
	out := s.EdgeFlow
	s.EdgeFlow = make(map[edgeKey]uint32, len(out))
	return out
}

// FaultKind value reserved for edge partitioning. Distinct from the
// per-node kinds so the UI can render edges differently and the dispatch
// path doesn't conflate "the node is dead" with "the link is severed".
const FaultPartition FaultKind = 100

// SetPartition adds or removes a (src,dst) entry. Returns the prior state
// so callers can no-op when the toggle is redundant (and skip emitting a
// duplicate log entry).
func (s *Sim) SetPartition(src, dst string, on bool) (changed bool) {
	k := edgeKey{Src: src, Dst: dst}
	_, was := s.Partitions[k]
	if on == was {
		return false
	}
	if on {
		s.Partitions[k] = struct{}{}
	} else {
		delete(s.Partitions, k)
	}
	return true
}

// PartitionPair is the exported form of a severed (src,dst) edge for the
// snapshot path. The internal edgeKey stays unexported so callers can't
// reach into Sim.Partitions and mutate the set without going through
// SetPartition.
type PartitionPair struct {
	Src string `json:"src"`
	Dst string `json:"dst"`
}

// PartitionList returns the current set as a slice for snapshot emission.
// Allocation is tiny (partitions count, not edge count).
func (s *Sim) PartitionList() []PartitionPair {
	out := make([]PartitionPair, 0, len(s.Partitions))
	for k := range s.Partitions {
		out = append(out, PartitionPair{Src: k.Src, Dst: k.Dst})
	}
	return out
}

// LogFault appends a chaos event to the timeline buffer. The buffer is
// drained on Snapshot, so the cap here is just a safety against runaway
// growth between drains (32 frames worth at most).
const maxFaultLogBuffer = 256

func (s *Sim) LogFault(target string, kind FaultKind, on bool) {
	if len(s.FaultLog) >= maxFaultLogBuffer {
		// Drop the oldest entry rather than allocating without bound.
		// The store-side ring is the source of truth for what the UI
		// shows; we just need to not balloon between drains.
		s.FaultLog = s.FaultLog[1:]
	}
	s.FaultLog = append(s.FaultLog, FaultEvent{
		Time: s.Now, Target: target, Kind: kind, On: on,
	})
}

// DrainFaultLog returns and resets the timeline buffer. UI accumulates
// the deltas into its own bounded ring. Returns an empty (non-nil) slice
// when the buffer is empty so the JSON encoder emits [] instead of null
// — the worker-side type stays `FaultEvent[]` either way.
func (s *Sim) DrainFaultLog() []FaultEvent {
	if len(s.FaultLog) == 0 {
		return []FaultEvent{}
	}
	out := s.FaultLog
	s.FaultLog = make([]FaultEvent, 0, 32)
	return out
}
