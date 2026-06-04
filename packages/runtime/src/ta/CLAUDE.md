# packages/runtime/src/ta/

`ta.*` primitive implementations. Each `<id>.ts` carries one
stateful primitive that the compiler-emitted bundle dispatches to
via `ta.<id>(slotId, ...)`.

## Port convention

Every file in this folder that traces back to upstream math (the
`../invinite/` sibling repo per PLAN.md §3.1) carries the 4-line
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
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
```

Files with no upstream source (the `crossover` / `crossunder`
primitives) instead carry:

```ts
// No invinite source — Phase-1 new code, semantics per Pine
// `ta.crossover` / `ta.crossunder`. See PLAN.md §3.1.
```

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
- **Slot state shape.** Each primitive stores its hidden state under
  `RuntimeContext.stream.taSlots.get(slotId)`. The stored value is
  a typed record whose fields are JSON-clean numbers / arrays /
  string ids (Phase 5 persistence will serialise it). The output
  `Series<T>` Proxy lives on the slot too — identity is cached on
  first call and returned by reference thereafter, so script
  authors can write `const ema = ta.ema(...)` once and re-read it
  every bar.
- **Universal `opts.offset`.** Phase 1 ships the helper
  (`lib/applyOffset.ts`) but wires `0` everywhere. Phase 4 wires
  the option per §9.1.
- **NaN warmup.** Every primitive emits `NaN` for the bars where
  state isn't yet warm (per primitive's documented `@warmup`
  count). `Float64RingBuffer.at()` already returns `NaN` for OOR
  reads — the primitives propagate.
- **JSDoc.** Every export carries the §17.2 set: one-line
  description, `@formula`, `@warmup`, `@since 0.1`, an
  `@experimental | @stable` marker, and one `@example` block.
  Example blocks are intentionally comment-only (no
  `defineIndicator(` call) so `pnpm docs:check`'s executor skips
  compilation — the executable examples live in the seed scripts
  (Task 11).
- **Composition.** Multi-output primitives (`bb`, `macd`) compose
  by allocating sub-slot ids derived from the parent slot id:
  `${slotId}/sma`, `${slotId}/stdev`, `${slotId}/fast`, etc. The
  composition routes through the registry (not a private copy of
  the math), so a fix to `sma` flows into `bb`'s middle band for
  free.

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
