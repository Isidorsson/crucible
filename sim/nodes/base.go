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

	// Cursor for round-robin fan-out across multiple downstreams. Each
	// non-LB node that forwards traffic uses this so a fan-out of N
	// children gets balanced 1/N share, not all to downstream[0].
	outCursor int

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

// RecordUpstreamError satisfies engine.Node. Called by the sim on every
// upstream hop of a request that died downstream so this node's
// err_rate reflects work it handled which later failed. Distinct from
// recordError only as a documentation aid — both bump the same counter.
func (b *base) RecordUpstreamError() { b.errors++ }

// nextDownstream returns the next downstream id by round-robin, or ""
// when the pool is empty. Mutates outCursor so subsequent calls march.
func (b *base) nextDownstream(pool []string) string {
	if len(pool) == 0 {
		return ""
	}
	id := pool[b.outCursor%len(pool)]
	b.outCursor++
	return id
}

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
