---
"@invinite-org/chartlang-runtime": minor
---

Port the nine Phase-1 `ta.*` primitives (`sma` / `ema` / `stdev` / `bb`
/ `rsi` / `macd` / `atr` / `crossover` / `crossunder`) plus the shared
math helpers (`applyOffset`, `readSourceField`, `pickCandleSource`,
`smaFloat64`, `emaFloat64`, `rollingStddev`, `trSeries`,
`wilderSmoothing`) from the invinite reference math at HEAD
`d2d1043c1b039f66d2f3674526d303d31cf2f1e0`. Each primitive ships with
the §16.6 five-file test set (impl + unit + property + golden +
bench-threshold pair) and uses the chartlang primitive shape — a
slot-aware function with cached `Series<T>` output identity, an
`onBarTick` head-replace mode, and JSON-clean slot state for Phase-5
persistence. The runtime barrel re-exports `ta` (the script-facing
namespace, identity-equal to `TA_REGISTRY`), `TA_REGISTRY` (the
frozen 9-entry map Task 9's worker boot iterates), and
`RuntimeTaNamespace` (the slot-prefixed type). `primitives.ts` swaps
its `ta` throw-stub body for the real registry while preserving
identity, so `buildComputeContext` and `createScriptRunner` need no
change. BB and MACD compose their sub-EMAs / SMA / stdev via derived
sub-slot ids — a fix to a leaf primitive propagates for free.
