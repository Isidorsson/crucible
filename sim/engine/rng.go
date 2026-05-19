package engine

// PCG32 — deterministic, tiny, fast. Sufficient for sim.
// crypto/rand and math/rand pull weight we don't need in WASM.
type RNG struct {
	state uint64
	inc   uint64
}

func NewRNG(seed uint64) *RNG {
	r := &RNG{inc: (seed << 1) | 1}
	r.Uint32()
	r.state += seed
	r.Uint32()
	return r
}

func (r *RNG) Uint32() uint32 {
	old := r.state
	r.state = old*6364136223846793005 + r.inc
	xorshifted := uint32(((old >> 18) ^ old) >> 27)
	rot := uint32(old >> 59)
	return (xorshifted >> rot) | (xorshifted << ((-rot) & 31))
}

// Float64 uniform in [0,1).
func (r *RNG) Float64() float64 {
	return float64(r.Uint32()) / 4294967296.0
}

// Exp samples from Exponential(rateHz). Returns inter-arrival in nanoseconds.
func (r *RNG) ExpNs(rateHz float64) int64 {
	if rateHz <= 0 {
		return 1 << 62
	}
	u := r.Float64()
	if u < 1e-12 {
		u = 1e-12
	}
	// -ln(1-u)/rate, in seconds, then to ns
	return int64(-logApprox(u) / rateHz * 1e9)
}

// LogNormalNs samples a service-time distribution in nanoseconds.
// meanNs and stdNs in nanoseconds.
func (r *RNG) LogNormalNs(meanNs, stdNs float64) int64 {
	if meanNs <= 0 {
		return 0
	}
	if stdNs <= 0 {
		return int64(meanNs)
	}
	// derive mu, sigma of underlying normal
	variance := stdNs * stdNs
	m2 := meanNs * meanNs
	sigma2 := logApprox(1 + variance/m2)
	sigma := sqrt(sigma2)
	mu := logApprox(meanNs) - sigma2/2
	z := r.normal()
	return int64(expApprox(mu + sigma*z))
}

func (r *RNG) normal() float64 {
	// Box-Muller, one sample
	u1 := r.Float64()
	u2 := r.Float64()
	if u1 < 1e-12 {
		u1 = 1e-12
	}
	return sqrt(-2*logApprox(u1)) * cosApprox(2*3.141592653589793*u2)
}
