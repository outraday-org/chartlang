# Task 1 — Core: analytic method types on `MutableArraySlot` + `array` namespace + ambient shim

> **Status: TODO**

## Goal

Extend the `MutableArraySlot<T>` interface with numeric reduction method
signatures, add a pure frozen `array` namespace (Pine-parity free functions
delegating to those methods), mirror both in the compiler ambient shim, and
land type-level tests. No runtime behavior in this task — signatures + the
delegating namespace shell only.

## Prerequisites

- `../state-array/` tasks 1–2 landed (`MutableArraySlot<T>` exists; the
  runtime store + handle exist).

## Current Behavior

- `MutableArraySlot<T>` (`packages/core/src/state/arraySlot.ts`) =
  `{ push; get; last; clear; readonly size; readonly capacity }`.
- The compiler ambient shim declares the matching `StateNamespace` /
  slot surface in `packages/compiler/src/program.ts` (mirror of core).
- No `array` namespace.

## Desired Behavior

```ts
const win = state.array<number>(20);
win.push(bar.close.current);

win.sum(); win.avg(); win.min(); win.max();
win.variance(); win.variance(false);   // population | sample
win.stdev(); win.stdev(false);
win.median(); win.percentile(90); win.range();
win.indexOf(x); win.includes(x);
const sorted: ReadonlyArray<number> = win.sort();        // ascending
const desc = win.sort("desc");

// Pine-parity aliases (delegate to the methods):
array.avg(win); array.stdev(win); array.percentile(win, 90); array.sort(win);
```

## Requirements

### 1. Extend `MutableArraySlot<T>` (`packages/core/src/state/arraySlot.ts`)

Add the reduction methods. They are only meaningful for `T = number`; gate via
a conditional or document that they assume numeric `T` (v1 supports only
`number` elements per `state-array`, so keep them unconditional `number`):

```ts
export type MutableArraySlot<T> = {
    push(value: T): void;
    get(n: number): T;
    last(): T;
    clear(): void;
    readonly size: number;
    readonly capacity: number;

    /** Σ of non-NaN elements; NaN if the window is empty / all-NaN. @since 1.2 */
    sum(): number;
    /** Mean of non-NaN elements; NaN if empty / all-NaN. @since 1.2 */
    avg(): number;
    /** Min / max of non-NaN elements; NaN if empty / all-NaN. @since 1.2 */
    min(): number;
    max(): number;
    /** max − min over non-NaN elements; NaN if empty. @since 1.2 */
    range(): number;
    /** Variance; population by default, sample when biased === false. @since 1.2 */
    variance(biased?: boolean): number;
    /** Standard deviation; population by default. @since 1.2 */
    stdev(biased?: boolean): number;
    /** Median of non-NaN elements (linear interpolation at the midpoint). @since 1.2 */
    median(): number;
    /** p-th percentile, p ∈ [0,100], linear interpolation. @since 1.2 */
    percentile(p: number): number;
    /** First index (0 = newest) of value, or -1. @since 1.2 */
    indexOf(value: T): number;
    /** Whether value is present. @since 1.2 */
    includes(value: T): boolean;
    /** Fresh sorted COPY (never mutates the ring). @since 1.2 */
    sort(order?: "asc" | "desc"): ReadonlyArray<T>;
};
```

Every added method needs a JSDoc line with `@since 1.2` (the namespace-level
JSDoc already carries `@stable`/`@example`; per-method tags follow the
existing `arraySlot.ts` style). Document the **skip-NaN** policy and the
**empty → NaN** rule in the interface JSDoc.

### 2. `array` namespace (`packages/core/src/array/index.ts`, new)

Pure frozen namespace whose members delegate to the handle methods (no second
implementation — this is the load-bearing decision):

```ts
import type { MutableArraySlot } from "../state/arraySlot.js";

/** Pine-parity free-function view over a `state.array` handle. Each member
 *  delegates to the handle method of the same name. @since 1.2 @stable
 *  @example const m = array.avg(win); void m; */
export const array = Object.freeze({
    sum: (a: MutableArraySlot<number>): number => a.sum(),
    avg: (a: MutableArraySlot<number>): number => a.avg(),
    min: (a: MutableArraySlot<number>): number => a.min(),
    max: (a: MutableArraySlot<number>): number => a.max(),
    range: (a: MutableArraySlot<number>): number => a.range(),
    variance: (a: MutableArraySlot<number>, biased?: boolean): number => a.variance(biased),
    stdev: (a: MutableArraySlot<number>, biased?: boolean): number => a.stdev(biased),
    median: (a: MutableArraySlot<number>): number => a.median(),
    percentile: (a: MutableArraySlot<number>, p: number): number => a.percentile(p),
    indexOf: (a: MutableArraySlot<number>, v: number): number => a.indexOf(v),
    includes: (a: MutableArraySlot<number>, v: number): boolean => a.includes(v),
    sort: (a: MutableArraySlot<number>, order?: "asc" | "desc"): ReadonlyArray<number> => a.sort(order),
});

export type ArrayNamespace = typeof array;
```

Barrel-export from `packages/core/src/index.ts` (next to `state` / `str`):

```ts
export { array } from "./array/index.js";
export type { ArrayNamespace } from "./array/index.js";
```

### 3. Compiler ambient shim (`packages/compiler/src/program.ts`)

- Add the reduction method signatures to the shim's `MutableArraySlot`
  declaration (the shim mirror introduced by `state-array`).
- Add an ambient `export const array: Readonly<{ … }>` block mirroring the
  namespace signatures, next to the existing namespace blocks.

### 4. Type tests

Extend the existing `state.array` type-level test (or add
`packages/core/src/array/array.types.test.ts`) asserting:
`win.avg()` is `number`, `win.sort()` is `ReadonlyArray<number>`,
`array.percentile(win, 90)` is `number`, and that `win.sort()` is **not**
assignable to `number[]` (readonly).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/state/arraySlot.ts` | Modify | Add reduction method signatures + JSDoc. |
| `packages/core/src/array/index.ts` | Create | `array` namespace + `ArrayNamespace`. |
| `packages/core/src/array/array.types.test.ts` | Create | Type-level assertions. |
| `packages/core/src/index.ts` | Modify | Barrel export `array`. |
| `packages/compiler/src/program.ts` | Modify | Shim: extend `MutableArraySlot` + add `array` block. |
| `.changeset/array-analytics-core.md` | Create | minor (core, compiler). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% — the delegating namespace bodies are exercised
  in task 2; here add type tests + a trivial unit test calling each `array.*`
  member against a hand-built stub handle so the wrappers hit 100%).
- `pnpm docs:check`

## Changeset

`.changeset/array-analytics-core.md` — **minor** (core, compiler).

## Acceptance Criteria

- `MutableArraySlot<number>` exposes all reduction methods; `array.*`
  namespace delegates 1:1.
- Ambient shim mirrors core; a compile fixture using `win.stdev()` +
  `array.percentile(win, 90)` compiles clean.
- Type tests + wrapper unit tests pass; 100% coverage on new core files.
- JSDoc gate green; changeset committed.
