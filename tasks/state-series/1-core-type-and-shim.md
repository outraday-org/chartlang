# Task 1 — Core type + `state.series` hole + registry + compiler shim

> **Status: TODO**

## Goal

Introduce the `NumberSeriesSlot` type (`MutableSlot<number> &
Series<number>`) in core, add the `state.series(init)` sentinel hole on the
`state` namespace, append `{ name: "state.series", slot: true }` to
`STATEFUL_PRIMITIVES`, and mirror all of it in the compiler's ambient shim
(`program.ts`) in lockstep. Add type-level tests proving the dual
scalar-writable + indexable nature. Create the feature changeset.

## Prerequisites

None.

## Current Behavior

- `state` (`packages/core/src/state/state.ts`) is a frozen object of sentinel
  holes: `float`/`int`/`bool`/`string` return `MutableSlot<number|…>`, plus
  `tick.*`. `StateNamespace = typeof state`.
- `MutableSlot<T>` (`packages/core/src/state/mutableSlot.ts`) is
  `{ get value(): T; set value(v: T) }` — "no `.history()`, no indexing."
- `Series<T>` / `PriceSeries` (`packages/core/src/types.ts`):
  `PriceSeries = Price & Series<Price>`.
- `STATEFUL_PRIMITIVES` (`packages/core/src/statefulPrimitives.ts`) lists the
  eight `state.*` / `state.tick.*` entries as `{ slot: true }`;
  `STATEFUL_PRIMITIVES_BY_NAME` derives from the same list.
- `packages/compiler/src/program.ts` ambient shim declares `StateNamespace`,
  `MutableSlot`, `Series`, `PriceSeries`, and the `STATEFUL_PRIMITIVES`
  registry — must stay byte-consistent with core (lockstep invariant).

## Desired Behavior

- `state.series(0)` type-checks and returns a `NumberSeriesSlot`:
  `s.value = 1` (write), `s.value` / `s.current` / `+s` / `s[0]` (read
  current), `s[1]` (history), `s.length`, and `ta.ema(s, 5)` (series as a
  `ta.*` source) all type-check.
- The compiler program type-checks the same (shim mirrors core).
- Existing `state.*` holes, `MutableSlot`, and the registry are unchanged
  except for the additive `series` entry.

## Requirements

### 1. New core type (`packages/core/src/types.ts`)

Add next to `PriceSeries` / `VolumeSeries`:

```ts
/**
 * A user-allocated, writable, indexable number series — the value half of
 * {@link state}'s `series` slot. It is **both** a writable scalar slot
 * (`s.value = x`, like `state.float`) **and** an indexable
 * `Series<number>` (`s[1]`, `s.current`, `+s`, like `bar.close`). Assign
 * the current bar's value with `s.value = …` each step; read history with
 * `s[n]` (n bars ago, `NaN` until filled). The runtime backs it with a
 * number-coercible ring-buffer view sized to the script's max lookback.
 *
 * `Number.isFinite(s)` / `s === x` see the **object**, not the number —
 * use `s.current` / `+s` / `s.value` for raw-number contexts.
 *
 * @since <next-minor>
 * @stable
 * @example
 *     function lag(s: NumberSeriesSlot): number {
 *         s.value = 42;
 *         return s.current - s[1]; // current minus one bar ago
 *     }
 */
export type NumberSeriesSlot = MutableSlot<number> & Series<number>;
```

Import `MutableSlot` into `types.ts` if not already in scope (it lives in
`state/mutableSlot.ts`). Re-export `NumberSeriesSlot` from the package root
(`packages/core/src/index.ts`) alongside `PriceSeries` / `MutableSlot`.

### 2. `state.series` hole (`packages/core/src/state/state.ts`)

Add to the frozen `state` object (after `string`, before `tick`):

```ts
/**
 * Allocate or read a persistent **series** slot — a writable, indexable
 * number history. `s.value = expr` writes the current bar's value;
 * `s[0]` / `s.current` / `+s` read it back, `s[1]` reads one bar ago.
 * Out-of-range / pre-write reads are `NaN`. Unlike `state.float`, the
 * slot retains a bounded window of prior committed values (sized to the
 * script's deepest literal `s[n]` lookback).
 *
 * @since <next-minor>
 * @stable
 * @example
 *     const fn: typeof state.series = state.series;
 *     void fn;
 */
series(_init: number): NumberSeriesSlot {
    return sentinel("state.series");
},
```

`NumberSeriesSlot` is imported from `../types.js` (mirrors how `MutableSlot`
is imported). `state.tick.series` is **out of scope** (deferred) — do not add
a tick variant. `StateNamespace = typeof state` picks the new method up
automatically.

### 3. Registry (`packages/core/src/statefulPrimitives.ts`)

Append (additive within `apiVersion: 1`, per `core/CLAUDE.md`) to the
canonical list, in the `state.*` region:

```ts
{ name: "state.series", slot: true },
```

`STATEFUL_PRIMITIVES_BY_NAME` derives from the same list — no extra edit.

### 4. Compiler ambient shim (`packages/compiler/src/program.ts`)

Mirror in the `declare module` block, byte-consistent with core:

- Add `export type NumberSeriesSlot = MutableSlot<number> & Series<number>;`
  next to the shim's `PriceSeries` (escaped backticks per the existing shim
  string style).
- Add `series(init: number): NumberSeriesSlot;` to the `StateNamespace`
  declaration (after `string`, before `tick`).
- Add `STATEFUL_PRIMITIVES` registry note: the entry rides the same
  `ReadonlySet`/`ReadonlyMap` declarations already present — no shape change,
  the runtime/core list is the source of truth, so nothing to add here beyond
  confirming the type still matches.

### 5. Type-level tests

- **Core** (`packages/core/src/types.types.test.ts` or
  `state/*.types.test.ts` — follow the existing `state` type-test location):
  using `expect-type`, allocate `const s = state.series(0)` and assert:
  - `s` is assignable to `MutableSlot<number>` AND to `Series<number>`,
  - `s[1]` is `number`, `s.current` is `number`, `s.length` is `number`,
  - `s.value` is `number` and `s.value = 1` is allowed (writable),
  - `s` is assignable to a `ScalarOrSeries` / `ta.*` source param.
- **Compiler** (`packages/compiler/src/compile.test.ts`): a positive
  `compile()` test (alongside the bar-series `bar.close[1]` test) whose
  fixture body is:
  ```ts
  const s = state.series(0);
  s.value = bar.close * 2;
  const a = s[1];
  const b = +s;
  plot(a + b);
  ```
  Assert it compiles with **no** type diagnostics. (`compile()` type-checks;
  analysis-only `transformAndAnalyse` does not — this is the guard the shim
  retyping is correct. Buffer-sizing for `s[1]` is Task 2's concern; this test
  only proves the types.)

### 6. Changeset

Create `.changeset/<slug>.md` (feature changeset for the whole work):

```md
---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-pine-converter": minor
---

Add `state.series(init)` — a writable, indexable user series. Store an
arbitrary value each bar (`s.value = expr`) and read its history N bars
back (`s[1]`). Number-coercible (`+s`, `s.current`) and usable as a `ta.*`
source. The Pine converter lowers a history-indexed `var` to it.
```

## Edge cases

- `NumberSeriesSlot` is an intersection — confirm both `s.value = x` (the
  `MutableSlot` setter) and `s[1]` (the `Series` index) type-check
  simultaneously, same as `PriceSeries` proved for read-only fields.
- Resolve `<next-minor>` to the actual next minor of core/compiler/runtime at
  implementation time (bar-series shipped at 1.x — match the convention).
- Do NOT add a `tick.series` hole or a `bool`/`string` series — deferred.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/types.ts` | Modify | Add `NumberSeriesSlot`. |
| `packages/core/src/index.ts` | Modify | Re-export `NumberSeriesSlot`. |
| `packages/core/src/state/state.ts` | Modify | Add `series` hole. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Append registry entry. |
| `packages/core/src/**/*.types.test.ts` | Modify | expect-type assertions. |
| `packages/compiler/src/program.ts` | Modify | Mirror type + hole in shim. |
| `packages/compiler/src/compile.test.ts` | Modify | Positive compile test. |
| `.changeset/<slug>.md` | Create | Feature changeset. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-core test` (100% coverage; the sentinel
  hole's throw is asserted, like every sibling)
- `pnpm -F @invinite-org/chartlang-compiler test`
- `pnpm docs:check` (JSDoc on new exports: `@since`, `@example`, `@stable`)

## Changeset

`.changeset/<slug>.md` — **minor** (core, compiler, runtime, pine-converter).

## Acceptance Criteria

- `NumberSeriesSlot` defined + exported with full JSDoc.
- `state.series` hole added (throws the active-step sentinel when called
  directly); registry entry appended; `tick.series` NOT added.
- Shim in `program.ts` mirrors core exactly (lockstep).
- expect-type test proves dual writable-scalar + indexable nature.
- `compile()` test proves the `state.series` usage type-checks with no
  diagnostics.
- Changeset committed; typecheck/lint/core+compiler tests/docs:check green.
</content>
