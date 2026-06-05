---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 25 — S/R ports: `ta.psar` and `ta.supertrend`.

Ships two new flagship trend-following S/R `ta.*` primitives under
`packages/runtime/src/ta/`:

- `ta.psar(opts?)` — Wilder Parabolic SAR returning
  `{ sar, direction }`. Self-contained state machine over
  `bar.high` / `bar.low` / `bar.close` with extreme-point +
  acceleration-factor tracking and trend-flip semantics. Defaults
  `accelerationStart = 0.02`, `accelerationStep = 0.02`,
  `accelerationMax = 0.2` per Pine / Wilder. Bar 0 emits the seed
  (`sar = bar.low`, `direction = +1`); bar 1 decides the initial
  direction from `close[1] >= close[0]`; bar 2+ runs the standard
  recurrence with the lower/upper-bound clamps against the prior
  two bars' lows/highs.
- `ta.supertrend(opts?)` — ATR-driven trailing-stop trend follower
  returning `{ line, direction }`. Composes Phase-1 `ta.atr` at
  sub-slot `${slotId}/atr`, so a fix to ATR flows in for free.
  Defaults `length = 10`, `multiplier = 3`. Reads `bar.hl2` for the
  band midpoint (Pine-canonical). The final-band persistence rule
  carries the prior band forward unless the prior close pierced it;
  direction flips when the current close crosses the prior
  `finalUpper` / `finalLower`.

Both primitives suspend their recurrence state on NaN OHLC so the
next finite bar resumes from the prior state. `replaceHead`
correctness is asserted via append-vs-replaceHead property tests
over adversarial sharp-reversal sequences — both implementations
snapshot the state at the start of each bar BEFORE the close-side
recurrence advances so a final tick replays from the seed.

Each primitive ships the §22.10 set: impl + unit + property +
golden + bench pair + conformance scenario (using the Phase-2
`inlineSource` extension from Task 1) + auto-generated
`docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA` carries the
multi-output / y-domain hints (`psar: { primarySeriesKey: "sar",
visibleSeriesKeys: ["sar", "direction"], yDomain: auto }`,
`supertrend: { primarySeriesKey: "line", visibleSeriesKeys:
["line", "direction"], yDomain: auto }`).

Core adds `PsarOpts`, `PsarResult`, `SupertrendOpts`,
`SupertrendResult` exports + the two `TaNamespace` methods.
`STATEFUL_PRIMITIVES` grows by 2 (`ta.psar`, `ta.supertrend`; both
`slot: true`). `TA_REGISTRY` mirrors with the leading
`slotId: string` on each method.
