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
}

type edgeKey struct{ Src, Dst string }

func NewSim(seed uint64) *Sim {
	return &Sim{
		Heap:     NewEventHeap(4096),
		RNG:      NewRNG(seed),
		Nodes:    make(map[string]Node, 32),
		Edges:    make(map[string][]string, 32),
		Requests: make(map[uint64]*Request, 1024),
		EdgeFlow: make(map[edgeKey]uint32, 64),
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
