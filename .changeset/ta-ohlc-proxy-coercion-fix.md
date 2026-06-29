---
"@invinite-org/chartlang-runtime": patch
"@invinite-org/chartlang-conformance": patch
---

Fix a real-path NaN bug across the `ta.*` OHLC-sourcing primitive family.
`bar.high`/`.low`/`.close`/`.open`/`.volume` (and the derived `hl2`/`hlc3`/…)
are number-coercible `makeSeriesView` proxies, not primitive numbers, so any
primitive that read one and passed it to `Number.isFinite(...)` (or stored it
as a `number`) bailed to its NaN fallback on every real bar. The unit harness
(`ta/__fixtures__/runPrimitive.ts`) masked it by overwriting the bar fields
with plain numbers each step; it now keeps the real proxies, matching
`onBarClose`.

Each affected primitive now coerces at the read (`+bar.x`) when the value is
used as a scalar, while keeping the proxy when it is passed as a `Series`
source to `highest`/`lowest`/`dispatchMa`. Primitives fixed: `atr`, `adx`,
`dmi`, `vortex`, `ultimateOsc`, `pivotsStandard`, `psar`, `aroon`, `adr`,
`zigZag`, `supertrend`, `volatilityStop`, `adl`, `obv`, `bop`, `cmf`, `eom`,
`klinger`, `mfi`, `netVolume`, `nvi`, `pvi`, `pvt`, `rvgi`, `vwap`,
`anchoredVwap`, `vwma`, and the mixed series/scalar `chop`, `williamsR`,
`fisher`, `pivotsHighLow`. The math is byte-identical to the pinned goldens.

Conformance: the `ta.atr`/`ta.adx`/`ta.dmi`/`ta.vwap`/`ta.williamsR` scenarios
now pin a `plot-hash` so the real-path (non-NaN) output is value-checked and
can't silently regress.
