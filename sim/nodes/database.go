package nodes

import "github.com/crucible/sim/engine"

// Database: a slow service with smaller capacity and a longer tail.
// Default service time mean 8ms, std 4ms.
type Database struct {
	*Service
}

func NewDatabase(id string) *Database {
	svc := NewService(id, 20, 200, 8_000_000, 4_000_000)
	svc.kind = "database"
	return &Database{Service: svc}
}

// Cache: very fast service, generous capacity.
type Cache struct {
	*Service
	hitRate float64
}

func NewCache(id string, hitRate float64) *Cache {
	svc := NewService(id, 1000, 10000, 100_000, 50_000) // 100us mean
	svc.kind = "cache"
	return &Cache{Service: svc, hitRate: hitRate}
}

// OnRequest: on hit, complete locally; on miss, forward to downstream (DB).
func (c *Cache) OnRequest(sim *engine.Sim, req *engine.Request) {
	c.touch(sim.Now)
	c.totalRcv++

	if c.fault == engine.FaultKill {
		sim.FailReq(req, "cache down")
		c.recordError()
		return
	}

	hit := sim.RNG.Float64() < c.hitRate
	if hit {
		svc := sim.RNG.LogNormalNs(c.meanNs, c.stdNs)
		sim.ScheduleAfter(svc, engine.EvServiceDone, c.id, req.ID, nil)
		c.inFlight++
		return
	}
	// miss: forward downstream (typically a DB); round-robin if multiple.
	pool := sim.Downstream(c.id)
	target := c.nextDownstream(pool)
	if target == "" {
		sim.FailReq(req, "cache miss, no backing store")
		c.recordError()
		return
	}
	sim.Schedule(sim.Now, engine.EvRequestArrive, target, req.ID, nil)
}

// Queue: holds requests; consumers downstream pull at a fixed drain rate.
type Queue struct {
	base
	drainRPS float64
	buffer   []uint64
	max      int
}

func NewQueue(id string, drainRPS float64, max int) *Queue {
	q := &Queue{
		base:     newBase(id, "queue"),
		drainRPS: drainRPS,
		max:      max,
	}
	return q
}

func (q *Queue) Bootstrap(sim *engine.Sim) {
	q.scheduleDrain(sim)
}

func (q *Queue) scheduleDrain(sim *engine.Sim) {
	if q.drainRPS <= 0 {
		return
	}
	delta := int64(1e9 / q.drainRPS)
	sim.ScheduleAfter(delta, engine.EvTick, q.id, 0, nil)
}

func (q *Queue) OnRequest(sim *engine.Sim, req *engine.Request) {
	q.touch(sim.Now)
	q.totalRcv++
	if q.fault == engine.FaultKill {
		sim.FailReq(req, "queue down")
		q.recordError()
		return
	}
	if len(q.buffer) >= q.max {
		sim.FailReq(req, "queue overflow")
		q.recordError()
		return
	}
	q.buffer = append(q.buffer, req.ID)
	q.queue = len(q.buffer)
}

func (q *Queue) OnEvent(sim *engine.Sim, ev engine.Event) {
	q.touch(sim.Now)
	if ev.Kind != engine.EvTick {
		return
	}
	if len(q.buffer) > 0 {
		reqID := q.buffer[0]
		q.buffer = q.buffer[1:]
		q.queue = len(q.buffer)
		pool := sim.Downstream(q.id)
		// Competing-consumers semantics: each dequeued request goes to
		// one downstream, picked round-robin. So an Event Bus / Kafka /
		// pubsub queue with three workers spreads load 1/3 each instead
		// of pinning the whole stream to worker[0].
		target := q.nextDownstream(pool)
		if target != "" {
			sim.Schedule(sim.Now, engine.EvRequestArrive, target, reqID, nil)
			q.recordCompletion()
		}
	}
	q.scheduleDrain(sim)
}
