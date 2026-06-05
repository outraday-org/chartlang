---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 13 — momentum ports (`ta.ao`, `ta.cmo`, `ta.momentum`,
`ta.roc`).

Ships four new momentum primitives under `packages/runtime/src/ta/`:

- `ta.ao(opts?)` — Awesome Oscillator. `SMA(hl2, fastLength) − SMA(hl2,
  slowLength)`. Defaults to Pine-canonical `5` / `34`. Composes two
  `ta.sma` sub-slots (`${slotId}/fastSma`, `${slotId}/slowSma`); a fix
  to `sma` flows in for free.
- `ta.cmo(source, length, opts?)` — Chande Momentum Oscillator. Range
  `[-100, 100]`. Trailing-window of per-bar gain / loss diffs with
  incremental sum maintenance + flat-line (zero-denominator) NaN
  guard.
- `ta.momentum(source, length, opts?)` — Pine `mom`. First-difference
  `source[0] − source[length]`. Implemented as a thin shim around
  `ta.change` (`${slotId}/change` sub-slot) — no private subtraction
  loop.
- `ta.roc(source, length, opts?)` — Rate of Change. `100 ×
  (source[0] − source[length]) / source[length]`. Zero lookback →
  NaN.

Each primitive ships the §22.10 set: impl + unit + property + golden +
bench pair + conformance scenario (using the Phase-2 `inlineSource`
extension from Task 1) + auto-generated `docs/primitives/ta/<id>.md`.

`STATEFUL_PRIMITIVES` gains four new `slot: true` entries; `TaNamespace`
+ `RuntimeTaNamespace` gain four new methods; `TA_REGISTRY` gains four
new entries. Four new opts types exported from core: `AoOpts`,
`CmoOpts`, `MomentumOpts`, `RocOpts` (each carries `offset?: number` and
`lineStyle?: PlotLineStyle` forward-compat fields; `AoOpts` also
carries `fastLength?: number`, `slowLength?: number`).

Provenance: ported from `invinite/src/components/trading-chart/
indicators/{ao,cmo,momentum,roc}.ts` at commit
`078f41fe2569d659d5aba726da8bcb5d3e2ced02`.
