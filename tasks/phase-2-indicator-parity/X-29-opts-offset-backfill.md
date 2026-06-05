# Task 29 — Universal `opts.offset` backfill on Phase-1 primitives

> **Status: TODO**

## Goal

Wire universal `opts.offset` (§9.1) into the nine Phase-1 `ta.*`
primitives. Phase-1 shipped the `offset` field on the opts types
but every implementation honoured `0` only. Phase-2 ports already
honour it via `lib/applyOffset` (Task 2's convention). This task
closes the loop on Phase 1 so the surface is uniform before the
phase-closeout task.

## Prerequisites

- Task 5 (cross-functional `ta.nz` for guarded paths) — actually
  this task could land any time after Task 1 + Phase 1; numbered
  here so it sits before the closeout and after every consumer
  port that might have surfaced an offset-related ambiguity.

## Current Behavior

`packages/runtime/src/ta/{sma,ema,stdev,bb,rsi,macd,atr,crossover,crossunder}.ts`
read `opts.offset` from the script-supplied opts but ignore it.
The behaviour is documented in `packages/runtime/src/ta/CLAUDE.md`:

> **Universal `opts.offset`.** Phase 1 ships the helper
> (`lib/applyOffset.ts`) but wires `0` everywhere. Phase 4 wires
> the option per §9.1.

That CLAUDE.md note is updated by this task to "Phase 2 wires
universal `opts.offset` across every primitive."

## Desired Behavior

After this task:

- Every Phase-1 primitive honours `opts.offset` via the existing
  `lib/applyOffset.ts` helper (`applyOffsetToSeries(values:
  Float64Array, offset: number): Float64Array`). The helper
  operates on the primitive's `Float64Array`-backed output buffer
  before it's wrapped in a `Series<T>` view.
- The shifted output is wrapped in a Series view; on subsequent
  calls with the same offset, the primitive's slot caches the
  shifted Float64Array + its Series view by `(buffer-identity,
  offset)` and returns the cached pair (no re-shift).
- Property tests assert: `offset === 0` ⇒ identical output to
  pre-task (the helper's existing fast path returns the same
  reference); `offset === k > 0` ⇒ output shifted forward by `k`;
  `offset === -k` ⇒ shifted backward.
- Goldens are NOT regenerated — `offset === 0` is the default and
  the existing golden hashes hold.
- The new offset path is covered by per-primitive
  `<id>.test.ts` (positive + negative offset).

## Requirements

### 1. Implementation pattern

For each primitive, the slot value gains a
`shiftedOutputs: Map<number, { buffer: Float64Array; series:
Series<number> }>` field keyed by the numeric offset value.
On every call the implementation:

1. Computes the underlying (un-shifted) `Float64Array` output as
   before; the cached `Series<number>` proxies it.
2. Reads `opts.offset` (default 0).
3. If `offset === 0`, returns the un-shifted Series (no
   allocation — same identity as before this task).
4. Else, looks up `offset` in `shiftedOutputs`. Miss: call
   `applyOffsetToSeries(unshiftedBuffer, offset)` to produce a new
   Float64Array, wrap it in a `Series<number>` via
   `makeSeriesView` (or equivalent), and cache the pair under the
   numeric offset key. Hit: re-shift the buffer in place (the
   underlying buffer's contents change each bar) and return the
   cached series view.

Multi-output primitives (`ta.bb`, `ta.macd`) apply the offset to
each output's Float64Array independently — one
`shiftedOutputs` map per output.

### 2. `lib/applyOffset.ts` extension

The Phase-1 helper signature stays:

```ts
export function applyOffsetToSeries(
    values: Float64Array,
    offset: number,
): Float64Array;
```

— it operates on Float64Array buffers, not `Series<T>`. The
extension this task makes is **additive only**: keep the existing
fast path (`offset === 0` returns the same reference). Add a
`shiftOffsetIntoBuffer(out: Float64Array, source: Float64Array,
offset: number): void` companion that re-shifts in place (so the
primitive's slot doesn't allocate per-bar). Both functions live
in the same file. Existing Phase-1 callers (none — the helper
was wired but unused) continue to compile.

No `clearOffsetCache(series)` is needed — the cache lives on the
slot's `shiftedOutputs` map and is freed by `dispose` (which the
runtime calls on slot retirement).

### 3. Per-primitive

For each of `sma`, `ema`, `stdev`, `bb`, `rsi`, `macd`, `atr`,
`crossover`, `crossunder`:

| File | Action |
|---|---|
| `packages/runtime/src/ta/<id>.ts` | Modify — read `opts.offset` and apply via `applyOffset`. |
| `packages/runtime/src/ta/<id>.test.ts` | Modify — add positive + negative + zero offset cases. |
| `packages/runtime/src/ta/<id>.property.test.ts` | Modify — add property: full recompute at offset `k` equals shifted output of recompute at offset 0. |

Goldens stay; bench thresholds re-pin (the offset code path adds
a Math op in the hot loop — re-bench).

### 4. JSDoc

Each primitive's `@example` block adds an optional second
example illustrating `opts.offset`:

```ts
/**
 * @example
 *     // Shifted +5 bars forward — useful for projecting an MA
 *     // into the immediate-future region of the chart.
 *     const e = ta.ema(bar.close, 20, { offset: 5 });
 */
```

### 5. CLAUDE.md note

`packages/runtime/src/ta/CLAUDE.md` is updated to remove the
"Phase 1 ships the helper but wires `0` everywhere" note and
replace with "Universal `opts.offset` honoured on every
primitive — see `lib/applyOffset`."

### 6. Coverage

100% on every touched primitive. The new offset branches add
roughly two coverage points per primitive (positive / negative)
+ the cache hit path; all three are covered by the existing
`<id>.test.ts` extensions.

### 7. Bench

Each Phase-1 `<id>.bench.test.ts` re-pins `THRESHOLD_MS` against
the post-task Apple-silicon median. The expected delta is small
(<10%) because the offset === 0 fast path skips the cache.

### 8. No conformance scenarios

`opts.offset` is observable in script-author land; the existing
Phase-1 conformance scenarios for `emaCross`, `bollingerBands`,
`rsiDivergenceAlert` are NOT modified. A new scenario would add
no signal — the per-primitive property tests cover the surface.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/runtime/src/ta/lib/applyOffset.ts` | Modify | Add `shiftOffsetIntoBuffer(out, source, offset)` in-place re-shift companion. Keep existing `applyOffsetToSeries(Float64Array, number) → Float64Array` as the allocation-emitting form. |
| `packages/runtime/src/ta/lib/applyOffset.test.ts` | Modify | Cover the in-place re-shift companion + corner cases (0, positive, negative, out-of-range). |
| `packages/runtime/src/ta/{sma,ema,stdev,bb,rsi,macd,atr,crossover,crossunder}.ts` | Modify (×9) | Wire offset. |
| `packages/runtime/src/ta/{sma,ema,stdev,bb,rsi,macd,atr,crossover,crossunder}.test.ts` | Modify (×9) | Add offset cases. |
| `packages/runtime/src/ta/{sma,ema,stdev,bb,rsi,macd,atr,crossover,crossunder}.property.test.ts` | Modify (×9) | Add offset property. |
| `packages/runtime/src/ta/{sma,ema,stdev,bb,rsi,macd,atr,crossover,crossunder}.bench.test.ts` | Modify (×9) | Re-pin THRESHOLD_MS. |
| `packages/runtime/src/ta/CLAUDE.md` | Modify | Update universal-offset note. |
| `docs/primitives/ta/<id>.md` | Generate (×9) | Re-run via `pnpm docs:generate`. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm bench:ci` (re-pinned thresholds)
- `pnpm docs:check`
- `pnpm docs:gate`
- `pnpm readme:check`
- `pnpm conformance`

## Changeset

`.changeset/phase-2-opts-offset-backfill.md` — `minor` for
`@invinite-org/chartlang-runtime`. No core surface change (the
`offset` field already exists on Phase-1 opts).

## Acceptance Criteria

- All 9 Phase-1 primitives honour `opts.offset` (property tests
  pass).
- `lib/applyOffset` cache hit path tested.
- Bench thresholds re-pinned and green.
- 100% coverage maintained.
- CLAUDE.md note updated.
- Auto-generated doc pages regenerated for Phase-1 primitives
  (the new `@example` blocks land in the pages).
- Changeset committed.
