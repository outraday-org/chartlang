---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
"@invinite-org/chartlang-compiler": patch
---

Phase-2 Task 27 — S/R ports: `ta.zigZag`, `ta.pivotsHighLow`,
`ta.pivotsStandard`, and `ta.volatilityStop` (closes §9.2's S/R
list).

Ships four new S/R `ta.*` primitives under
`packages/runtime/src/ta/`:

- `ta.zigZag(opts?)` — streaming swing-pivot detector. Walks the
  close series tracking a running candidate pivot; confirms a new
  pivot when the price has reversed by ≥ `deviation %` AND `depth`
  bars have elapsed. Returns `{ value, direction }` where `value`
  carries the most-recently-confirmed pivot price (held constant
  between confirmations, NaN before the first) and `direction` is
  `+1` / `-1` / NaN. Defaults `deviation = 5`, `depth = 10`.
  Streaming adaptation of invinite's batch ZigZag — invinite's
  linear-interpolation rendering between pivots isn't representable
  in the append-only `Series` model, so the output is the closest
  surface (a "trailing reference level").
- `ta.pivotsHighLow(opts?)` — centred-window swing-pivot detector
  with asymmetric `(leftLength, rightLength)` confirmation windows.
  Returns `{ high, low }` (price-level series — `bar.high(centre)`
  or `bar.low(centre)` when a pivot confirms, NaN otherwise).
  Mirrors invinite's tie-break: strict-greater on the left window,
  geq on the right (matches Pine `ta.pivothigh`). Defaults
  `leftLength = rightLength = 4` (9-bar window).
- `ta.pivotsStandard(opts?)` — classical daily pivot-point levels
  (P, R1..R3, S1..S3) derived from the previous UTC-day's HLC.
  Returns seven `Series<number>` (`{ pp, r1, s1, r2, s2, r3, s3 }`).
  Four formula systems: `"classic"` (default), `"fibonacci"`,
  `"camarilla"`, `"woodie"`. UTC-day boundary detection via
  `Math.floor(bar.time / 86_400_000)`. R4 / R5 / S4 / S5 levels
  (Camarilla's full table) and DeMark / Traditional systems
  intentionally defer per the Phase-2 README "Deferred / Follow-Up
  Work" footnote.
- `ta.volatilityStop(opts?)` — PSAR-like trend-following stop
  driven by ATR. Composes Phase-1 `ta.atr` at sub-slot
  `${slotId}/atr`. Returns `{ value, direction }` (`+1` uptrend →
  stop is BELOW price; `-1` downtrend → stop ABOVE). Defaults
  `length = 20`, `multiplier = 2`. Source hard-coded to `bar.close`
  (Pine `ta.vstop` convention; invinite's `source` field is
  omitted, a `source` opt could land in a follow-up).

All four primitives suspend their recurrence state on NaN OHLC so
the next finite bar resumes from the prior state. `replaceHead`
correctness is asserted via append-vs-replaceHead property tests
over `arbBar` fixtures — ZigZag and Volatility Stop snapshot their
state-machine state at the start of each bar BEFORE the close-side
recurrence advances so a final tick replays from the seed
(mirrors Task 25's PSAR / Supertrend pattern).

Each primitive ships the §22.10 set: impl + unit + property +
golden + bench pair + conformance scenario (using the Phase-2
`inlineSource` extension from Task 1) + auto-generated
`docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA` carries the
multi-output / y-domain hints (all four use `yDomain: { kind:
"auto" }`).

Core adds `ZigZagOpts`, `ZigZagResult`, `PivotsHighLowOpts`,
`PivotsHighLowResult`, `PivotsStandardOpts`,
`PivotsStandardResult`, `PivotsStandardSystem`,
`VolatilityStopOpts`, and `VolatilityStopResult` exports + four
`TaNamespace` methods. `STATEFUL_PRIMITIVES` grows by 4 (all
`slot: true`). `TA_REGISTRY` mirrors with the leading
`slotId: string` on each method.

Compiler patch: the ambient shim mirrors the four new methods +
nine new types.
