# packages/runtime/src/ta/lib/

Reusable math helpers consumed by the `ta.*` primitives one level up.
Every file here is pure (`Float64Array`-in / `Float64Array`-out, no
`Bar`, no `RuntimeContext`, no slot state) so the same function backs
both the incremental primitive (called once per bar) and the
reference computation used by property + golden tests
(full-recompute over a closed array).

## Port convention

Helpers that trace back to upstream math (the `../invinite/` sibling
repo per PLAN.md §3.1) carry the 4-line CONTRIBUTING §4 provenance +
relicense header below the standard 2-line MIT block. Phase-1 helpers
reference invinite commit `d2d1043c1b039f66d2f3674526d303d31cf2f1e0`;
Phase-2 helpers reference `078f41fe2569d659d5aba726da8bcb5d3e2ced02`:

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/<file>.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
```

New chartlang helpers (no upstream source) ship with the standard
2-line MIT header only.

## Invariants

- **Float64 compute cores + shared primitive helpers.** The majority
  of files here are pure compute cores (`Float64Array`-in /
  `Float64Array`-out, no `Bar`, no `RuntimeContext`, no slot state)
  so the same function backs both the incremental primitive (called
  once per bar) and the reference computation used by property +
  golden tests (full-recompute over a closed array).
- **Shared primitive helpers** may cross the Float64 boundary when
  their consumers are 2+ `ta.*` primitives and the cross-primitive
  coupling would otherwise reach into a sibling primitive's `src/`
  file. `directionalState.ts` (a stateful `DirectionalState` record
  consumed by `ta.dmi` and `ta.adx`) and `sourceValue.ts` (a
  `Series<T>` accessor consumed by every source-taking `ta.*`) are
  the canonical examples. These helpers still do **not** touch
  `ACTIVE_RUNTIME_CONTEXT`, `Bar`, `BarView`, or `Float64RingBuffer`
  — those types live one level up where the slot state and runtime
  context live.
- **NaN propagation differs per helper.** Recurrence-style MAs
  (`emaFloat64`, `smmaFloat64`) hold the prior value forward on a
  mid-stream NaN to keep the output continuous past gaps.
  Full-recompute window helpers (`wmaFloat64`, `vwmaFloat64`,
  `rollingStddev`) short-circuit a window to NaN if any slot in it
  is NaN — there is no meaningful weighted mean over a partial
  window. `smaFloat64` is an oddball: its running-sum carries the
  NaN through arithmetic, so once a NaN enters the window the output
  effectively holds the prior value forward. The per-helper unit
  test pins the exact behaviour.
- **Warmup.** Every MA helper's first `length - 1` output slots are
  NaN. The first defined value lands at `out[length - 1]` (counted
  past any leading-NaN prefix in the input).

## Test layers

| Helper kind | `.test.ts` | `.property.test.ts` | `.bench.ts` + `.bench.test.ts` |
|---|---|---|---|
| Compute core (single math primitive) | required | required | required |
| Dispatcher (switch over kind → delegate to cores) | required | — (cores own the math; dispatcher just routes) | — (benches the core, not the switch) |

The Phase-1 helpers (`applyOffset`, `smaFloat64`, `emaFloat64`,
`rollingStddev`, `trSeries`, `wilderSmoothing`, `readSourceField`,
`pickCandleSource`) shipped with `.test.ts` only because Phase 1
hadn't standardised on the property + bench layers for helpers.
Phase 2 onward ships the four-file set for every new compute core
per the §16.3 convention; the Phase-1 helpers can be backfilled
opportunistically when they next get edited.

## Types-only files

`maTypes.ts` exports `MaType` + `MaTypeNoVolume` and contains no
runtime code. It is excluded from coverage via an explicit entry in
`packages/runtime/vitest.config.ts`'s `coverage.exclude` list — the
generic `**/types.ts` exclusion is filename-based and would not
match `maTypes.ts`.
