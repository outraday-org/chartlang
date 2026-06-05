---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 16 — trend ports: `ta.adx`, `ta.dmi`, `ta.trix`.

Ships three new trend `ta.*` primitives under
`packages/runtime/src/ta/`:

- `ta.adx(length, opts?)` — Wilder's Average Directional Index
  (single Series bounded `[0, 100]`). Reads `bar.high` /
  `bar.low` / `bar.close` directly (mirrors Pine's `ta.adx(length)`
  — no source param). Composes the same Wilder DI recurrence
  `ta.dmi` runs, then folds DX through a second
  Wilder-smoothing window of length `opts.smoothing ?? 14`.
- `ta.dmi(length, opts?)` — Wilder's Directional Movement Index
  (`{ plusDi, minusDi }`, both ∈ [0, 100]). Reads OHLC directly
  per Pine's `ta.dmi(length)`. Incremental `wilderStep` over
  `+DM` / `−DM` / TR; output validated against the
  full-recompute reference `lib/wilderDirectional`.
- `ta.trix(source, length, opts?)` — TRIX triple-smoothed EMA
  rate-of-change with an EMA-signal line (`{ trix, signal }`).
  Composes three EMA sub-slots (`${slotId}/ema1` / `/ema2` /
  `/ema3`) for the triple chain + a fourth `${slotId}/signal`
  EMA, mirroring the MACD sub-slot composition pattern.

Each primitive ships the §22.10 set: impl + unit + property +
golden + bench pair + conformance scenario (using the Phase-2
`inlineSource` extension from Task 1) + auto-generated
`docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA` carries
y-domain + multi-output hints (`adx: { yDomain: fixed 0-100 }`,
`dmi: { primarySeriesKey: "plusDi", visibleSeriesKeys: ["plusDi",
"minusDi"], yDomain: fixed 0-100 }`, `trix: { primarySeriesKey:
"trix", visibleSeriesKeys: ["trix", "signal"], yDomain: auto }`).

ADX / DMI reuse Phase-1 `lib/wilderSmoothing` (`wilderStep`) for
the per-bar Wilder recurrence and Wave-3 Task-4
`lib/wilderDirectional` + `lib/adxFromDi` as the property-test
reference (Float64Array-in / Float64Array-out full-recompute).
TRIX reuses Phase-1 `lib/emaFloat64` (`computeEmaOfFloat64`) as
the property-test reference plus the runtime `ta.ema` primitive
for the four composed sub-slots.

Core adds `AdxOpts`, `DmiOpts`, `DmiResult`, `TrixOpts`,
`TrixResult` exports plus three new methods on `TaNamespace`.
`STATEFUL_PRIMITIVES` grows by 3 (`ta.adx`, `ta.dmi`, `ta.trix`;
all `slot: true`). `TA_REGISTRY` mirrors with the leading
`slotId: string` on each method.
