---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 24 — volume ports `ta.pvt`, `ta.eom`, `ta.nvi`,
`ta.pvi`. Closes the §9.2 volume list (excluding the 4 volume-
profile primitives deferred to Phase 5).

Ports four volume primitives from invinite (commit
`078f41fe2569d659d5aba726da8bcb5d3e2ced02`) onto the chartlang
runtime — each lands the §22.10 five-file set (impl + unit +
property + golden + bench pair) alongside an inline conformance
scenario and an auto-generated docs page:

- `ta.pvt(opts?)` — Price Volume Trend, cumulative `volume ·
  (close − prevClose) / prevClose`. First bar emits 0;
  zero-prevClose bars emit NaN AND carry the accumulator forward;
  NaN volume contributes 0. Warmup 1.
- `ta.eom(length, opts?)` — Ease of Movement, `length`-bar SMA of
  per-bar `((midpointMove) / boxRatio)` where `boxRatio = (volume
  / 10000) / (high − low)`. Hard-codes invinite's default divisor
  of 10000. Zero-range / zero-volume / NaN-input bars propagate
  NaN through the trailing window (forces a clean restart after
  any defective bar). Warmup `length`.
- `ta.nvi(opts?)` — Negative Volume Index, cumulative
  close-pct-change on bars whose volume is strictly LOWER than the
  prior bar's; bars with equal-or-higher volume carry the prior
  value unchanged. Seeded at 1000 (anchor pinned by property
  test). Warmup 1.
- `ta.pvi(opts?)` — Positive Volume Index, mirror of NVI on bars
  whose volume is strictly HIGHER than the prior bar's. Seeded at
  1000. Warmup 1.

Surface deltas:

- `TaNamespace` extends with the four new methods + opts types
  (`PvtOpts`, `EomOpts`, `NviOpts`, `PviOpts`). All four opts
  bags share the `{ offset?: number; lineStyle?: PlotLineStyle }`
  shape.
- `STATEFUL_PRIMITIVES` grows by four `slot: true` entries
  (86 → 90; `slot: true` count 85 → 89).
- `TA_REGISTRY` + `RuntimeTaNamespace` mirror the same delta
  (83 → 87). No new `TA_REGISTRY_METADATA` rows — all four are
  single-output `Series<number>` with auto y-domain.
- `PHASE_1_SCENARIOS` grows by four inline scenarios.

All four primitives carry the §16.6 100% coverage gate via their
five-file test set; golden hashes pinned against
`syntheticBars(100, 42)` (placeholder pin in the initial commit —
repinned on first deterministic green). Per-port bench thresholds
reuse the `THRESHOLD_MS = 300` ceiling from the existing volume
primitives.
