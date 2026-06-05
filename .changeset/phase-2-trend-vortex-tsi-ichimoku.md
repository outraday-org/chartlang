---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 17 — trend ports: `ta.vortex`, `ta.trendStrengthIndex`,
`ta.ichimoku`.

Ships three new trend `ta.*` primitives under
`packages/runtime/src/ta/`:

- `ta.vortex(length, opts?)` — Botes & Siepman (2010) Vortex
  Indicator. Reads `bar.high` / `bar.low` / `bar.close` directly
  (mirrors Pine's `ta.vortex(length)` — no source param). Returns
  `{ plus, minus }` (the +VI / −VI lines). Maintains rolling
  running-sum windows over per-bar `vmPlus`, `vmMinus`, and TR for
  O(1) per-bar updates. NaN-on-zero-TR semantic per chartlang task
  spec §6 (invinite emits 0 on zero TR; chartlang surfaces the
  degenerate window).
- `ta.trendStrengthIndex(source, length, opts?)` — TradingView's
  Trend Strength Index: Pearson correlation between `source` and
  bar index over each trailing `length`-bar window. Bounded
  `[-1, +1]`. Default `length = 20` (chartlang task spec; invinite
  default is 14). Distinct from `ta.tsi` (Task 14's True Strength
  Index momentum oscillator) — name collision avoided via the
  longer `trendStrengthIndex` surface.
- `ta.ichimoku(opts?)` — Ichimoku Cloud (Tenkan / Kijun / Senkou A
  / Senkou B / Chikou). Defaults `(conversionLength=9, baseLength=
  26, leadingSpanBLength=52, displacement=26)`. Composes six
  `ta.highest` / `ta.lowest` sub-slots (one pair each for Tenkan /
  Kijun / Senkou B) — the same composition seam `ta.donchian` uses
  — so a fix to either rolling-extreme primitive flows in for free.
  Forward-displaced Senkou A / Senkou B and backward-displaced
  Chikou are produced via per-slot delay ring buffers of capacity
  `displacement + 1`. `chikou.current` returns `close[t −
  displacement]` (the backward-shifted close — programmatic
  semantic for script-author conditionals).

Each primitive ships the §22.10 set: impl + unit + property +
golden + bench pair + conformance scenario (using the Phase-2
`inlineSource` extension from Task 1) + auto-generated
`docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA` carries
y-domain + multi-output hints:

- `vortex: { primarySeriesKey: "plus", visibleSeriesKeys:
  ["plus", "minus"], yDomain: auto }`
- `trendStrengthIndex: { yDomain: fixed [-1, 1] }`
- `ichimoku: { primarySeriesKey: "tenkan", visibleSeriesKeys:
  ["tenkan", "kijun", "senkouA", "senkouB", "chikou"], yDomain:
  auto }` (the cloud renders via the Task-1 `filled-band` PlotKind
  between `senkouA` and `senkouB` — script-author drives the
  styling in their `plot()` call).

Reuse:

- Vortex's property test uses Phase-1 `lib/trSeries.ts`
  (`computeTrSeries`) as the per-bar TR reference; golden test
  pins the per-output hashes of a 100-bar Mulberry32 fixture.
- TrendStrengthIndex's property test uses Wave-3 `lib/pearson.ts`
  against a linear bar-index series as the reference.
- Ichimoku's property test uses Wave-3 `lib/donchianMid.ts` as the
  per-line reference (Tenkan / Kijun / SenkouB raw all share the
  same Donchian-midpoint math).

Core adds `VortexOpts`, `VortexResult`, `TrendStrengthIndexOpts`,
`IchimokuOpts`, `IchimokuResult` exports plus three new methods
on `TaNamespace` + three throwing stubs on the `ta` const.
`STATEFUL_PRIMITIVES` grows by 3 (`ta.vortex`,
`ta.trendStrengthIndex`, `ta.ichimoku`; all `slot: true`) — final
Phase-2 size 93. `TA_REGISTRY` grows by 3 — final size 90.
Conformance scenarios + `PHASE_1_SCENARIOS` array grow by 3.
