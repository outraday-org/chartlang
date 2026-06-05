---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-2 Task 15 — trend ports: `ta.aroon` and `ta.aroonOsc`.

Ships two new trend `ta.*` primitives under
`packages/runtime/src/ta/`:

- `ta.aroon(length, opts?)` — Aroon Up / Down (`{ up, down }`,
  both ∈ [0, 100]). Reads `bar.high` / `bar.low` directly per
  Pine's `ta.aroon(length)` signature (no source param). Scans the
  trailing `length + 1` window per close for the argmax / argmin
  using strict `>` / `<` so the most-recent tied bar wins
  (TradingView convention). Tick replay substitutes the head value
  without mutating the closed window.
- `ta.aroonOsc(length, opts?)` — `aroon.up − aroon.down`, bounded
  in [-100, 100]. Composes `ta.aroon` at sub-slot
  `${slotId}/aroon` so a fix to Aroon flows in for free.

Each primitive ships the §22.10 set: impl + unit + property + golden
+ bench pair + conformance scenario (using the Phase-2 `inlineSource`
extension from Task 1) + auto-generated `docs/primitives/ta/<id>.md`.
`TA_REGISTRY_METADATA` carries the multi-output / y-domain hints
(`aroon: { primarySeriesKey: "up", visibleSeriesKeys: ["up", "down"],
yDomain: fixed 0-100 }`, `aroonOsc: { yDomain: fixed -100-100 }`).

Core adds `AroonOpts`, `AroonOscOpts`, `AroonResult` exports + the
two `TaNamespace` methods. `STATEFUL_PRIMITIVES` grows by 2
(`ta.aroon`, `ta.aroonOsc`; both `slot: true`). `TA_REGISTRY`
mirrors with the leading `slotId: string` on each method.
