---
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-runtime": minor
"chartlang-example-canvas2d-adapter": minor
"@invinite-org/chartlang-conformance": minor
---

Phase 3 Task 10 — Channels (`trendChannel` / `flatTopBottom` /
`disjointChannel` / `regressionTrend`).

- **adapter-kit** — 4 new per-kind validators (`validateTrendChannelState`,
  `validateFlatTopBottomState`, `validateDisjointChannelState`,
  `validateRegressionTrendState`) + 1 file-local style helper
  (`validateRegressionTrendOpts` with the
  `close|open|high|low|hl2|hlc3|ohlc4|hlcc4` source whitelist). The
  `regression-trend` validator enforces `anchors[0].time <
  anchors[1].time` and `stdevMultiplier >= 0`.
- **runtime** — 4 new emit functions under
  `packages/runtime/src/emit/draw/channels/` wired into `DRAW_NAMESPACE`.
  `regressionTrend` carries the 4-arg form
  `(slotId, a: WorldPoint, b: WorldPoint, opts?)`. The Phase-2
  `linearRegression` + `LinearRegressionFrame` helper graduates to the
  public runtime surface so consumer adapters can compute the OLS fit
  without duplicating math.
- **canvas2d-adapter** — 4 new renderers + dispatch wiring. The
  `regression-trend` renderer strokes a placeholder anchor-to-anchor
  line; the actual OLS fit + σ bands require bar-buffer access not
  exposed by the current `Viewport` (see
  `tasks/phase-3-drawing-parity/10-channels.plan.md` §3). `trendChannel`
  / `flatTopBottom` / `disjointChannel` are stroke-only (no fill polygon
  between rails — see plan §5).
- **conformance** — 5 new scenarios (4 per-kind + 1
  `drawChannelsAll` bundle) with pinned `drawing-hash` assertions.

See `tasks/phase-3-drawing-parity/10-channels.plan.md` for the full
audit + divergence flags.
