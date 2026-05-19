package metrics

// ThroughputWindow tracks events-per-second over a sliding window using
// a coarse bucketed approach (default 10 buckets of 100ms = 1s window).
//
// Cheap: O(1) Add, O(buckets) Rate.
type ThroughputWindow struct {
	bucketNs int64
	buckets  []uint32
	lastBin  int64
}

func NewThroughputWindow(bucketNs int64, count int) *ThroughputWindow {
	return &ThroughputWindow{bucketNs: bucketNs, buckets: make([]uint32, count)}
}

func (w *ThroughputWindow) Add(nowNs int64) {
	w.rotate(nowNs)
	w.buckets[len(w.buckets)-1]++
}

func (w *ThroughputWindow) rotate(nowNs int64) {
	bin := nowNs / w.bucketNs
	if bin == w.lastBin {
		return
	}
	shift := int(bin - w.lastBin)
	if shift >= len(w.buckets) {
		for i := range w.buckets {
			w.buckets[i] = 0
		}
	} else {
		copy(w.buckets, w.buckets[shift:])
		for i := len(w.buckets) - shift; i < len(w.buckets); i++ {
			w.buckets[i] = 0
		}
	}
	w.lastBin = bin
}

// Rate returns events per second over the full window.
func (w *ThroughputWindow) Rate(nowNs int64) float64 {
	w.rotate(nowNs)
	var sum uint32
	for _, b := range w.buckets {
		sum += b
	}
	windowSec := float64(w.bucketNs*int64(len(w.buckets))) / 1e9
	if windowSec <= 0 {
		return 0
	}
	return float64(sum) / windowSec
}
