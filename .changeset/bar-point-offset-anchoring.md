---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-pine-converter": patch
---

Add `bar.point(offset, price)` — index authoring sugar for anchoring drawings
by bar offset instead of an absolute timestamp.

`bar.point` resolves the offset to the existing time-based `WorldPoint`
(`{ time, price }`) at compute time, so it composes directly with every
`draw.*` anchor argument and introduces no new wire format or anchor union:

- `bar.point(0, price)` — the current bar.
- `bar.point(-n, price)` — `n` bars back, using the real historical timestamp
  from the runtime's time ring buffer (`NaN` time past retained history; never
  throws).
- `bar.point(n, price)` — a future bar, with the time extrapolated from the
  median recent bar spacing (falling back to the parsed bar interval when
  fewer than two bars are retained).

The compiler's max-lookback analysis now counts a negative integer-literal
`bar.point(-n, …)` offset toward `maxLookback` exactly like a `series[n]`
lookback, so the runtime sizes the time buffer deeply enough; positive (future)
offsets and dynamic offsets contribute no extra depth. The recogniser peels
parentheses, so the converter's emitted form `bar.point(-(n), …)` is sized
identically to a hand-written `bar.point(-n, …)` (without it, a converted
historical tracking line sized its buffer to 0 and resolved to a NaN anchor).

The Pine v6 converter now lowers `bar_index` drawing anchors to
`bar.point(<signed offset>, <price>)` and drops the dead `__BAR_INTERVAL_MS`
sentinel and its `bar.time ± (N * __BAR_INTERVAL_MS)` arithmetic — future
anchors resolve at runtime instead of needing a host-supplied bar interval.
