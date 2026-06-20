# `state.array` analytics — handle methods + `array.*` aliases

## Overview

`state.array<number>(capacity)` (see `../state-array/`) ships a bounded FIFO
ring with `push`/`get`/`last`/`size`/`capacity`/`clear`. The moment an author
has a window, they want to **reduce over it** — rolling sum / mean / stdev /
min / max / median / percentile / sort. Without these, every script
re-implements bounded-loop reductions by hand. This adds analytic reductions
as **canonical methods on the `MutableArraySlot` handle** (`win.avg()`,
`win.stdev()`), plus a thin **Pine-parity `array.*` free-function namespace**
(`array.avg(win)`) that delegates to the methods.

## Current State

- `MutableArraySlot<T>` (`packages/core/src/state/arraySlot.ts`, from the
  `state-array` work) exposes only `push`/`get`/`last`/`clear`/`size`/`capacity`.
- The runtime ring-buffer store backing the handle lives in
  `packages/runtime/src/` (the `state.array` slot impl from `state-array`
  task 2); reductions must read the store's filled region directly (O(size)),
  not via repeated `get(n)` proxy hops where avoidable.
- No `array` namespace exists.

## Target State

- Analytic methods on `MutableArraySlot<number>`: `sum()`, `avg()`,
  `min()`, `max()`, `stdev(biased?)`, `variance(biased?)`, `median()`,
  `percentile(p)`, `sort(order?)` (returns a fresh sorted `ReadonlyArray<number>`
  — never mutates the ring), `indexOf(value)`, `includes(value)`, `range()`
  (`max − min`).
- A frozen `array` namespace (pure, core) whose members delegate to the
  handle methods 1:1: `array.sum(a)`, `array.avg(a)`, … — Pine naming parity.
- Pine `array.*` reductions map onto either form via the converter.
- Conformance scenario asserting a rolling stdev/median series is byte-stable.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Methods canonical, `array.*` thin aliases** | The handle is the real object with O(size) access to its store; methods get autocomplete + one source of truth. `array.*` exists only for Pine parity and delegates (`array.avg = (a) => a.avg()`), so there is no second implementation to drift. |
| **Reductions read the runtime store, not `get(n)` in a loop** | The ring already holds a contiguous `Float64Array`-backed region; a reduction walks it once. Implementing `avg` as `Σ get(i)/size` would pay proxy overhead per element. Methods live on the runtime handle object so they reach the store directly. |
| **`sort()` returns a copy** | A persistent FIFO must keep insertion order for eviction; sorting in place would corrupt the ring. `sort()` snapshots into a fresh array. |
| **NaN policy: skip-NaN, matching `ta.*`** | Pushed `NaN`s are excluded from `sum`/`avg`/`stdev`/`min`/`max`/`median`/`percentile` (consistent with the `ta.*` weighted-window convention). An all-NaN / empty window returns `NaN` (not `0`). Documented per method. |
| **`percentile(p)` = linear interpolation** | `p ∈ [0,100]`; linear-interpolation-between-closest-ranks (Pine `array.percentile_linear_interpolation`). Documented; nearest-rank deferred. |
| **`stdev`/`variance` default population (biased)** | Matches `ta.stdev` (population). `biased = false` switches to sample (`n − 1`). |

## Dependency Graph

```
(state-array tasks 1–2 landed)
        |
        v
Task 1 (core: handle method types + `array` namespace + ambient shim + type tests)
        |
        v
Task 2 (runtime: reduction impls on the store + array.* delegates + unit/property/golden)
        |
        v
Task 3 (conformance + pine-converter + docs/skills/example)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Core method types + `array` namespace](./1-core-method-types-and-namespace.md) | core, compiler | state-array | Medium |
| 2 | [Runtime reductions + `array.*` delegates](./2-runtime-reductions.md) | runtime, core | 1 | High |
| 3 | [Conformance + converter + docs/skills](./3-conformance-converter-docs.md) | conformance, pine-converter, docs | 2 | Medium |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| `MutableArraySlot<T>` | `packages/core/src/state/arraySlot.ts` | Extend the interface with method signatures. |
| `state.array` runtime store | `packages/runtime/src/` (state-array task 2) | Reductions read its filled region directly. |
| `ta.stdev` / `ta.median` math | `packages/runtime/src/ta/` (+ any `_lib`) | Reuse the population-stdev / median helpers — do not re-derive the formula. |
| `color`/`str` frozen-namespace pattern | `packages/core/src/color/index.ts:20` | Template for the `array` namespace + ambient shim. |
| Converter family transforms | `packages/pine-converter/src/transform/` | Add `array.*` mapping. |

## Provenance

N/A — fresh analytics. Formula parity with `ta.stdev`/`ta.median` is reuse,
not a port.

## Deferred / Follow-Up Work

- Non-number element types (`array<string>` analytics are nonsensical; only
  numeric reductions are offered).
- `array.covariance(a, b)` / `array.correlation(a, b)` (two-window — needs
  aligned sizes; deferred).
- Nearest-rank percentile variant.
- `map.*` analytics (see `../map-collection/`).
