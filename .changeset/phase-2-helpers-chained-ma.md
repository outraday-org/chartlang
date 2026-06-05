---
"@invinite-org/chartlang-runtime": patch
---

Phase-2 Task 3 — chained-MA helper family.

Ports the WMA / SMMA / VWMA cores from invinite (commit
`078f41fe2569d659d5aba726da8bcb5d3e2ced02`) into
`packages/runtime/src/ta/lib/` and adds the MA-kind dispatcher pair
(`computeMaOfFloat64` excludes `vwma` at the type level via
`MaTypeNoVolume`; `computeMa` routes `vwma` through the volume-aware
`vwmaFloat64` helper and throws a structured `TypeError`
(`code = "ta-lib-vwma-requires-volume"`) when called with a null
volume array). The `maTypes.ts` module exports the canonical
`MaType` union + the `MaTypeNoVolume` excluder.

NaN propagation matches invinite per-helper: the recurrence-based
`smmaFloat64` holds the prior value forward on a mid-stream NaN
(matches `emaFloat64`); the full-recompute window helpers
`wmaFloat64` and `vwmaFloat64` short-circuit a window to NaN if any
slot in it is NaN. VWMA also emits NaN when the trailing-window
volume sum is zero.

These helpers back ~22 of the §9.2 ports landing in Tasks 6–28:
every MA primitive (Tasks 6–8), every BB / Keltner / Envelope / Chop
/ Donchian middle override (Tasks 18–19), every MACD / PPO / PVO
signal line (Tasks 10, 23). No public surface change yet — runtime-
internal helpers only; the public delta lands per-port in subsequent
tasks. Each new compute core ships the §16.3 four-file test set
(`.test.ts`, `.property.test.ts`, `.bench.ts`, `.bench.test.ts`);
the two dispatchers ship `.test.ts` only (they delegate the entire
hot loop to the cores).
