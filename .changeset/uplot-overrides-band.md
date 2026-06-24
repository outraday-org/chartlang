---
---

Paint the substrate / series plot kinds the uPlot reference adapter buffered
but never drew, fix `filled-band`, and fix `visible: false`:

- **`candle-override` / `bar-override` now recolour candles** through one
  shared per-bar tint resolver (`resolveCandleTint`): `applyPlot` projects each
  into a per-bar map keyed by bar time, and the candle paint resolves a single
  tint per bar with precedence **candle-override (direction-resolved) >
  bar-override > bar-color** (mirroring canvas2d). `candle-override`'s
  bull/bear/doji colour is picked by the bar's own direction
  (`resolveCandleOverrideColor` — `close > open ⇒ bull`, `close < open ⇒ bear`,
  else `doji ?? bull`; a first-party translation of canvas2d's
  `render/candleOverride.ts`). The tint threads into `ProjectedCandle.color`
  (body + wick), so `drawCandlePaths` paints it with no parallel pass.
- **`horizontal-histogram` now paints** its volume-profile buckets in the
  overlay draw hook: right-anchored bars whose width scales by
  `volume / maxVolume`, at `y = u.valToPos(price, "y", true)` (bbox-clipped; a
  non-finite y or an all-zero-volume profile is skipped). Buckets honour
  `bucket.color`, defaulting otherwise.
- **`filled-band` now renders the upper/lower REGION** as a native two-edge
  uPlot band: `buildPaneData` emits two aligned rows (upper, lower; a `null`
  edge is a per-bar gap) and `buildPaneSeries` emits two adjacent specs plus a
  `UplotBandSpec` linking their series indices, with the fill folded to
  `rgba()` at the style's `alpha`. The single-edge render was the bug.
- **`visible: false` now KEEPS the slot listed** but paints nothing and never
  stretches the y-scale (a hidden series registers an empty row; a hidden
  non-series kind registers nothing painted) — canvas2d's "hidden but declared"
  semantics. The prior early-return dropped the slot entirely.

Coverage stays at 100%; conformance stays green; the integration `PINNED_HASH`
is untouched (its bundle emits none of these kinds). Private example package —
no published surface; empty changeset.
