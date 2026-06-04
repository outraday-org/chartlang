---
"@invinite-org/chartlang-conformance": minor
"@invinite-org/chartlang-compiler": patch
---

Phase-1 walking-skeleton: ship the conformance suite
(`@invinite-org/chartlang-conformance`). The package now exports
`runConformanceSuite(adapter, opts?)`, three pinned Phase-1
scenarios (`EMA_CROSS_SCENARIO`, `BOLLINGER_BANDS_SCENARIO`,
`RSI_DIVERGENCE_SCENARIO` + the `PHASE_1_SCENARIOS` aggregate), the
deterministic 10 000-bar `goldenBars.json` fixture (Mulberry32 seed
`0xC0DE`, four 2 500-bar regimes), and the
`generateGoldenBars` / `serialiseGoldenBars` / `writeGoldenBars` /
`GOLDEN_BARS_PATH` helpers. Closes the Phase-0
`scripts/run-conformance.ts` short-circuit: `pnpm conformance` now
runs the three scenarios end-to-end through the compiler + runtime
against `examples/canvas2d-adapter`'s default export and prints
`conformance: 3 scenarios passed, 0 failures.`.

The `RSI_DIVERGENCE_SCENARIO` re-pins `alert-count` from `0` to
`433` and adds two `alert-message-contains` assertions
(`"RSI dropped below 70"`, `"RSI rose above 30"`). The original
scenario codified a dead-code path in
`examples/scripts/rsi-divergence-alert.chart.ts` — the `rsi.current
&gt; 70 && ta.crossunder(rsi, 70).current` guard was a
contradiction (crossunder requires the current value to be below
the threshold) so the overbought / oversold exit alerts could
never fire. The script now uses `ta.crossunder(rsi, 70).current`
and `ta.crossover(rsi, 30).current` directly.

`@invinite-org/chartlang-compiler` rides along with a one-line patch
to `transformers/resolveCallee.ts`: the callsite-id transformer now
also rewrites stateful calls on parameters destructured from
`compute({ ta, plot, alert, hline })` (the previous code only
matched top-level imports, so the example scripts under
`examples/scripts/` would have thrown the "outside an active script
step" sentinel at runtime). Discovered while wiring the conformance
runner against the on-disk example scripts; covered by new
`resolveCallee.test.ts` cases.
