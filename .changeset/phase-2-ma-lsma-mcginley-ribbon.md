---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
"@invinite-org/chartlang-compiler": patch
---

Phase-2 Task 8 — final §9.2 MA ports (`ta.lsma`, `ta.mcginley`, `ta.maRibbon`).

Closes out the §9.2 moving-averages list. `ta.lsma` is the linear-
regression value at the trailing window (reuses Task-4's
`linearRegression` helper for the property-test reference);
`ta.mcginley` is the McGinley Dynamic recurrence with NaN-correct
zero-anchor handling; `ta.maRibbon` is a fan of K MAs at different
lengths, dispatched per-bar through `TA_REGISTRY`'s registered MA
primitives (`sma` / `ema` / `wma` / `smma`) via sub-slot ids
`${slotId}/ma_<length>`.

`MaRibbonResult` is a dynamic-keyed record `{ ma_<length>:
Series<number> }`. The exported `maRibbonOutputKeys(opts)` helper
returns the ordered keys for stable iteration. `maRibbon` is
registry-tagged as multi-output via `TA_REGISTRY_METADATA` with its
default `primarySeriesKey: "ma_50"` + default visible keys
`["ma_10", "ma_20", "ma_30", "ma_40", "ma_50"]` + `{ kind: "auto" }`
y-domain — runtime metadata for legend chips and pane axes.

Core also adds the `MaTypeNoVolume` string-literal union (parallel to
the runtime's `lib/maTypes.ts` alias) so script authors can type the
`maType` opt directly. Each primitive ships the §22.10 set (impl +
four test layers + conformance scenario + auto-generated docs page).

Compiler patch: the ambient shim mirrors the three new `TaNamespace`
methods + opt bags + `MaTypeNoVolume` alias + `MaRibbonResult` type.
