---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 19 — volatility ports: `ta.keltner`, `ta.envelope`, and
`ta.chop`.

Ships three new volatility `ta.*` primitives under
`packages/runtime/src/ta/`:

- `ta.keltner(opts?)` — Keltner Channels overlay envelope.
  `middle = MA(close, length, maType)` with `upper / lower =
  middle ± multiplier · ATR(length)`. Defaults `length = 20`,
  `multiplier = 2`, `maType = "ema"` (TradingView / Linda Raschke
  canonical form). Composes `ta.atr` via sub-slot `${slotId}/atr`
  and the registered MA primitive (`sma` / `ema` / `wma` / `smma`)
  via sub-slot `${slotId}/<maType>` — fixes to either flow in for
  free.
- `ta.envelope(source, opts?)` — price-percent envelope overlay.
  `middle = MA(source, length, maType)` with `upper / lower =
  middle · (1 ± percent / 100)`. Defaults `length = 20`,
  `percent = 10`, `maType = "sma"`. Composes the registered MA
  primitive via sub-slot `${slotId}/<maType>` so fixes flow in
  for free.
- `ta.chop(length, opts?)` — Choppiness Index sub-pane regime
  gauge. `chop = 100 · log10(sumTR(length) / (highest(high,
  length) − lowest(low, length))) / log10(length)`, clamped to
  `[0, 100]`. High values flag sideways / choppy markets; low
  values flag strong trends. Composes `ta.highest` / `ta.lowest`
  via sub-slots; the TR-sum numerator is a sliding-window sum
  inside the slot (same internal TR math as `ta.atr`, but raw —
  Pine `ta.chop` does NOT use the Wilder-smoothed ATR).

Each primitive ships the §22.10 set: impl + unit + property +
golden + bench pair + conformance scenario (using the Phase-2
`inlineSource` extension from Task 1) + auto-generated
`docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA.keltner` and
`.envelope` record the multi-output hints
(`primarySeriesKey: "middle"`,
`visibleSeriesKeys: ["upper", "middle", "lower"]`,
`yDomain: { kind: "auto" }`); `TA_REGISTRY_METADATA.chop` pins
the bounded `{ yDomain: { kind: "fixed", min: 0, max: 100 } }`
oscillator range.

Core adds `KeltnerOpts`, `KeltnerResult`, `EnvelopeOpts`,
`EnvelopeResult`, `ChopOpts` exports + the three `TaNamespace`
methods. `STATEFUL_PRIMITIVES` grows by 3 (all three `slot: true`).
`TA_REGISTRY` mirrors with the leading `slotId: string` on each
method.
