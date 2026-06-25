---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
---

Add the pure, frozen `math` namespace to core (and mirror it in the compiler
ambient shim) carrying only the chart-aware / Pine-parity scalar helpers bare
`Math` lacks. Bare `Math.*` (except `Math.random`) stays available in
`compute`; `math` does **not** re-wrap it.

New core exports (also available as a frozen `math.*` namespace):

- `math.roundTo(value, step)` / `math.roundToMintick(value, mintick)` —
  round to the nearest integer multiple of `step` (price-snapping); a
  non-positive / non-finite step is a no-op.
- `math.na(value)` — `true` when `value` is NaN or `±Infinity` (the scalar
  twin of the series-aware `ta.nz` family).
- `math.nz(value, replacement?)` — scalar NaN-coalesce → `replacement ?? 0`.
- `math.fixnan(value, lastGood)` — `na(value) ? lastGood : value`.
- `math.sign(value)`, `math.clamp(value, lo, hi)`.
- `math.avg(...values)` / `math.sum(...values)` — variadic skip-NaN scalar
  reducers (NaN on an empty / all-non-finite list).

`MathNamespace` (`typeof math`) is exported alongside it.
