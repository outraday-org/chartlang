# User-created series — `state.series`

## Overview

Add a **writable, indexable user series** primitive, `state.series(init)`,
so a script author can store an arbitrary computed value each bar and read
its history N bars back — the capability that today only `bar.*` OHLCV
fields and `ta.*` outputs have. The returned handle is simultaneously a
writable slot (`s.value = expr`, like `state.float`) **and** an indexable
`Series<number>` (`s[1]`, `s.current`, `+s`, like `bar.close`):

```ts
const s = state.series(0);

compute({ bar }) {
    s.value = bar.close.current * 2;   // write THIS bar's value (every step)

    const now  = +s;     // current  (=== s.current === s[0])
    const prev = s[1];   // one bar ago (committed)
    const old  = s[3];   // three bars ago
}
```

This is the natural sibling of the just-shipped *directly-indexable bar
series* work (`tasks/old/directly-indexable-bar-series/`): there we made the
bar's built-in fields indexable; here we let scripts mint their own. It
reuses the exact same runtime machinery (`Float64RingBuffer` +
number-coercible `makeSeriesView` proxy) and the same `PriceSeries`-style
`number & Series<number>` intersection type, plus the existing per-callsite
`state.*` slot lifecycle (committed/tentative, snapshot/restore).

It is **not** the deferred unbounded `state.array` / `state.map`
(`docs/spec/pine-migration.md` §"Not Supported in 1.0"): a `state.series`
ring is **bounded by compile-time lookback**, so it is fixed-size and
already serializable — it sidesteps the open serialization-policy question
entirely.

### Why it also matters for Pine conversion

The Pine converter lowers a `var` scalar to a `state.float/int` slot and
emits history as `<slot>.value[N]` — but `.value` is a scalar `number`, so
`<slot>.value[N]` is a **typecheck error** in the generated chartlang
(`packages/pine-converter/CLAUDE.md` KNOWN GAPS; the `dynamic-series-index`
diagnostic is registered but unwired). Pine's `var x := …; x[1]` is one of
the language's most pervasive idioms, so this is a real fidelity gap.
`state.series` is its clean lowering target — a history-indexed numeric
`var` lowers to `state.series`, and `x[1]` then works directly.

### Relationship to `directly-indexable-bar-series`

This is the **completion** of that feature, not a competing one. There are
exactly three sources of an indexable series, and after this lands they read
identically — same `[n]` / `.current` / `+x` surface, same "it's an object,
not a number" footgun (`Price = number`, so `PriceSeries`, `VolumeSeries`, and
`NumberSeriesSlot` all share the `Series<number>` read surface and coerce the
same way):

| Source | Indexable | Writable |
|--------|-----------|----------|
| `bar.*` OHLCV/derived | ✅ (directly-indexable-bar-series) | ❌ read-only market data |
| `ta.*` outputs | ✅ (always) | ❌ read-only computed |
| `state.series` | ✅ (this) | ✅ `s.value = …` |

The only delta is writability — you write your own values but not market data.
Directly-indexable-bar-series removed the `ta.ema(_,1)` identity trick for
**bar fields**; `state.series` removes it for **arbitrary computed values**,
the one case it left behind. Without this, the language is asymmetric
("built-ins are indexable, my own values aren't"); with it, the story is
complete. **Disambiguation (baked into the Task 6 docs + example):** index
`bar.*` / `ta.*` directly — `state.series` is only for the history of a value
**you** compute that is not already a series (especially a self-referential
recurrence or a conditionally-updated value, which `bar.close[N]` cannot
express). The Task 6 example is chosen to be exactly such a case so the feature
never reads as redundant with the Manual SMA demo.

References: `packages/core/CLAUDE.md` (sentinel holes, `STATEFUL_PRIMITIVES`
additive rule, `Bar` vs `BarSeries`), `packages/runtime/CLAUDE.md` (`bar.*`
ARE cached series views, `state.*` slot lifecycle, `slotIdPrefix`),
`packages/compiler/CLAUDE.md` (core-shim lockstep, `extractMaxLookback`),
`packages/pine-converter/CLAUDE.md` (`var` → `state.*`, history emit).

## Current State

- `state.*` (`packages/core/src/state/state.ts`) exposes `float`/`int`/
  `bool`/`string` (+ `tick.*`), each returning a scalar `MutableSlot<T>`
  (`{ get value; set value }`, `packages/core/src/state/mutableSlot.ts`).
  Explicitly "no `.history()`, no indexing."
- `Series<T>` / `PriceSeries` / `VolumeSeries` exist
  (`packages/core/src/types.ts`); `bar.*` are number-coercible series views
  (`packages/runtime/src/seriesView.ts:makeSeriesView`).
- `STATEFUL_PRIMITIVES` (`packages/core/src/statefulPrimitives.ts`) lists
  `state.float`/`int`/`bool`/`string` (+ tick) as `{ slot: true }`. Adding a
  new entry is additive within `apiVersion: 1`.
- The compiler's `extractMaxLookback`
  (`packages/compiler/src/analysis/extractMaxLookback.ts`) folds `s[N]` into
  the global `manifest.maxLookback` for OHLCV fields, `ta.*` calls, and
  variables bound to a `ta.*` call (`collectSeriesVarNames`). It does **not**
  recognize a `state.*`-bound variable.
- The runtime sizes every ring buffer (OHLCV + `ta.*` outputs) to
  `manifest.maxLookback + 1` (`packages/runtime/src/createScriptRunner.ts:
  resolveCapacity`), with a `dynamicFallback: 5000` for non-literal indices.
- `state.*` slots live in `RuntimeContext.stateSlots`, keyed
  `${slotIdPrefix}${slotId}:state`, with a committed/tentative split
  (`packages/runtime/src/state/stateSlot.ts`) and per-runner snapshot/restore
  (`packages/runtime/src/state/lifecycle.ts`).
- The Pine converter lowers numeric `var`/`varip` scalars to `state.float`/
  `int` (+ `tick`) slots (`packages/pine-converter/src/transform/other.ts`),
  emits reads as `<slot>.value` and writes as `<slot>.value = …`
  (`emitContext.ts`), and emits history verbatim as `<receiver>[<offset>]`
  (`exprEmit.ts`). Numeric `var` history therefore generates non-compiling
  `<slot>.value[N]`.

## Target State

- `state.series(init: number)` returns a `NumberSeriesSlot`
  (`MutableSlot<number> & Series<number>`): `s.value = x` writes the live
  head; `s.value` / `s.current` / `+s` / `s[0]` read it; `s[1..n]` read
  committed history; `s.length` is the filled count. The allocation bar's
  pre-write head is seeded with `init`; unwritten later bars and out-of-range
  history reads are `NaN`.
- Tick/close are invisible to the script: the ring advances in lockstep with
  the bar lifecycle (append on close, `replaceHead` on tick), exactly like
  the OHLCV buffers — `s[1]` is always "the committed value one bar ago."
- `state.series` slots snapshot/restore like every other slot (the ring is
  bounded, serialized via `Float64RingBuffer.serialiseSnapshotBuffer`).
- The compiler folds literal `s[N]` lookback into `manifest.maxLookback`; the
  runtime sizes the `state.series` ring to the same global capacity. A
  non-literal index trips the existing `dynamic-series-index` warning +
  `dynamicFallback` sizing.
- The Pine converter lowers a history-indexed numeric `var`/`varip` to
  `state.series`; `x[1]` converts to working chartlang. Bool/string history
  stays out of v1 scope with a clear diagnostic.
- Docs (`series-and-indexing.md`, a new `state.series` primitive page), the
  chartlang-coding skill, a new example script + demo entry, and a new
  converter fixture all show the feature.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **`NumberSeriesSlot = MutableSlot<number> & Series<number>`** | Mirrors the proven `PriceSeries` (`number & Series<number>`) intersection. The slot is both a writable scalar (`.value` get/set) and an indexable, number-coercible series. Number-only in v1 (Float64-backed ring). |
| **Write-through to the live head (`s.value = x` → `replaceHead`)** | Simplest model; one ring, head is live — identical to how `bar.close` updates during ticks. Avoids a second tentative-scalar source for `s[0]`. |
| **Ring advances in lockstep with the bar lifecycle, script-invisible** | The script writes "this bar's value" each step; the runtime appends on close / `replaceHead`s on tick. `s[1]` is always one committed bar back. Reuses the `ta.*` `isTick ? replaceHead : append` pattern. |
| **Gaps are `NaN`, not carry-forward** | Matches warmup-NaN and `plot` gap rendering everywhere else. Carry-forward is the one-liner `s.value = +s`. |
| **Capacity = global `manifest.maxLookback` (not per-slot)** | The simplest correct sizing: `extractMaxLookback` already folds `s[N]` into the global max; the runtime already sizes every ring to `maxLookback + 1`. Per-slot `seriesCapacities` keying is a deferred optimization. |
| **Reuse `makeSeriesView` + `Float64RingBuffer`; do NOT fork** | The bar-series view is already number-coercible and identity-stable. A `state.series` slot is a ring + that view + a `.value` setter. |
| **Number-only in v1; bool/string deferred** | Numeric history is the dominant case (price/level accumulators, the bulk of Pine `var[n]`). Bool/string series are the immediate follow-up, not "rare, deferred indefinitely." |
| **Converter: only history-indexed numeric `var`s become `state.series`** | A `var` never read with `[n]` stays a leaner scalar `state.float/int`. The converter already tracks qualifiers; this is an additive scan. |

## Dependency Graph

```
Task 1 (core: type + hole + registry + shim + type tests)
  |
  v
Task 2 (compiler: extractMaxLookback recognises state.series bindings)
  |
  v
Task 3 (runtime: state.series slot — ring + coercible view + lifecycle + snapshot)
  |
  v
Task 4 (conformance: state.series history == manual lag)
  |
  v
Task 5 (pine-converter: history-indexed var -> state.series + fixtures)
  |
  v
Task 6 (docs + skills + examples + demo + new example + converter example)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Core type + primitive hole + registry + shim](./1-core-type-and-shim.md) | core, compiler | None | Medium |
| 2 | [Compiler lookback for `state.series` bindings](./2-compiler-lookback.md) | compiler | 1 | Medium |
| 3 | [Runtime `state.series` slot](./3-runtime-series-slot.md) | runtime | 1, 2 | High |
| 4 | [Conformance scenario](./4-conformance-series-history.md) | conformance | 3 | Low |
| 5 | [Pine converter: `var` history → `state.series`](./5-converter-var-history.md) | pine-converter | 1, 2, 3 | High |
| 6 | [Docs, skills, examples, demo, converter example](./6-docs-skills-examples.md) | docs, skills, apps/site, examples, pine-converter | 1–5 | Medium |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| `MutableSlot<T>` | `packages/core/src/state/mutableSlot.ts` | One half of the `NumberSeriesSlot` intersection. |
| `Series<T>` / `PriceSeries` | `packages/core/src/types.ts` | Other half; mirror the intersection pattern. |
| `sentinel(name)` hole pattern | `packages/core/src/state/state.ts` | `state.series` is a sentinel hole like every sibling. |
| `STATEFUL_PRIMITIVES` registry | `packages/core/src/statefulPrimitives.ts` | Append `{ name: "state.series", slot: true }`. |
| `collectSeriesVarNames` / `isSeriesShapedAccess` | `packages/compiler/src/analysis/extractMaxLookback.ts` | Extend to recognise `const s = state.series(...)` bindings. |
| `Float64RingBuffer` | `packages/runtime/src/ringBuffer.ts` | Backing store (append/replaceHead/at/serialise). |
| `makeSeriesView` | `packages/runtime/src/seriesView.ts` | Number-coercible indexable view (do not fork). |
| `StateSlot` lifecycle + `stateKey`/`getOrAllocate` | `packages/runtime/src/state/stateSlot.ts`, `state/stateNamespace.ts` | Per-callsite slot identity + committed/tentative + `slotIdPrefix`. |
| TA slot snapshot dispatch | `packages/runtime/src/ta/persistence.ts` | Precedent for registering a new slot-kind's serialise/restore. |
| `barCloseDirectIndex.scenario.ts` | `packages/conformance/src/scenarios/` | Scenario shape to mirror. |
| `registerStateSlots` / `emitContext` / `exprEmit` | `packages/pine-converter/src/transform/` | `var` → `state.*` lowering + read/write/history emit to extend. |
| `DEMO_SCRIPTS` + `gen-examples-docs.ts` + `generate-skills-reference.ts` | `apps/site/src/components/demo/scripts.ts`, `scripts/` | Demo + generated docs + skills reference. |

## Provenance

No `../invinite/` port — this is a chartlang-native ergonomics + Pine-fidelity
feature.

## Deferred / Follow-Up Work

- **`state.series<bool>` / `<string>`** for full Pine `var bool[n]` /
  `var string[n]` fidelity (object-backed ring + the `RingBuffer<T>` view).
- **Per-slot `seriesCapacities`** so each `state.series` sizes to its own
  deepest lookback instead of the global `maxLookback` (memory optimization).
- **`state.tick.series`** (varip-persistent series) if a use case appears.
- **Nested-expression history in the converter** (`(a+b)[1]` hoisting beyond
  the single-var case) and tuple-element history (`macdLine[1]`).
</content>
</invoke>
