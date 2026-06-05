---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 23 — volume ports `ta.chaikinOsc`, `ta.mfi`,
`ta.netVolume`, `ta.pvo`.

Ports four volume primitives from invinite (commit
`078f41fe2569d659d5aba726da8bcb5d3e2ced02`) onto the chartlang
runtime — each lands the §22.10 five-file set (impl + unit +
property + golden + bench pair) alongside an inline conformance
scenario and an auto-generated docs page:

- `ta.chaikinOsc(opts?)` — Chaikin Oscillator, `EMA(ADL, fast) −
  EMA(ADL, slow)`. Defaults `(3, 10)`. Composes one `ta.adl`
  sub-slot + two `ta.ema` sub-slots; a fix to either flows in for
  free. Warmup `slowLength − 1`.
- `ta.mfi(length, opts?)` — Money Flow Index, volume-weighted RSI
  over a trailing window of typical-price comparisons. Bounded
  `[0, 100]`; emits 100 on perfect upflow, 0 on perfect downflow,
  NaN on zero total flow (invinite's zero-denominator guard).
  Warmup `length + 1`.
- `ta.netVolume(opts?)` — cumulative `sign(close − prevClose) ·
  volume`. **Math is identical to `ta.obv`** (both primitives
  exist in invinite under their own names; chartlang mirrors the
  public surface for naming parity). Property-tested for
  hash-equality against `ta.obv` over a 100-bar synthetic walk.
  Warmup 1 (bar 0 emits 0).
- `ta.pvo(opts?)` — Percentage Volume Oscillator, MACD shape on
  `bar.volume`. Defaults `(12, 26, 9)`. Composes three `ta.ema`
  sub-slots over volume. Multi-output `{ pvo, signal, hist }`;
  `TA_REGISTRY_METADATA.pvo` records `primarySeriesKey: "pvo"`,
  `visibleSeriesKeys: ["pvo", "signal", "hist"]`, `yDomain: {
  kind: "auto" }`. Warmup `slowLength + signalLength − 2`.

Surface deltas:

- `TaNamespace` extends with the four new methods + opts types
  (`ChaikinOscOpts`, `MfiOpts`, `NetVolumeOpts`, `PvoOpts` +
  `PvoResult`).
- `STATEFUL_PRIMITIVES` grows by four `slot: true` entries.
- `TA_REGISTRY` + `RuntimeTaNamespace` mirror the same delta;
  `TA_REGISTRY_METADATA.pvo` carries the multi-series metadata;
  `PHASE_1_SCENARIOS` grows by four inline scenarios.

All four primitives carry the §16.6 100% coverage gate via their
five-file test set; golden hashes pinned against `syntheticBars(100,
42)` (placeholder pin in the initial commit — repinned on first
deterministic green). Per-port bench thresholds reuse the
`THRESHOLD_MS = 300` ceiling from the existing volume primitives.
