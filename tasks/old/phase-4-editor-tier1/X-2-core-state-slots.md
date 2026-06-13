# Task 2 — Core: `state.*` / `state.tick.*` + `MutableSlot` + `STATEFUL_PRIMITIVES`

> **Status: TODO**

## Goal

Land the `state.*` / `state.tick.*` script-facing surface in
`@invinite-org/chartlang-core` per PLAN.md §4.6 — Pine's `var` /
`varip` equivalent. Ship the `MutableSlot<T>` shape, the 8 builder
declarations (`state.float`, `state.int`, `state.bool`,
`state.string` × 2 tick variants), and extend
`STATEFUL_PRIMITIVES` from cardinality **154** (Phase 3 close) to
**162** with the 8 new `slot: true` entries. Runtime
implementation lands in Task 9; this task ships the types + the
compile-time slot-id contract only.

## Prerequisites

- Task 1 (so `state` can sit alongside `input` in the public
  surface).

## Current Behavior

- `STATEFUL_PRIMITIVES` cardinality is 154 (verified by the
  Phase-3 closeout test
  `packages/core/src/statefulPrimitives.test.ts`).
- No `state` / `state.tick` namespace exists in core.
- `MutableSlot<T>` is documented in PLAN §4.6 but undeclared.

## Desired Behavior

- `import { state } from "@invinite-org/chartlang-core"` exposes
  the 8 builders as **callable holes** — calling them at module
  scope without a runtime mounting them throws a sentinel error
  (`"state.float called outside an active script step"`). Same
  pattern as the existing `ta.*` / `draw.*` holes — the compiler
  resolves the symbol; the runtime hands a slot-aware impl through
  `ComputeContext`.
- `MutableSlot<T>` shape exported, matching PLAN §4.6 exactly —
  no `.history()`, no `.previous()`, no indexing. Just `get
  value(): T` and `set value(v: T)`.
- `STATEFUL_PRIMITIVES` cardinality is **162** — 8 new entries:
  `state.float`, `state.int`, `state.bool`, `state.string`,
  `state.tick.float`, `state.tick.int`, `state.tick.bool`,
  `state.tick.string`. All `slot: true`.
- `core/index.ts` re-exports `state`, `MutableSlot`.

## Requirements

### 1. `packages/core/src/state/mutableSlot.ts`

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Script-facing handle on a persistent cross-bar slot —
 * Pine's `var` / `varip` equivalent. PLAN.md §4.6.
 *
 * Reads return the active step value. For `state.*`, writes go
 * to a `tentative` shadow that commits at bar close and resets
 * from `committed` before each replacement tick; for
 * `state.tick.*`, writes go directly to `committed` immediately.
 * Identity is stable across bars per the runtime's
 * slot-id keying — `state.float(0)` at the same callsite returns
 * the **same** slot on every step, with the `init` arg ignored
 * after first construction.
 *
 * Intentionally minimal — no `.history()`, no `.previous()`, no
 * indexing. Scripts that need the previous bar's value store it in
 * a second slot or use `ta.*` series-indexing primitives. Keeps the
 * slot lifecycle trivially auditable.
 *
 * @since 0.4
 * @example
 *     // function compute({ bar, state }) {
 *     //     const high = state.float(NaN);
 *     //     if (Number.isNaN(high.value) || bar.high > high.value) {
 *     //         high.value = bar.high;
 *     //     }
 *     // }
 *     const _t: MutableSlot<number> = { value: 0 } as MutableSlot<number>;
 *     void _t;
 */
export type MutableSlot<T> = {
    get value(): T;
    set value(v: T);
};
```

### 2. `packages/core/src/state/state.ts`

Declare the callable holes. Pattern mirrors the existing `ta.*` —
each function throws a sentinel error when called outside an
active script step; the runtime swaps in a slot-aware impl through
`ComputeContext.state`.

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { MutableSlot } from "./mutableSlot";

const sentinel = (name: string): never => {
    throw new Error(`${name} called outside an active script step`);
};

/**
 * Persistent state slots — Pine `var` semantics. Writes during a
 * `tick` are **tentative** and discarded if a later tick replaces
 * the head bar; on `onBarClose` the tentative value commits.
 * Reads return the active tentative value for the current step.
 *
 * Identity is stable across bars per the compiler-injected slot
 * id (§5.5). Init is evaluated once per script mount; subsequent
 * re-entries at the same callsite return the existing slot.
 *
 * @since 0.4
 * @example
 *     // const high = state.float(NaN);
 *     // high.value = bar.high;
 *     const _t: typeof state = state;
 *     void _t;
 */
export const state = Object.freeze({
    float(_init: number): MutableSlot<number> { return sentinel("state.float"); },
    int(_init: number): MutableSlot<number> { return sentinel("state.int"); },
    bool(_init: boolean): MutableSlot<boolean> { return sentinel("state.bool"); },
    string(_init: string): MutableSlot<string> { return sentinel("state.string"); },
    /**
     * Tick-persistent state slots — Pine `varip` semantics. Writes
     * commit immediately, even during a tick. Use for running per-
     * tick counters where intra-bar retraction is wrong.
     *
     * @since 0.4
     */
    tick: Object.freeze({
        float(_init: number): MutableSlot<number> { return sentinel("state.tick.float"); },
        int(_init: number): MutableSlot<number> { return sentinel("state.tick.int"); },
        bool(_init: boolean): MutableSlot<boolean> { return sentinel("state.tick.bool"); },
        string(_init: string): MutableSlot<string> { return sentinel("state.tick.string"); },
    }),
});

/**
 * Static type of the `state` namespace — sources `ComputeContext.state`
 * in the runtime hand-off. Mirrors the namespace literal so the
 * runtime impl can satisfy `typeof state` structurally.
 *
 * @since 0.4
 * @example
 *     const t: StateNamespace = state;
 *     void t;
 */
export type StateNamespace = typeof state;
```

### 3. `packages/core/src/state/index.ts` barrel

```ts
export { state, type StateNamespace } from "./state";
export type { MutableSlot } from "./mutableSlot";
```

### 4. `packages/core/src/statefulPrimitives.ts` — append 8 entries

Find the closing `] as const;` of `STATEFUL_PRIMITIVE_ENTRIES` and
append exactly 8 entries — all `slot: true`. Order: 4 `state.*`
then 4 `state.tick.*`.

```ts
    { name: "state.float", slot: true },
    { name: "state.int", slot: true },
    { name: "state.bool", slot: true },
    { name: "state.string", slot: true },
    { name: "state.tick.float", slot: true },
    { name: "state.tick.int", slot: true },
    { name: "state.tick.bool", slot: true },
    { name: "state.tick.string", slot: true },
```

The existing `statefulPrimitives.test.ts` cardinality assertion
must be bumped from `154` to **162**. The existing
`slot: true / false` breakdown (currently 153 + 1 — `ta.nz` is the
only `slot: false` entry) becomes **161 `slot: true` + 1
`slot: false`**. Add an explicit assertion that every new name is
present and resolves with `slot: true` via
`STATEFUL_PRIMITIVES_BY_NAME`.

### 5. `packages/core/src/types.ts` — extend `ComputeContext`

Add `state` to the `ComputeContext` shape so destructured
`compute({ state })` resolves through TypeScript.

```ts
import type { StateNamespace } from "./state";

export type ComputeContext = {
    readonly bar: Bar;
    readonly inputs: Readonly<Record<string, unknown>>;
    readonly ta: TaNamespace;
    readonly plot: typeof import("./plot/plot").plot;
    readonly hline: typeof import("./plot/plot").hline;
    readonly alert: typeof import("./alert/alert").alert;
    readonly draw: DrawNamespace;
    /** @since 0.4 — Pine `var` / `varip` state slots. */
    readonly state: StateNamespace;
};
```

### 6. `packages/core/src/index.ts` — re-exports

```ts
export { state } from "./state";
export type { MutableSlot, StateNamespace } from "./state";
```

### 7. Tests

- **`state.test.ts`** — every callable hole throws the sentinel
  `"state.<name> called outside an active script step"`. Covers
  all 8 holes.
- **`state.types.test.ts`** — `expect-type`:
  `expectType<MutableSlot<number>>(...returned by state.float(0)...)`
  via a contrived runtime-mocked `state` value;
  `expectType<MutableSlot<boolean>>(state.tick.bool(true))`.
- **`mutableSlot.types.test.ts`** — `expect-type` over the
  `MutableSlot<T>` shape ensuring `value` is a getter/setter
  (not a method).
- **`statefulPrimitives.test.ts`** — bumped cardinality assertion
  + explicit `has("state.float")` etc.

### 8. JSDoc gate

Every exported symbol carries `@since 0.4` + compileable
`@example`. `pnpm docs:check` stays green.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/state/mutableSlot.ts` | Create | `MutableSlot<T>` type |
| `packages/core/src/state/state.ts` | Create | 8 callable holes + `StateNamespace` type |
| `packages/core/src/state/index.ts` | Create | Barrel re-export |
| `packages/core/src/state/state.test.ts` | Create | Sentinel-throw unit tests |
| `packages/core/src/state/state.types.test.ts` | Create | `expect-type` over namespace shape |
| `packages/core/src/state/mutableSlot.types.test.ts` | Create | `expect-type` over `MutableSlot<T>` |
| `packages/core/src/statefulPrimitives.ts` | Modify | Append 8 entries |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cardinality 154 → 162 + name checks |
| `packages/core/src/types.ts` | Modify | Add `state: StateNamespace` to `ComputeContext` |
| `packages/core/src/index.ts` | Modify | Re-export `state` + types |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage on `packages/core/`)
- `pnpm docs:check`
- `pnpm readme:check`

## Edge Cases

- **Sentinel throw is reachable** — the runtime swaps the impl
  *inside* `ACTIVE_RUNTIME_CONTEXT`'s setter (Task 9). If a script
  calls `state.float(0)` at module scope, the sentinel fires. The
  test must cover both branches of every callable hole — the
  Phase-2 `ta.*` pattern is the model.
- **`STATEFUL_PRIMITIVES` cardinality is load-bearing** — the
  Phase-3 closeout test pins 154. Bumping to 162 here unblocks
  Task 8's `request.security` addition (which bumps to 163).
- **`barstate.*` / `syminfo.*` / `timeframe.*` do NOT join
  `STATEFUL_PRIMITIVES`** — they're property reads, not callable
  primitives. Task 3 ships them as `const` views.
- **`MutableSlot<T>` is intentionally minimal** — no extras. Future
  collection slots (`state.array`, `state.map`) are explicitly out
  of scope per PLAN §4.6 "Out of scope" note.

## Changeset

`.changeset/phase-4-task-02-core-state-slots.md` — **minor** on
`@invinite-org/chartlang-core`. Additive; no breaking change.

## Acceptance Criteria

- `import { state, type MutableSlot } from "@invinite-org/chartlang-core"`
  resolves.
- `state.float`, `state.int`, `state.bool`, `state.string` and the
  4 `state.tick.*` variants are callable + throw the sentinel when
  invoked outside a script step.
- `STATEFUL_PRIMITIVES.size === 162` (verified by test).
- `STATEFUL_PRIMITIVES_BY_NAME.get("state.tick.bool")?.slot ===
  true` (verified by test).
- `ComputeContext.state: StateNamespace` typechecks.
- 100% coverage on the new files.
- JSDoc `@since 0.4` + compileable `@example` on every export.
- Changeset committed.
