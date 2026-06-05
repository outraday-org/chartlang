---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
"@invinite-org/chartlang-compiler": patch
---

Phase-2 Task 7 — MA ports (`ta.dema`, `ta.tema`, `ta.kama`, `ta.alma`).

Adds four chained / adaptive moving averages on top of the Phase-1
EMA primitive + the Task-6 MA backbone. DEMA / TEMA compose EMA
sub-slots through `TA_REGISTRY` (`${slotId}/ema1` / `/ema2` / `/ema3`);
KAMA is Kaufman's adaptive MA with an efficiency-ratio-driven
smoothing constant; ALMA is the Arnaud Legoux MA with a precomputed
Gaussian weight kernel.

Each primitive ships the §22.10 set (impl + four test layers +
conformance scenario + auto-generated docs page). ALMA's `offset`
opt is the Gaussian-centre position in `[0, 1]` (default `0.85`) —
distinct from the universal bar-shift, which lives on `opts.barShift`
for ALMA only.

Compiler patch: the ambient shim mirrors the four new
`TaNamespace` methods + opt bags.
