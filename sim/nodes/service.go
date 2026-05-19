package nodes

import "github.com/crucible/sim/engine"

// Service is a generic stateless worker: queue, service time, capacity.
// Fault behaviors: Kill drops, Slow inflates service time 10x, PacketLoss
// drops a sampled fraction.
type Service struct {
	base
	capacity   int   // max concurrent in-flight
	queueLimit int   // max queued before reject
	meanNs     float64
	stdNs      float64
}

func NewService(id string, capacity, queueLimit int, meanNs, stdNs float64) *Service {
	return &Service{
		base:       newBase(id, "service"),
		capacity:   capacity,
		queueLimit: queueLimit,
		meanNs:     meanNs,
		stdNs:      stdNs,
	}
}

func (s *Service) OnRequest(sim *engine.Sim, req *engine.Request) {
	s.touch(sim.Now)
	s.totalRcv++

	if s.fault == engine.FaultKill {
		sim.FailReq(req, "service down")
		s.recordError()
		return
	}
	if s.fault == engine.FaultPacketLoss && sim.RNG.Float64() < 0.5 {
		sim.FailReq(req, "packet loss")
		s.recordError()
		return
	}

	if s.inFlight >= s.capacity {
		if s.queue >= s.queueLimit {
			sim.FailReq(req, "queue full")
			s.recordError()
			return
		}
		s.queue++
		// requeue: schedule a retry shortly. Real queues hold refs; we
		// approximate with a re-arrive 1ms later. Good enough for v1.
		sim.ScheduleAfter(1_000_000, engine.EvRequestArrive, s.id, req.ID, nil)
		return
	}

	s.inFlight++
	svc := sim.RNG.LogNormalNs(s.meanNs, s.stdNs)
	if s.fault == engine.FaultSlow {
		svc *= 10
	}
	sim.ScheduleAfter(svc, engine.EvServiceDone, s.id, req.ID, nil)
}

func (s *Service) OnEvent(sim *engine.Sim, ev engine.Event) {
	s.touch(sim.Now)
	if ev.Kind != engine.EvServiceDone {
		return
	}
	req := sim.Requests[ev.ReqID]
	if req == nil {
		return
	}
	s.inFlight--
	if s.queue > 0 {
		s.queue--
	}
	s.recordLatency(sim.Now - req.BornAt)
	s.recordCompletion()

	downstream := sim.Downstream(s.id)
	if len(downstream) == 0 {
		sim.Complete(req)
		return
	}
	// fan-out: send to first downstream. Load balancer handles multi-fan-out.
	sim.Schedule(sim.Now, engine.EvRequestArrive, downstream[0], req.ID, nil)
}
