package engine

// EventHeap is a min-heap of Event ordered by (Time, Seq).
// We implement container/heap manually to keep TinyGo bundle small and
// avoid the interface dispatch overhead of container/heap.
type EventHeap struct {
	items []Event
}

func NewEventHeap(cap int) *EventHeap {
	return &EventHeap{items: make([]Event, 0, cap)}
}

func (h *EventHeap) Len() int { return len(h.items) }

func (h *EventHeap) less(i, j int) bool {
	a, b := h.items[i], h.items[j]
	if a.Time != b.Time {
		return a.Time < b.Time
	}
	return a.Seq < b.Seq
}

func (h *EventHeap) Push(e Event) {
	h.items = append(h.items, e)
	h.up(len(h.items) - 1)
}

func (h *EventHeap) Pop() (Event, bool) {
	n := len(h.items)
	if n == 0 {
		return Event{}, false
	}
	top := h.items[0]
	h.items[0] = h.items[n-1]
	h.items = h.items[:n-1]
	if n > 1 {
		h.down(0)
	}
	return top, true
}

func (h *EventHeap) Peek() (Event, bool) {
	if len(h.items) == 0 {
		return Event{}, false
	}
	return h.items[0], true
}

func (h *EventHeap) up(i int) {
	for i > 0 {
		parent := (i - 1) / 2
		if !h.less(i, parent) {
			return
		}
		h.items[i], h.items[parent] = h.items[parent], h.items[i]
		i = parent
	}
}

func (h *EventHeap) down(i int) {
	n := len(h.items)
	for {
		l := 2*i + 1
		if l >= n {
			return
		}
		smallest := l
		if r := l + 1; r < n && h.less(r, l) {
			smallest = r
		}
		if !h.less(smallest, i) {
			return
		}
		h.items[i], h.items[smallest] = h.items[smallest], h.items[i]
		i = smallest
	}
}
