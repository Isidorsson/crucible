package engine

type EventKind uint8

const (
	EvRequestArrive EventKind = iota
	EvRequestDepart
	EvServiceDone
	EvTimeout
	EvFaultStart
	EvFaultEnd
	EvTick
)

// Event is a single scheduled occurrence on the sim timeline.
// Time is in nanoseconds since sim start.
type Event struct {
	Time   int64
	Kind   EventKind
	NodeID string
	ReqID  uint64
	Seq    uint64 // tie-breaker so equal-time events stay FIFO
	Data   any
}
