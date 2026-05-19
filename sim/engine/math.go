package engine

import "math"

// Wrappers exist so we can swap to lookup tables or polynomial approximations
// if TinyGo math costs are too high. Keep call sites stable.

func logApprox(x float64) float64  { return math.Log(x) }
func expApprox(x float64) float64  { return math.Exp(x) }
func sqrt(x float64) float64       { return math.Sqrt(x) }
func cosApprox(x float64) float64  { return math.Cos(x) }
