---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
"@invinite-org/chartlang-compiler": patch
---

Phase-2 Task 6 — MA ports (`ta.wma`, `ta.vwma`, `ta.hma`, `ta.smma`).

Adds four moving-average primitives on top of the Task-3 chained-MA
helpers. `ta.wma` is a linear-weighted MA over the trailing window;
`ta.vwma` is the volume-weighted variant; `ta.smma` is Wilder's
smoothed MA (α = 1/N); `ta.hma` is the Hull MA composed via three WMA
sub-slots derived from the parent slot id (`${slotId}/half`,
`${slotId}/full`, `${slotId}/final`).

Each primitive ships the §22.10 set (impl + four test layers +
conformance scenario + auto-generated docs page). The opts bags
(`WmaOpts`, `VwmaOpts`, `HmaOpts`, `SmmaOpts`) carry the universal
`offset` + `lineStyle` fields — typed surface only; the runtime
wiring lands in Task 29's universal-offset backfill.

Compiler patch: the ambient shim mirrors the four new
`TaNamespace` methods + opt bags.
