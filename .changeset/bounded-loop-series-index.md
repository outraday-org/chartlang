---
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-conformance": patch
---

Size series-index buffers precisely for provably-bounded indices.

`extractMaxLookback` now resolves a series read at a literal, a
bounded-`for` induction variable (`for (let i = 0; i < N; i++) src[i]`),
a `const` numeric literal, or an affine combination of those
(`src[i + 1]`, `src[K - i]`, `src[2 * i]`) to its exact `maxLookback`
contribution via a new compile-time interval resolver
(`resolveIndexUpperBound`) sharing one `parseBoundedForLoop` helper with
`forbiddenConstructs`. These indices no longer emit the
`dynamic-series-index` warning or force the 5000-slot `dynamicFallback`
buffer — they size the ring buffer exactly like a literal lookback. The
resolver over-approximates (never under-sizes); genuinely dynamic indices
(unbounded variables, unsupported operators, non-terminating loops,
reassigned loop variables) keep the warning + fallback. A new
`loop-sma` conformance scenario pins a `for`-loop SMA as bar-for-bar
identical to `ta.sma(close, 5)`.
