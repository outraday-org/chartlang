---
"@invinite-org/chartlang-conformance": minor
---

Add the `rsi-subpane-routing` conformance scenario and a new
`all-plots-on-pane` `ScenarioAssertion` variant. The scenario pins the
`subpane-rendering` contract: a `defineIndicator({ overlay: false })`
script routes every `plot()` + `hline()` to its `script:<sanitised-name>`
pane and pushes no `unsupported-pane` diagnostic when the adapter
declares `subPanes >= 1`. `all-plots-on-pane` asserts every emitted
`PlotEmission.pane` equals one expected key and reports the first
divergent emission's `slotId` / `pane` on failure.

Step 5 (final) of the `subpane-rendering` feature. The
`examples/react-demo` catalogue also gains an `explicit-pane-routing`
demo (an `EMA(20)` on the price pane + an `RSI(14)` routed to a named
subpane via `plot(..., { pane: "rsi" })`); the two existing
`overlay: false` RSI demos now render in a real subpane with no source
edit.
