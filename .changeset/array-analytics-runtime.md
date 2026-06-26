---
"@invinite-org/chartlang-runtime": minor
---

Implement the `MutableArraySlot<number>` numeric-reduction bodies on the
`state.array` runtime handle: `sum`, `avg`, `min`, `max`, `range`,
`variance(biased?)`, `stdev(biased?)`, `median`, `percentile(p)`,
`indexOf(value)`, `includes(value)`, `sort(order?)`. Each reads the slot's
tentative ring's filled region directly (O(size) via `at(i)`, never the handle's
`get(n)` proxy). The Pine-parity `array.*` namespace delegates to these methods,
so there is one implementation.

Semantics: statistical reductions skip `NaN` (empty / all-`NaN` window → `NaN`,
never `0`); variance is the numerically-stable Welford single pass (population
by default, sample when `biased === false`, `NaN` when `count < 2`);
median/percentile use linear interpolation between closest ranks (`percentile`
clamps `p` to `[0, 100]`); `indexOf` is strict (cannot find `NaN`) while
`includes` is SameValueZero (finds `NaN`); `sort` returns a fresh sorted copy
and never mutates the ring. Lands unit + property + golden tests.
