---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 22 — volume ports `ta.obv`, `ta.adl`, `ta.bop`, `ta.cmf`.

Ports four volume primitives from invinite (commit
`078f41fe2569d659d5aba726da8bcb5d3e2ced02`) onto the chartlang
runtime — each lands the §22.10 five-file set (impl + unit +
property + golden + bench pair) alongside an inline conformance
scenario and an auto-generated docs page:

- `ta.obv()` — On-Balance Volume, cumulative `sign(close − prevClose) ·
  volume`. Warmup 1 (bar 0 emits 0). Slot snapshots
  `prevClosedCumObv` / `prevClosedPrevClose` for tick-mode replay.
  NaN volume carries the accumulator forward without an update.
- `ta.adl()` — Accumulation / Distribution Line, cumulative
  `((C − L) − (H − C)) / (H − L) · volume`. Warmup 0. Zero-range
  bars (`high === low`) contribute 0 (matches invinite's CLV
  guard); NaN OHLC / volume contributes 0.
- `ta.bop()` — Balance of Power, raw per-bar `(C − O) / (H − L)`.
  Warmup 0; stateless math, output buffer only.
- `ta.cmf(length)` — Chaikin Money Flow, trailing-window
  `Σ MFV / Σ volume`. Warmup `length − 1`; bounded `[-1, 1]`.
  Tick-mode substitutes the head slot's contribution without
  mutating the rolling window (matches `ulcerIndex`'s shape).

Surface deltas:

- `TaNamespace` extends with the four new methods + opts types
  (`ObvOpts`, `AdlOpts`, `BopOpts`, `CmfOpts` — each `{ offset?;
  lineStyle? }`).
- `STATEFUL_PRIMITIVES` grows by four `slot: true` entries.
- `TA_REGISTRY` + `RuntimeTaNamespace` mirror the same delta;
  `PHASE_1_SCENARIOS` grows by four inline scenarios.

All four primitives carry the §16.6 100% coverage gate via their
five-file test set; golden hashes pinned against `syntheticBars(100,
42)`. Per-port bench thresholds reuse the `THRESHOLD_MS = 300`
ceiling from the existing volume primitives.
