---
"@invinite-org/chartlang-pine-converter": patch
---

Hoist bar-invariant captures into `request.security` expression callbacks so
they compile. A higher-timeframe callback runs on a separate clock, so the
chartlang compiler rejects any callback that captures a main-timeline binding
(`request-security-expr-captures-local`). The converter now reconstructs every
captured top-level binding whose value is bar-INVARIANT (it bottoms out at
`inputs`/`Math`/literals — e.g. a length derived from an `input.int` and a
`switch`-over-input preset) as a callback-local `let`/`switch` prelude
(transitively, in source order), so the references resolve in-scope. Both the
single-source and tuple `request.security` paths hoist. The numeric `na`
sentinel emits as the validator-safe `NaN` (not `Number.NaN`) inside a security
callback. A genuinely bar-VARYING capture (one depending on series / `ta.*` /
OHLCV) cannot be rebuilt and now raises the new append-only error
`request-security-expr-captures-series` — an actionable converter diagnostic in
place of a downstream compiler error. This fixes feature-heavy scripts (e.g.
Trend Wizard) that derived a higher-timeframe `ta.atr` length from inputs.
