package engine

// Node is anything that processes requests in the simulation.
// LoadBalancer, Service, Cache, Database, Queue all implement this.
//
// Node implementations MUST be deterministic given the same RNG sequence,
// otherwise the seeded-replay invariant breaks.
type Node interface {
	ID() string
	Kind() string

	// OnRequest is called when a request arrives at this node.
	// The node decides what events to schedule (downstream call,
	// service completion, drop, queue, etc).
	OnRequest(s *Sim, req *Request)

	// OnEvent handles non-arrival events targeted at this node
	// (e.g., service-complete callbacks).
	OnEvent(s *Sim, ev Event)

	// SetFaulted toggles a chaos state. Implementations decide
	// how to react (drop, slow, fail).
	SetFaulted(kind FaultKind, on bool)

	// Snapshot reports current metrics. Cheap, called every render tick.
	Snapshot() NodeMetrics
}

type FaultKind uint8

const (
	FaultNone FaultKind = iota
	FaultKill              // node drops all requests
	FaultSlow              // node service-time inflated
	FaultPacketLoss        // drops a fraction of requests
)

type NodeMetrics struct {
	ID         string  `json:"id"`
	InFlight   int     `json:"inFlight"`
	QueueDepth int     `json:"queueDepth"`
	Throughput float64 `json:"throughput"` // requests/sec (windowed)
	P50Latency int64   `json:"p50"`        // nanoseconds
	P99Latency int64   `json:"p99"`
	ErrorRate  float64 `json:"errorRate"`
	Faulted    bool    `json:"faulted"`
}
