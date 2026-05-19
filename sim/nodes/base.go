package nodes

import (
	"github.com/crucible/sim/engine"
	"github.com/crucible/sim/metrics"
)

// base is embedded by every concrete node. Holds metric plumbing and
// the most recent sim time observed (set whenever the node is invoked).
type base struct {
	id       string
	kind     string
	fault    engine.FaultKind
	faulted  bool
	inFlight int
	queue    int
	errors   uint64
	totalRcv uint64
	lastNow  int64

	lat *metrics.LatencyRing
	tp  *metrics.ThroughputWindow
}

func newBase(id, kind string) base {
	return base{
		id:   id,
		kind: kind,
		lat:  metrics.NewLatencyRing(512),
		tp:   metrics.NewThroughputWindow(100_000_000, 10),
	}
}

func (b *base) ID() string   { return b.id }
func (b *base) Kind() string { return b.kind }

func (b *base) SetFaulted(kind engine.FaultKind, on bool) {
	if on {
		b.fault = kind
		b.faulted = true
	} else {
		b.fault = engine.FaultNone
		b.faulted = false
	}
}

func (b *base) touch(now int64)     { b.lastNow = now }
func (b *base) recordLatency(ns int64) { b.lat.Add(ns) }
func (b *base) recordCompletion()      { b.tp.Add(b.lastNow) }
func (b *base) recordError()           { b.errors++ }

func (b *base) Snapshot() engine.NodeMetrics {
	rate := b.tp.Rate(b.lastNow)
	var errRate float64
	if b.totalRcv > 0 {
		errRate = float64(b.errors) / float64(b.totalRcv)
	}
	return engine.NodeMetrics{
		ID:         b.id,
		InFlight:   b.inFlight,
		QueueDepth: b.queue,
		Throughput: rate,
		P50Latency: b.lat.Percentile(0.50),
		P99Latency: b.lat.Percentile(0.99),
		ErrorRate:  errRate,
		Faulted:    b.faulted,
	}
}
