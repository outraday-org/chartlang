---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 26 — S/R ports: `ta.chandelier`, `ta.chandeKrollStop`,
`ta.williamsFractal`.

Ships three new S/R `ta.*` primitives under
`packages/runtime/src/ta/`:

- `ta.chandelier(opts?)` — Chandelier Exit returning
  `{ long, short }`. Composes Phase-1 `ta.atr` plus Task-5
  `ta.highest` / `ta.lowest` at sub-slots `${slotId}/atr` /
  `${slotId}/highHigh` / `${slotId}/lowLow`. `long = highest(high,
  length) − multiplier · atr(length)`; `short` symmetric. Defaults
  `length = 22`, `multiplier = 3` per Pine canonical. Source
  hard-coded to `bar.high` / `bar.low` (deliberate divergence from
  invinite's `source` parameter — matches Pine `ta.chandelier_exit`).

- `ta.chandeKrollStop(opts?)` — Chande Kroll Stop returning
  `{ long, short }`. Two-pass smoothed trailing stop: first pass
  computes `firstHigh = highest(high, length) − multiplier · atr` /
  `firstLow = lowest(low, length) + multiplier · atr` (composed via
  `ta.atr` + `ta.highest` / `ta.lowest` sub-slots); second pass
  walks a slot-owned `Float64RingBuffer` of size `smoothingLength`
  for the rolling max / min. Defaults `length = 10`, `multiplier = 1`,
  `smoothingLength = 9` (matches Chande Kroll's 1995 paper).

- `ta.williamsFractal(opts?)` — Williams Fractal returning
  `{ up, down }` as **price-level series** (NaN when no fractal,
  `bar.high(centre)` for up-fractal, `bar.low(centre)` for down).
  Self-contained centred-window scan over a `2 · length + 1` ring
  buffer per side. Output is centred: at live bar `t`, the value
  emitted reflects bar `t − length`'s fractal status (when bar `t`
  closes, we now have the right-window bars to confirm bar
  `t − length`). Default `length = 2` (5-bar window). Strict
  comparison: tied highs/lows in the window → no fractal.

  Deviation from the task spec's literal `Series<boolean>` wording:
  emits price levels instead so the `marker` plot has a meaningful
  y-anchor. Matches invinite's `upFractals[i] = high` shape.

Each primitive ships the §22.10 set (impl + unit + property + golden
hash + bench pair) plus a `taChandelier.scenario.ts`,
`taChandeKrollStop.scenario.ts`, and `taWilliamsFractal.scenario.ts`
conformance scenario. JSDoc per §17.2 with `@formula`, `@warmup`,
`@since 0.2`, `@experimental`, `@example`, and `@anchors`.

**`PlotOptsStyle` marker widening (core + runtime + compiler shim).**
Adds the `marker` variant to `PlotOptsStyle` in core (mirrors the
adapter-kit's `PlotStyle.marker` shape declared by Task 1), the
matching dispatch branch to `buildStyle` in
`packages/runtime/src/emit/plot.ts`, and the same widening in the
compiler's ambient shim. The Williams Fractal scenario is the first
to exercise the marker plot kind end-to-end. The cap-gated dispatch
path is unit-covered in `plot.test.ts`'s new marker case.

`TaNamespace` (core) and `RuntimeTaNamespace` (runtime) extend with
three new methods + matching opts / result types. `STATEFUL_PRIMITIVES`
appends three new `slot: true` entries. `TA_REGISTRY` adds three
entries plus `TA_REGISTRY_METADATA` records for each
(`primarySeriesKey` / `visibleSeriesKeys` / `yDomain = auto`).

Auto-generated documentation pages land at
`docs/primitives/ta/{chandelier,chandeKrollStop,williamsFractal}.md`
via the Task-2 generator. The `docs/primitives/ta/index.md` carries a
new "S/R (Task 26)" subsection.
