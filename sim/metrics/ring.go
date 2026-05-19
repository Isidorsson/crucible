package metrics

// LatencyRing is a fixed-size circular buffer of latency samples (nanoseconds).
// Used per-node to compute rolling percentiles cheaply.
//
// Percentile cost: O(n log n) on Snapshot() via in-place sort of a copy.
// Default capacity 512 keeps that under 100us even on cheap hardware.
type LatencyRing struct {
	buf   []int64
	head  int
	count int
}

func NewLatencyRing(capacity int) *LatencyRing {
	return &LatencyRing{buf: make([]int64, capacity)}
}

func (r *LatencyRing) Add(ns int64) {
	r.buf[r.head] = ns
	r.head = (r.head + 1) % len(r.buf)
	if r.count < len(r.buf) {
		r.count++
	}
}

func (r *LatencyRing) Percentile(p float64) int64 {
	if r.count == 0 {
		return 0
	}
	tmp := make([]int64, r.count)
	copy(tmp, r.buf[:r.count])
	sortInts(tmp)
	idx := int(float64(r.count-1) * p)
	if idx < 0 {
		idx = 0
	}
	if idx >= r.count {
		idx = r.count - 1
	}
	return tmp[idx]
}

func (r *LatencyRing) Len() int { return r.count }

// insertion sort: small N, cache friendly, smaller than sort.Slice in TinyGo
func sortInts(a []int64) {
	for i := 1; i < len(a); i++ {
		x := a[i]
		j := i - 1
		for j >= 0 && a[j] > x {
			a[j+1] = a[j]
			j--
		}
		a[j+1] = x
	}
}
