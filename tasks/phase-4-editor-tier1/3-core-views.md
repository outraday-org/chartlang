# Task 3 — Core: `barstate` / `syminfo` / `timeframe` views + `SymbolType`

> **Status: TODO**

## Goal

Land the three read-only view objects from PLAN.md §4.7 / §4.8 /
§4.9 — `barstate`, `syminfo`, `timeframe` — plus the `SymbolType`
union. These are not slot-keyed primitives; they're property bags
on `ComputeContext` that the runtime replaces per bar
(`barstate`, `timeframe`) or per script mount (`syminfo`). This
task ships the
**types + the const exports** so scripts can `import { barstate }
from "@invinite-org/chartlang-core"` and `compute({ barstate,
syminfo, timeframe })` typechecks. Runtime population via
per-step/per-mount snapshots lands in Task 10.

## Prerequisites

- Task 2 (extends `ComputeContext` — Task 3 adds three more
  fields in lockstep).

## Current Behavior

- `barstate.*`, `syminfo.*`, `timeframe.*` are documented in
  PLAN.md but undeclared in code.
- `SymbolType` is undeclared.
- `ComputeContext` has no `barstate`, `syminfo`, or `timeframe`
  fields.

## Desired Behavior

- `import { barstate, syminfo, timeframe, type SymbolType } from
  "@invinite-org/chartlang-core"` resolves.
- `barstate` is a frozen module-scope default object whose 6
  boolean fields all default to `false`. The runtime does not
  mutate this object; it supplies per-step `BarStateView`
  snapshots through `ComputeContext`.
- `syminfo` is a frozen module-scope default object whose fields
  default to their type's empty sentinel (`""` for strings, `NaN`
  for numbers, `{}` for `meta`). The runtime supplies a per-mount
  `SymInfoView` through `ComputeContext`.
- `timeframe` is a frozen module-scope default object. The
  runtime supplies per-step `TimeframeView` snapshots derived
  from the active `bar.interval` + adapter's
  `IntervalDescriptor.group`.
- `ComputeContext.barstate: BarStateView`, `syminfo: SymInfoView`,
  `timeframe: TimeframeView` — the runtime's `buildComputeContext`
  hands the current snapshot.

## Requirements

### 1. `packages/core/src/views/barstate.ts`

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Bar-state view — PLAN.md §4.7. Mirrors Pine's `barstate.*`. All
 * six fields are derived per step from the runtime's event-type
 * discrimination (`history` / `close` / `tick`) and bar-index
 * bookkeeping. The exported module-scope value is only the
 * default fallback; the runtime supplies a per-step snapshot
 * through `ComputeContext`.
 *
 * Module-scope reads outside a script step yield the type
 * defaults (every field is `false`).
 *
 * @since 0.4
 * @example
 *     // function compute({ barstate, alert }) {
 *     //     if (!barstate.isconfirmed) return;
 *     //     alert("confirmed", { severity: "info" });
 *     // }
 *     const _t: BarStateView = barstate;
 *     void _t;
 */
export type BarStateView = {
    /** True on the first historical bar of this script mount. */
    readonly isfirst: boolean;
    /** True on the most recent bar (live or replay). */
    readonly islast: boolean;
    /** True if a new bar opened on this step. False on ticks within a bar. */
    readonly isnew: boolean;
    /** True if the runtime is in the historical-replay phase. */
    readonly ishistory: boolean;
    /** True if the runtime is processing a realtime feed. */
    readonly isrealtime: boolean;
    /** True if this step is a `kind: "close"` event. False on ticks. */
    readonly isconfirmed: boolean;
};

/**
 * Module-scope `barstate` instance. The runtime supplies a
 * per-step snapshot via the `ComputeContext` hand-off; outside a
 * script step, every field is `false`.
 *
 * @since 0.4
 * @example
 *     import { barstate } from "@invinite-org/chartlang-core";
 *     // barstate.isfirst — true on bar 0 inside compute
 *     void barstate;
 */
export const barstate: BarStateView = Object.freeze({
    isfirst: false,
    islast: false,
    isnew: false,
    ishistory: false,
    isrealtime: false,
    isconfirmed: false,
});
```

### 2. `packages/core/src/views/syminfo.ts`

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { JsonValue } from "../types";

/**
 * Symbol-type union — PLAN.md §4.8. Adapters that ship a custom
 * symbol type that doesn't fit return `"custom"`.
 *
 * @since 0.4
 * @example
 *     const t: SymbolType = "equity";
 *     void t;
 */
export type SymbolType =
    | "equity" | "futures" | "forex" | "crypto"
    | "index" | "fund" | "bond" | "commodity"
    | "custom";

/**
 * Symbol-metadata view — PLAN.md §4.8. Read-only. Fields not in the
 * adapter's `Capabilities.symInfoFields` set evaluate to the type's
 * empty sentinel (`""` / `NaN` / `{}`). Scripts gate logic on
 * `Number.isFinite(syminfo.mintick)` etc.
 *
 * @since 0.4
 * @example
 *     // function compute({ syminfo, bar }) {
 *     //     if (!Number.isFinite(syminfo.mintick)) return;
 *     //     const snapped = Math.round(bar.close / syminfo.mintick) * syminfo.mintick;
 *     // }
 *     const _t: SymInfoView = syminfo;
 *     void _t;
 */
export type SymInfoView = {
    readonly ticker: string;
    readonly type: SymbolType;
    readonly mintick: number;
    readonly currency: string;
    readonly basecurrency: string;
    readonly exchange: string;
    readonly timezone: string;
    readonly session: string;
    readonly meta: Readonly<Record<string, JsonValue>>;
};

/**
 * Module-scope `syminfo` instance. The runtime supplies a
 * per-mount snapshot via `ComputeContext`; outside a script step
 * every field evaluates to its empty sentinel.
 *
 * @since 0.4
 * @example
 *     import { syminfo } from "@invinite-org/chartlang-core";
 *     void syminfo;
 */
export const syminfo: SymInfoView = Object.freeze({
    ticker: "",
    type: "custom" as SymbolType,
    mintick: Number.NaN,
    currency: "",
    basecurrency: "",
    exchange: "",
    timezone: "",
    session: "",
    meta: Object.freeze({}),
});
```

### 3. `packages/core/src/views/timeframe.ts`

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Timeframe-derived helpers — PLAN.md §4.9. The runtime computes
 * the booleans from `bar.interval` + the active adapter's
 * `IntervalDescriptor.group`; `inSeconds` is derived from the
 * group + a numeric prefix in `value`.
 *
 * Canonical groups: `"second"`, `"minute"`, `"hour"`, `"daily"`,
 * `"weekly"`, `"monthly"`, `"quarterly"`, `"yearly"`. Adapter
 * custom groups don't trigger the helpers — scripts that need a
 * custom-group check do it directly on `bar.interval`.
 * (PLAN §4.9 sketches an optional adapter `intervalSeconds`
 * override; widening `IntervalDescriptor` is deferred to Phase 5.)
 *
 * @since 0.4
 * @example
 *     // function compute({ bar, timeframe, ta }) {
 *     //     if (!timeframe.isdaily) return;
 *     //     ta.rsi(bar.close, 14);
 *     // }
 *     const _t: TimeframeView = timeframe;
 *     void _t;
 */
export type TimeframeView = {
    /** Same as `bar.interval`. */
    readonly period: string;
    /** True iff `IntervalDescriptor.group` is `"second"` / `"minute"` / `"hour"`. */
    readonly isintraday: boolean;
    /** True iff `IntervalDescriptor.group` is `"daily"`. */
    readonly isdaily: boolean;
    /** True iff `IntervalDescriptor.group` is `"weekly"`. */
    readonly isweekly: boolean;
    /** True iff `IntervalDescriptor.group` is `"monthly"` or longer. */
    readonly ismonthly: boolean;
    /** Approximate seconds per bar at this interval. NaN if unknown. */
    readonly inSeconds: number;
};

export const timeframe: TimeframeView = Object.freeze({
    period: "",
    isintraday: false,
    isdaily: false,
    isweekly: false,
    ismonthly: false,
    inSeconds: Number.NaN,
});
```

### 4. `packages/core/src/views/index.ts` barrel

```ts
export { barstate, type BarStateView } from "./barstate";
export { syminfo, type SymbolType, type SymInfoView } from "./syminfo";
export { timeframe, type TimeframeView } from "./timeframe";
```

### 5. `packages/core/src/types.ts` — extend `ComputeContext`

```ts
import type { BarStateView, SymInfoView, TimeframeView } from "./views";

export type ComputeContext = {
    readonly bar: Bar;
    readonly inputs: Readonly<Record<string, unknown>>;
    readonly ta: TaNamespace;
    readonly plot: typeof import("./plot/plot").plot;
    readonly hline: typeof import("./plot/plot").hline;
    readonly alert: typeof import("./alert/alert").alert;
    readonly draw: DrawNamespace;
    readonly state: StateNamespace;
    /** @since 0.4 — PLAN §4.7. */
    readonly barstate: BarStateView;
    /** @since 0.4 — PLAN §4.8. */
    readonly syminfo: SymInfoView;
    /** @since 0.4 — PLAN §4.9. */
    readonly timeframe: TimeframeView;
};
```

### 6. `packages/core/src/index.ts` — re-exports

```ts
export { barstate, syminfo, timeframe } from "./views";
export type {
    BarStateView, SymbolType, SymInfoView, TimeframeView,
} from "./views";
```

### 7. Tests

- **`barstate.test.ts`** — assert module-scope defaults (every
  field `false`); assert `Object.isFrozen(barstate)`. Negative
  test: mutating in strict mode throws.
- **`syminfo.test.ts`** — assert every field defaults to the
  empty sentinel; `Object.isFrozen(syminfo)`; `meta` is frozen.
- **`timeframe.test.ts`** — assert defaults (`period === ""`,
  every boolean false, `inSeconds` is NaN); `Object.isFrozen`.
- **`barstate.types.test.ts`** / **`syminfo.types.test.ts`** /
  **`timeframe.types.test.ts`** — `expect-type` over each view's
  shape (`expectType<BarStateView>(barstate)`, etc.).

### 8. JSDoc gate

Every exported symbol carries `@since 0.4` + compileable
`@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/views/barstate.ts` | Create | `BarStateView` + `barstate` const |
| `packages/core/src/views/syminfo.ts` | Create | `SymInfoView` + `SymbolType` + `syminfo` const |
| `packages/core/src/views/timeframe.ts` | Create | `TimeframeView` + `timeframe` const |
| `packages/core/src/views/index.ts` | Create | Barrel |
| `packages/core/src/views/barstate.test.ts` | Create | Defaults + frozen invariant |
| `packages/core/src/views/syminfo.test.ts` | Create | Defaults + frozen invariant |
| `packages/core/src/views/timeframe.test.ts` | Create | Defaults + frozen invariant |
| `packages/core/src/views/*.types.test.ts` | Create | `expect-type` over each view |
| `packages/core/src/types.ts` | Modify | Add `barstate`, `syminfo`, `timeframe` to `ComputeContext` |
| `packages/core/src/index.ts` | Modify | Re-export the three consts + types |

## Edge Cases

- **`syminfo.meta` is frozen** — must walk via
  `Object.isFrozen(syminfo.meta) === true` since downstream
  consumers may mutate-by-spread. Lock it the same way Phase 3
  locks `manifest.inputs`.
- **`syminfo.mintick` default is NaN, not 0** — scripts that
  divide by `mintick` propagate NaN (correct silent degradation
  per §7.4); zero would div-by-zero, which is wrong.
- **`timeframe.inSeconds` default is NaN** — same reasoning.
- **Views do NOT join `STATEFUL_PRIMITIVES`** — they're property
  reads, not callable primitives. The compiler resolves them as
  named-import identifiers via the ambient shim only.

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (100% coverage on
  `packages/core/`), `pnpm docs:check`, `pnpm readme:check`.

## Changeset

`.changeset/phase-4-task-03-core-views.md` — **minor** on
`@invinite-org/chartlang-core`. Additive.

## Acceptance Criteria

- `import { barstate, syminfo, timeframe, type SymbolType } from
  "@invinite-org/chartlang-core"` resolves.
- Each view is frozen at module scope and defaults to the
  documented empty sentinels.
- `ComputeContext` carries the three new view fields.
- Type tests pass.
- 100% coverage on the new files.
- JSDoc + `pnpm docs:check` green.
- Changeset committed.
