---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 18 — volatility ports: `ta.bbPercentB`, `ta.bbw`, and
`ta.donchian`.

Ships three new volatility `ta.*` primitives under
`packages/runtime/src/ta/`:

- `ta.bbPercentB(source, length, opts?)` — Bollinger %B,
  `(src − lower) / (upper − lower)` over the BB envelope. NaN
  when the band collapses (zero width). Composes `ta.bb` via
  sub-slot `${slotId}/bb` so a fix to the envelope flows in for
  free. Default `multiplier = 2`.
- `ta.bbw(source, length, opts?)` — Bollinger BandWidth,
  `(upper − lower) / middle` over the BB envelope. Raw ratio
  scale (multiply by 100 in the script for TradingView-parity
  display). NaN on zero middle. Composes `ta.bb` via the same
  sub-slot pattern. Default `multiplier = 2`.
- `ta.donchian(length, opts?)` — Donchian Channels,
  `{ upper, middle, lower }` over a fixed `length`-bar window.
  `upper = highest(bar.high, length)` and `lower =
  lowest(bar.low, length)` via sub-slots `${slotId}/highest` /
  `${slotId}/lowest` — the slot-aware composition of the
  registered Task-5 primitives; equivalent to `lib/donchianMid`
  but routed through the registry so a fix flows in for free.
  Mid = `(upper + lower) / 2`.

Each primitive ships the §22.10 set: impl + unit + property +
golden + bench pair + conformance scenario (using the Phase-2
`inlineSource` extension from Task 1) + auto-generated
`docs/primitives/ta/<id>.md`. `TA_REGISTRY_METADATA.donchian`
records the multi-output hints (`primarySeriesKey: "middle"`,
`visibleSeriesKeys: ["upper", "middle", "lower"]`,
`yDomain: { kind: "auto" }`).

Core adds `BbPercentBOpts`, `BbwOpts`, `DonchianOpts`,
`DonchianResult` exports + the three `TaNamespace` methods.
`STATEFUL_PRIMITIVES` grows by 3 (all three `slot: true`).
`TA_REGISTRY` mirrors with the leading `slotId: string` on each
method.
