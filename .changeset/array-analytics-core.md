---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
---

Add numeric-reduction method signatures to `MutableArraySlot<number>` and a
pure frozen `array` namespace (Pine-parity free functions that delegate 1:1 to
the handle methods). Both reach the compiler ambient shim in lockstep.

New handle methods (signatures only — runtime bodies land in the
array-analytics runtime task): `sum`, `avg`, `min`, `max`, `range`,
`variance(biased?)`, `stdev(biased?)`, `median`, `percentile(p)`,
`indexOf(value)`, `includes(value)`, `sort(order?)` (returns a fresh sorted
`ReadonlyArray<number>` — never mutates the ring). Numeric reductions skip NaN
and return `NaN` for an empty / all-NaN window.

New exports: `array` (value) and `ArrayNamespace` (type) from
`@invinite-org/chartlang-core`.
