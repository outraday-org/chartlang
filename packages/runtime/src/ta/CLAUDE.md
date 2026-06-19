# packages/runtime/src/ta/

`ta.*` primitive implementations. Each `<id>.ts` carries one
stateful primitive that the compiler-emitted bundle dispatches to
via `ta.<id>(slotId, ...)`.

## Port convention

Every file in this folder that traces back to upstream math (the
`../invinite/` sibling repo) carries the 4-line
provenance + relicense header below — under the standard
two-line MIT block — followed by a one-line translate-not-
transcribe note when the chartlang structure diverges from the
invinite plugin shape:

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/<path>
//   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
```

Files with no upstream source (the `crossover` / `crossunder`
primitives) instead carry:

```ts
// No invinite source — Phase-1 new code, semantics per Pine
// `ta.crossover` / `ta.crossunder`.
```

Phase-2 cross-functional primitives (Task 5: `nz`, `highest`,
`lowest`, `change`, `valuewhen`, `barssince`) are Pine-canonical
helpers without an invinite source and carry the equivalent header:

```ts
// No invinite source — semantics per Pine `ta.<name>`.
```

Phase-2 helpers under `lib/` (Task 3's `wmaFloat64`, `smmaFloat64`,
`vwmaFloat64`, `computeMaOfFloat64`, `computeMa`, `maTypes`;
Task 4's `donchianMid`, `wilderDirectional`, `adxFromDi`,
`linearRegression`, `pearson`) cite the Phase-2 reference commit
`078f41fe2569d659d5aba726da8bcb5d3e2ced02` in their provenance
headers and graduate the JSDoc stability marker to `@stable` (the
math reference is fixed; consumer primitives in Tasks 6–28 carry
the public surface and stay `@stable` until Phase-2 closeout).

See `lib/CLAUDE.md` for the helper-folder convention (Float64-only
contract, per-helper NaN propagation rules, types-only coverage
exclusion).

## Invariants

- **Float64 everywhere.** Sources arrive as `number` (Float64);
  outputs land in `Float64RingBuffer` (or `RingBuffer<boolean>` for
  the cross primitives). No `Decimal`, no `BigInt`.
- **Two callsites per primitive.** The implementation dispatches on
  `ACTIVE_RUNTIME_CONTEXT.current.isTick`: `false` → append mode
  (advance the output buffer, fold the new bar into slot state);
  `true` → replace-head mode (recompute the head slot from the
  previous closed state, do **not** advance length, do **not**
  mutate the "previous bar" snapshot the next close-side append
  will read from).
- **`ta.nz` is the one stateless exception.** Its
  `STATEFUL_PRIMITIVES` entry carries `slot: false` so the compiler
  skips slot-id injection (`nz.ts` exports a pure function with no
  leading `slotId` arg, no `ACTIVE_RUNTIME_CONTEXT` consultation,
  no slot allocation). The runtime export signature and the
  script-author signature are identical. The compiler still flags
  it inside a loop body for Pine-parity (`statefulCallInLoop`
  diagnoses every entry regardless of `slot`).
- **Slot state shape.** Each primitive stores its hidden state under
  `RuntimeContext.stream.taSlots.get(slotId)`. The stored value is
  a typed record whose fields are JSON-clean numbers / arrays /
  string ids (Phase 5 persistence will serialise it). The output
  `Series<T>` Proxy lives on the slot too — identity is cached on
  first call and returned by reference thereafter, so script
  authors can write `const ema = ta.ema(...)` once and re-read it
  every bar.
- **Universal `opts.offset` is a presentation x-shift (Option A).**
  Honoured on every Phase-1 primitive (Task 29 backfill) via
  `makeShiftedSeriesView` in `../seriesView.ts`, which now returns the
  **unshifted** view (delegating to `makeSeriesView`) and records
  `view → offset` in a module-level `WeakMap<Series, number>` side-table
  read by `plot()` (via `seriesOffsetOf`) to set the emission's signed
  `PlotEmission.xShift` (`+n` renders right / future, `−n` left / past).
  The offset does **not** transform the value — `series.current` is the
  unshifted `buf.at(0)`, so alerts / `state.*` / any read see the value
  computed at the current bar, and both shift directions are
  expressible. `offset === 0` is the strict identity fast path — returns
  the slot's cached un-shifted Series and records nothing. Per-offset
  views are still cached on the slot's `shiftedViews` (single-output) /
  `shiftedResults` (composite) map, identity-stable per `(slot, offset)`,
  so the recorded offset stays attached to a stable view across bars.
  **ALMA tags `opts.barShift`** (its `opts.offset` is the Gaussian
  centre, never tagged) via the same per-`barShift` `viewForOffset`
  cache. The stale `lib/applyOffset.ts` value-shift helper was deleted —
  no runtime helper preserves the old value-read semantics.
- **NaN warmup.** Every primitive emits `NaN` for the bars where
  state isn't yet warm (per primitive's documented `@warmup`
  count). `Float64RingBuffer.at()` already returns `NaN` for OOR
  reads — the primitives propagate.
- **JSDoc.** Every export carries the §17.2 set: one-line
  description, `@formula`, `@warmup`, `@since 0.1`, an
  `@stable | @stable` marker, and one `@example` block.
  Example blocks are intentionally comment-only (no
  `defineIndicator(` call) so `pnpm docs:check`'s executor skips
  compilation — the executable examples live in the seed scripts
  (Task 11).
- **Composition.** Multi-output primitives (`bb`, `macd`) compose
  by allocating sub-slot ids derived from the parent slot id:
  `${slotId}/sma`, `${slotId}/stdev`, `${slotId}/fast`, etc. The
  composition routes through the registry (not a private copy of
  the math), so a fix to `sma` flows into `bb`'s middle band for
  free. Same convention for single-output primitives that
  decompose into staged sub-computations: `ta.hma` composes three
  `wma` sub-slots — `${slotId}/half`, `${slotId}/full`,
  `${slotId}/final` — and exposes the final WMA's series view
  through its own slot record (no separate output buffer).

## Five-file test set

Per §16.6, every primitive ships **five** test files (the impl
plus four test layers):

| File | Purpose |
|---|---|
| `<id>.ts` | The impl. |
| `<id>.test.ts` | Hand-curated unit tests pinning the math. |
| `<id>.property.test.ts` | `fast-check` invariants (length, warmup, range, determinism, reference-equivalence). |
| `<id>.golden.test.ts` | Mulberry32-seeded synthetic series; output hash pinned. Task 12 retargets to `packages/conformance/fixtures/goldenBars.json`. |
| `<id>.bench.ts` + `<id>.bench.test.ts` | Bench pair: `.bench.ts` runs under `pnpm bench`; `.bench.test.ts` pins `THRESHOLD_MS = ceil(median × 3)` under `pnpm test`. |

Conformance scenarios for these primitives land in Task 12.
