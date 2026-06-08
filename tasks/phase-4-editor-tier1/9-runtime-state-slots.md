# Task 9 — Runtime: `state.*` slot store + tentative/committed phases + snapshot/restore

> **Status: TODO**

## Goal

Implement the runtime side of `state.*` / `state.tick.*` per
PLAN.md §4.6. Land an in-runtime `StateSlot<T>` with two-phase
`committed` / `tentative` semantics for `state.*` and direct
`committed` writes for `state.tick.*`. Persist values through the
existing `StateStore` (`packages/runtime/src/stateStore.ts`) keyed
`${slotId}:state` so warm-restart determinism rides the Phase-1
infrastructure. Wire `state` into `ComputeContext` via
`buildComputeContext`. Prove cold/warm byte-identicality with a
determinism test.

## Prerequisites

- Task 8 (compiler injects slot ids for `state.*` calls).

## Current Behavior

- `packages/runtime/src/stateStore.ts` ships `inMemoryStateStore`
  + `StateStore` type — used by `ta.*` slots.
- `packages/runtime/src/runtimeContext.ts` `RuntimeContext` has
  `stateStore` but no `state` slot-id allocation path.
- `packages/runtime/src/buildComputeContext.ts` builds the
  `ComputeContext` without `state`.
- No tentative/committed lifecycle is wired.

## Desired Behavior

- `state.float(0)`, `state.int(0)`, `state.bool(false)`,
  `state.string("")` and their `state.tick.*` variants resolve to
  a `MutableSlot<T>` whose `get value()` / `set value(v)` read
  and write the runtime slot.
- `state.*` (non-tick) writes during a `tick` event go to
  `tentative`; on `onBarClose`, every `state.*` slot's
  `tentative → committed`. On `onBarTick`, every `state.*` slot's
  `tentative ← committed` (reset at top of tick step).
- `state.tick.*` writes go straight to `committed`.
- Snapshot/restore: slot values land in `stateStore.set(${slotId}:
  state, { committed, tentative })`. Warm-restart loads the same
  pair. The Phase-1 `inMemoryStateStore` is the only backing in
  0.4; the storage shape is forward-compatible with Phase 5's
  `PersistentStateStore`.
- Init arg is evaluated once per script mount per slot id; later
  re-entries return the existing slot.
- Determinism test: `state-counter.chart.ts` script run cold
  produces the same emissions as the same script run warm
  (`stateStore` preloaded from cold's `Map`).

## Requirements

### 1. `packages/runtime/src/state/stateSlot.ts`

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { MutableSlot } from "@invinite-org/chartlang-core";

/**
 * Internal slot the runtime hands script-facing `MutableSlot<T>`
 * proxies to. `tickPersistent: true` ⇒ `state.tick.*` (writes
 * commit immediately); `false` ⇒ `state.*` (writes are tentative
 * until `onBarClose`).
 *
 * @since 0.4
 * @example
 *     // const slot = new StateSlot(0, false);
 *     // slot.set(5);            // tentative
 *     // slot.onBarClose();      // committed = 5
 *     const _t: { committed: number; tentative: number } = { committed: 0, tentative: 0 };
 *     void _t;
 */
export class StateSlot<T> {
    constructor(init: T, public readonly tickPersistent: boolean) {
        this.committed = init;
        this.tentative = init;
    }
    committed: T;
    tentative: T;

    get(): T {
        return this.tickPersistent ? this.committed : this.tentative;
    }
    set(v: T): void {
        if (this.tickPersistent) this.committed = v;
        else this.tentative = v;
    }
    onBarClose(): void {
        if (!this.tickPersistent) this.committed = this.tentative;
    }
    onBarTick(): void {
        if (!this.tickPersistent) this.tentative = this.committed;
    }
}

/** Build the script-facing `MutableSlot<T>` proxy over a `StateSlot`. */
export function asMutableSlot<T>(slot: StateSlot<T>): MutableSlot<T> {
    return {
        get value(): T { return slot.get(); },
        set value(v: T) { slot.set(v); },
    };
}
```

### 2. `packages/runtime/src/state/stateNamespace.ts`

Build the runtime impl of the `state` namespace handed to
`ComputeContext`. **Each builder accepts the compiler-injected
`slotId` as its first parameter** — exactly mirroring the
existing `ta.*` primitive pattern (see
`packages/runtime/src/ta/sma.ts:120` for the canonical layout).
The compiler's `callsiteIdInjection` transformer rewrites
`state.float(0)` into `state.float("slot#0", 0)`; the runtime
impl reads `slotId` as arg 0.

```ts
import type { StateNamespace, MutableSlot } from "@invinite-org/chartlang-core";
import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext";
import type { RuntimeContext } from "../runtimeContext";
import { StateSlot, asMutableSlot } from "./stateSlot";

const STATE_KEY = (slotId: string): string => `${slotId}:state`;

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (!ctx) throw new Error("state called outside an active script step");
    return ctx;
}

function getOrAllocate<T>(slotId: string, init: T, tickPersistent: boolean): MutableSlot<T> {
    const ctx = getCtx();
    const key = STATE_KEY(slotId);
    let slot = ctx.stateSlots.get(key) as StateSlot<T> | undefined;
    if (!slot) {
        // Restore from store if present, else allocate from init.
        const stored = ctx.stateStore.get<{ committed: T; tentative: T }>(key);
        slot = new StateSlot<T>(stored?.committed ?? init, tickPersistent);
        if (stored) slot.tentative = stored.tentative;
        ctx.stateSlots.set(key, slot);
    }
    return asMutableSlot(slot);
}

/**
 * Build the runtime `state` namespace. Returned object is structurally
 * compatible with core's `StateNamespace`, but each function carries
 * an extra leading `slotId: string` parameter the compiler injects
 * via `callsiteIdInjection`. The cast is structural-only — TS sees
 * the user-facing `(init) => MutableSlot<T>` signature via the
 * ambient shim's `state` declaration, while the runtime sees
 * `(slotId, init) => MutableSlot<T>`.
 */
export function buildStateNamespace(): StateNamespace {
    const ns = {
        float: (slotId: string, init: number) => getOrAllocate(slotId, init, false),
        int: (slotId: string, init: number) => getOrAllocate(slotId, init, false),
        bool: (slotId: string, init: boolean) => getOrAllocate(slotId, init, false),
        string: (slotId: string, init: string) => getOrAllocate(slotId, init, false),
        tick: {
            float: (slotId: string, init: number) => getOrAllocate(slotId, init, true),
            int: (slotId: string, init: number) => getOrAllocate(slotId, init, true),
            bool: (slotId: string, init: boolean) => getOrAllocate(slotId, init, true),
            string: (slotId: string, init: string) => getOrAllocate(slotId, init, true),
        },
    };
    Object.freeze(ns.tick);
    Object.freeze(ns);
    return ns as unknown as StateNamespace;
}
```

> No `_lib/slot.ts` helper exists in the runtime; do not add one.
> The Phase-2 / Phase-3 stateful primitives all use the
> "slotId-as-first-parameter" convention (`packages/runtime/src/ta/sma.ts:120`,
> `packages/runtime/src/ta/ema.ts`, every `draw.*` impl). Task 9's
> impls follow the same convention end-to-end.

### 3. `packages/runtime/src/runtimeContext.ts` — extend

Append fields:

```ts
export type RuntimeContext = {
    readonly stream: StreamState;
    readonly stateStore: StateStore;
    readonly capabilities: Capabilities;
    readonly emissions: MutableRunnerEmissions;
    readonly barIndex: () => number;
    isTick: boolean;
    readonly drawingSlots: Map<string, DrawingSlot>;
    readonly drawingSubIdCounters: Map<string, number>;
    readonly drawingBucketCounters: Record<DrawingBucket, number>;
    readonly scriptMaxDrawings: DrawingCounts | null;
    /** @since 0.4 — `state.*` slot store keyed by `${slotId}:state`. */
    readonly stateSlots: Map<string, StateSlot<unknown>>;
};
```

### 4. `packages/runtime/src/buildComputeContext.ts` — wire `state`

```ts
import { buildStateNamespace } from "./state/stateNamespace";

return {
    bar,
    inputs,
    ta,
    plot,
    hline,
    alert,
    draw,
    state: buildStateNamespace(),
    // ... barstate / syminfo / timeframe land in Task 10
};
```

### 5. `packages/runtime/src/createScriptRunner.ts` — lifecycle hooks

In `onBarClose`: call `slot.onBarClose()` for every entry in
`ctx.stateSlots`; then `stateStore.set(key, { committed,
tentative })` for every slot whose value changed (or
unconditionally — last-write-wins).

In `onBarTick`: call `slot.onBarTick()` for every entry in
`ctx.stateSlots` BEFORE running `compute`.

In `dispose`: clear `ctx.stateSlots` + flush `stateStore` writes.

### 6. Tests

- **`stateSlot.test.ts`** — unit tests over `committed` /
  `tentative` lifecycle. Cover all four state flavours
  (`float`/`int`/`bool`/`string`) ×
  `tickPersistent: true|false`.
- **`stateNamespace.test.ts`** — integration test in a synthetic
  `ACTIVE_RUNTIME_CONTEXT`. Cover:
  - allocate-on-first-call
  - re-allocate returns existing slot
  - restore from `stateStore` returns prior `committed` +
    `tentative`
  - tentative write + `onBarTick` resets to committed
  - tentative write + `onBarClose` commits
- **`stateNamespace.property.test.ts`** — fast-check property:
  random write sequences cold and warm produce byte-identical
  observable values.
- **`determinism.test.ts`** — extend with a
  `state-counter.chart.ts` synthetic script. Cold run + warm
  run (with the cold's `stateStore` preloaded) produce the same
  emission stream over 500 bars × 50 seeds.

### 7. JSDoc gate

Every new export carries `@since 0.4` + compileable `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/state/stateSlot.ts` | Create | `StateSlot<T>` + `asMutableSlot` |
| `packages/runtime/src/state/stateNamespace.ts` | Create | Runtime `state` impl |
| `packages/runtime/src/state/index.ts` | Create | Barrel |
| `packages/runtime/src/state/stateSlot.test.ts` | Create | Slot lifecycle unit tests |
| `packages/runtime/src/state/stateNamespace.test.ts` | Create | Namespace integration tests |
| `packages/runtime/src/state/stateNamespace.property.test.ts` | Create | fast-check round-trip |
| `packages/runtime/src/runtimeContext.ts` | Modify | Add `stateSlots` field |
| `packages/runtime/src/buildComputeContext.ts` | Modify | Wire `state` |
| `packages/runtime/src/createScriptRunner.ts` | Modify | Lifecycle hooks |
| `packages/runtime/src/createScriptRunner.test.ts` | Modify | Cover the new hooks |
| `packages/runtime/src/determinism.test.ts` | Modify | state-counter cold/warm test |

## Edge Cases

- **Init arg ignored on second call** — `state.float(NaN)` on
  bar N reuses the slot from bar 0 even if the init differs.
  Test: explicit `state.float(42)` on bar 1 still returns the
  slot whose `committed` is the bar-0 init / earlier mutations.
- **`stateStore` survives across script mounts** — the runtime
  test uses the existing `inMemoryStateStore` between cold and
  warm runs; the warm run preloads the cold run's `Map`. This is
  the Phase-1 contract; nothing new needed.
- **`onBarTick` resets tentative BEFORE compute runs** — wrong
  order means within-bar tick writes leak; must be the FIRST
  thing the tick step does. Test pins ordering.
- **`state.tick.*` snapshot has no `tentative`** — the stored
  value is just the committed scalar. The restore path tolerates
  the older `{ committed, tentative }` shape (defensive: if
  `tentative` missing, copy from `committed`).
- **Coverage exemption for `state/index.ts`** — barrel exempt
  per `vitest.config.ts`.
- **`MutableSlot<T>` proxy identity is stable per slot id** —
  multiple `state.float(0)` calls at the same callsite return
  the same proxy across bars. The proxy delegates through the
  slot ref, so identity doesn't matter, but document this.
- **NaN handling** — `state.float(NaN)` is valid (PLAN §4.6
  example uses it as a "not yet set" sentinel). The slot stores
  NaN; reads return NaN; `Number.isNaN(slot.value)` is the gate.

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (100% coverage),
  `pnpm docs:check`, `pnpm readme:check`, `pnpm conformance`,
  `pnpm bench:ci`.

## Changeset

`.changeset/phase-4-task-09-runtime-state-slots.md` — **minor**
on `@invinite-org/chartlang-runtime`. Additive.

## Acceptance Criteria

- `state.float(0)` returns a `MutableSlot<number>` whose
  `value` round-trips reads and writes per the two-phase
  semantics.
- `state.tick.*` writes commit immediately.
- Cold/warm determinism test passes 500 bars × 50 seeds.
- 100% coverage on the new files.
- All Phase-3 conformance scenarios still pass.
- Phase-1/2/3 example scripts still run end-to-end.
- Changeset committed.
