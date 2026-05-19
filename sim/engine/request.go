package engine

// Request flows through the topology. Hops record routing for debugging.
type Request struct {
	ID         uint64
	BornAt     int64    // sim time ns
	Origin     string   // source node id
	CurrentID  string   // node currently holding it
	Hops       []string // ordered list of visited node ids
	Failed     bool
	FailReason string
	FinishedAt int64
}

func (r *Request) Hop(nodeID string) {
	r.Hops = append(r.Hops, nodeID)
	r.CurrentID = nodeID
}

func (r *Request) Fail(reason string, now int64) {
	r.Failed = true
	r.FailReason = reason
	r.FinishedAt = now
}

func (r *Request) Finish(now int64) {
	r.FinishedAt = now
}

func (r *Request) LatencyNs() int64 {
	if r.FinishedAt == 0 {
		return 0
	}
	return r.FinishedAt - r.BornAt
}
