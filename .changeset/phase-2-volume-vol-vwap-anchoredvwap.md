---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
"chartlang-example-canvas2d-adapter": patch
---

Phase-2 Task 21 — port the three foundational volume primitives:

- **`ta.vol(opts?)`** — passthrough of `bar.volume` as a `Series<number>`.
  Warmup 0; NaN volume propagates to NaN output.
- **`ta.vwap(opts?)`** — session-anchored VWAP keyed on the UTC
  calendar-day boundary (`floor(bar.time / 86_400_000)`). Phase 4
  lifts the session detection to `syminfo.session.regularStart` per
  invinite; until then `ta.vwap` is a UTC-day-anchored VWAP.
  Source defaults to `"hlc3"` per Pine; accepts `"close"` / `"hl2"` /
  `"ohlc4"` / `"hlcc4"`.
- **`ta.anchoredVwap(anchorTime, opts?)`** — anchored VWAP that
  starts accumulating at the first bar with `bar.time >= anchorTime`
  and never resets. The anchor is sticky (captured on the first
  call; later anchor args are ignored). Phase 4's `input.time()`
  lifts the anchor to a runtime user input.

All three carry the §22.10 five-file set + JSDoc with
`@formula`/`@warmup`/`@since 0.2`/`@experimental`/`@example`; all
register in `STATEFUL_PRIMITIVES` as `slot: true` and in
`TA_REGISTRY` / `RuntimeTaNamespace`.

### `PlotOpts.style?` widening

To exercise the Task-1 `histogram` PlotKind end-to-end on
`ta.vol`, this PR widens the script-facing `PlotOpts` with an
optional `style?: PlotOptsStyle` discriminated-union field
(`{ kind: "line" }` | `{ kind: "step-line" }` |
`{ kind: "histogram"; baseline?: number }`). The runtime's
`plot()` impl honours the field; the canvas2d reference adapter
dispatches `kind: "histogram"` through Task-1's `drawHistogram`
renderer. Backward-compatible — omitting `opts.style` keeps the
existing `kind: "line"` default.

Future ports adding their own PlotKind (e.g. MACD-hist in Task 16,
`bars` / `area` / `filled-band` / `label` / `marker` in their
consumer ports) extend this same `PlotOptsStyle` union additively
and add their dispatch arm to `createCanvas2dAdapter.applyPlot`.

### Conformance scenarios

- `taVol.scenario.ts` — `plot(ta.vol(), { style: { kind: "histogram", baseline: 0 } })`.
- `taVwap.scenario.ts` — `plot(ta.vwap({ source: "hlc3" }))`.
- `taAnchoredVwap.scenario.ts` — `plot(ta.anchoredVwap(1_700_000_000_000))`.

### Provenance

All three ports trace to `invinite/src/components/trading-chart/
indicators/{vol,vwap,anchored-vwap}.ts` at commit
`078f41fe2569d659d5aba726da8bcb5d3e2ced02`.
