# Task 10 — Runtime: `barstate` / `syminfo` / `timeframe` view wiring

> **Status: TODO**

## Goal

Populate the three Phase-4 view objects at runtime. `barstate.*`
is derived per step from `streamState`'s event-kind discrimination
+ bar-index bookkeeping. `syminfo.*` is filled at script mount
from the adapter's mount-time `SymInfo` payload + gated by
`Capabilities.symInfoFields`. `timeframe.*` is derived per step
from `bar.interval` + the active adapter's `IntervalDescriptor.
group` + a derivation table. Wire all three into
`buildComputeContext`.

## Prerequisites

- Task 9 (`buildComputeContext` already extended for `state`;
  this task adds three more fields).

## Current Behavior

- Core's `barstate` / `syminfo` / `timeframe` consts are module-
  scope defaults (Task 3).
- `ComputeContext.barstate` / `syminfo` / `timeframe` types are
  declared (Task 3).
- The runtime's `buildComputeContext` does NOT wire them.
- Adapters declare `Capabilities.symInfoFields` (Task 6) but the
  runtime does not consume it.

## Desired Behavior

- Per step, `ctx.barstate` is a frozen mutated snapshot with the
  six booleans set to the correct values:
  - `isfirst` = `barIndex() === 0`
  - `islast` = true on the most recent observed bar — derived by
    `createScriptRunner` from the event kind: realtime ticks
    (`kind === "tick"`) and the latest closed bar
    (`kind === "close"`) are `true`; older history-replay bars
    (`kind === "history"`) are `false`. `StreamState` carries no
    `isLastBar` field; the value lives in a per-step
    `BarStateInputs` payload built in `createScriptRunner` and
    handed to `makeBarStateView`.
  - `isnew` = `event.kind === "close"` OR `event.kind === "history"`
    AND this is the bar's first observation
  - `ishistory` = `event.kind === "history"`
  - `isrealtime` = `event.kind === "tick"`
  - `isconfirmed` = `event.kind === "close"`
- Per script mount, `ctx.syminfo` is filled from an adapter-
  supplied `SymInfo` payload (new type — see Task 6's
  follow-up). Fields not in `Capabilities.symInfoFields` evaluate
  to the empty sentinel.
- Per step, `ctx.timeframe.period` = `bar.interval`,
  `inSeconds` derived per the canonical group + numeric prefix
  rule (e.g. `"5m"` → 300, `"1D"` → 86400, `"1Q"` → 7_889_400).
  `isintraday` / `isdaily` / `isweekly` / `ismonthly` derived
  from the active `IntervalDescriptor.group`.

## Requirements

### 1. `packages/runtime/src/views/barstateView.ts`

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { BarStateView } from "@invinite-org/chartlang-core";
import type { RuntimeContext } from "../runtimeContext";

export type EventKind = "history" | "close" | "tick";

export type BarStateInputs = Readonly<{
    eventKind: EventKind;
    barIndex: number;
    isLastBar: boolean;
}>;

/** Build a frozen `BarStateView` for the current step. */
export function makeBarStateView(inputs: BarStateInputs): BarStateView {
    const { eventKind, barIndex, isLastBar } = inputs;
    return Object.freeze({
        isfirst: barIndex === 0,
        islast: isLastBar,
        isnew: eventKind === "history" || eventKind === "close",
        ishistory: eventKind === "history",
        isrealtime: eventKind === "tick",
        isconfirmed: eventKind === "close",
    });
}
```

### 2. `packages/runtime/src/views/symInfoView.ts`

```ts
import type {
    JsonValue, SymInfoView, SymbolType,
} from "@invinite-org/chartlang-core";

/** Adapter-supplied per-mount sym-info payload. */
export type AdapterSymInfo = Readonly<{
    ticker?: string;
    type?: SymbolType;
    mintick?: number;
    currency?: string;
    basecurrency?: string;
    exchange?: string;
    timezone?: string;
    session?: string;
    meta?: Readonly<Record<string, JsonValue>>;
}>;

const EMPTY_META: Readonly<Record<string, JsonValue>> = Object.freeze({});

/** Build a frozen `SymInfoView` from the adapter's payload,
 *  gated by `Capabilities.symInfoFields`. Fields outside the set
 *  evaluate to their empty sentinel (`""` / `NaN` / `{}`). */
export function makeSymInfoView(
    payload: AdapterSymInfo,
    enabled: ReadonlySet<string>,
): SymInfoView {
    return Object.freeze({
        ticker: enabled.has("ticker") ? (payload.ticker ?? "") : "",
        type: enabled.has("type") ? (payload.type ?? "custom") : "custom",
        mintick: enabled.has("mintick") ? (payload.mintick ?? Number.NaN) : Number.NaN,
        currency: enabled.has("currency") ? (payload.currency ?? "") : "",
        basecurrency: enabled.has("basecurrency") ? (payload.basecurrency ?? "") : "",
        exchange: enabled.has("exchange") ? (payload.exchange ?? "") : "",
        timezone: enabled.has("timezone") ? (payload.timezone ?? "") : "",
        session: enabled.has("session") ? (payload.session ?? "") : "",
        meta: enabled.has("meta") ? Object.freeze({ ...(payload.meta ?? {}) }) : EMPTY_META,
    });
}
```

### 3. `packages/runtime/src/views/timeframeView.ts`

```ts
import type {
    IntervalDescriptor, TimeframeView,
} from "@invinite-org/chartlang-core";

/** Parse the numeric prefix from an interval value (`"5m"` → 5). */
function parsePrefix(value: string): number | null {
    const m = /^(\d+)/.exec(value);
    return m ? Number(m[1]) : null;
}

/** Seconds per bar of one unit, by canonical group. */
const GROUP_SECONDS: Readonly<Record<string, number>> = Object.freeze({
    second: 1,
    minute: 60,
    hour: 3_600,
    daily: 86_400,
    weekly: 604_800,
    monthly: 2_629_800,   // 30.4375 days
    quarterly: 7_889_400, // 3 × monthly
    yearly: 31_557_600,   // 365.25 days
});

const INTRADAY_GROUPS = new Set(["second", "minute", "hour"]);
const MONTHLY_LONGER = new Set(["monthly", "quarterly", "yearly"]);

/** Build a frozen `TimeframeView` from the current bar interval +
 *  the active adapter's `IntervalDescriptor` for that interval. */
export function makeTimeframeView(
    interval: string,
    descriptor: IntervalDescriptor | undefined,
): TimeframeView {
    const group = descriptor?.group ?? "";
    const prefix = parsePrefix(interval) ?? Number.NaN;
    const unitSeconds = GROUP_SECONDS[group] ?? Number.NaN;
    const inSeconds = Number.isFinite(prefix) && Number.isFinite(unitSeconds)
        ? prefix * unitSeconds
        : Number.NaN;

    return Object.freeze({
        period: interval,
        isintraday: INTRADAY_GROUPS.has(group),
        isdaily: group === "daily",
        isweekly: group === "weekly",
        ismonthly: MONTHLY_LONGER.has(group),
        inSeconds,
    });
}
```

> `IntervalDescriptor.intervalSeconds?: number` (PLAN §4.9
> optional adapter override) is **not** consumed in Phase 4 — the
> `IntervalDescriptor` type does not declare the field today, and
> widening it is deferred to Phase 5 (see Phase-4 README
> "Deferred" section). `makeTimeframeView` derives `inSeconds`
> from `group × parsePrefix(value)` only; canvas2d's 6 canonical
> intervals all derive cleanly under this rule.

### 4. `packages/runtime/src/runtimeContext.ts` — extend

```ts
import type {
    BarStateView, SymInfoView, TimeframeView,
} from "@invinite-org/chartlang-core";

export type RuntimeContext = {
    // ... existing fields ...
    /** @since 0.4 — mutable container; each field is replaced with
     *  a fresh frozen snapshot as the runner advances. */
    views: {
        barstate: BarStateView;
        syminfo: SymInfoView;
        timeframe: TimeframeView;
    };
};
```

The `views` container is mutable; the view snapshots assigned to
its fields are frozen. Do not mutate the frozen inner objects with
`Object.assign`.

### 5. `packages/runtime/src/buildComputeContext.ts` — wire views

```ts
return {
    bar,
    inputs,
    ta,
    plot,
    hline,
    alert,
    draw,
    state: buildStateNamespace(),
    barstate: ctx.views.barstate,
    syminfo: ctx.views.syminfo,
    timeframe: ctx.views.timeframe,
    // request lands in Task 11
};
```

### 6. `packages/runtime/src/createScriptRunner.ts` — per-step refresh

`StreamState` has no `isLastBar` field; the latest-bar signal is
derived in `createScriptRunner` from the event kind:

```ts
const isLastBar = event.kind !== "history";  // ticks + closes are "live"

ctx.views.barstate = makeBarStateView({
    eventKind: event.kind,
    barIndex: ctx.barIndex(),
    isLastBar,
});
ctx.views.timeframe = makeTimeframeView(
    ctx.stream.bar.interval,
    findDescriptor(capabilities.intervals, ctx.stream.bar.interval),
);
// syminfo is mount-time only
```

Use the current bar view's interval (`ctx.stream.bar.interval` or
the local `bar.interval`) for timeframe derivation. Do **not** use
`streamState.interval` in Phase 4: per
`packages/runtime/CLAUDE.md`, the main stream is constructed with
`interval: ""` and the live interval is copied from each candle
event into `bar.interval`.

At script mount:
```ts
ctx.views.syminfo = makeSymInfoView(adapterSymInfo, capabilities.symInfoFields);
```

### 7. Adapter-kit + canvas2d — sym-info delivery

Today `Adapter` (in `packages/adapter-kit/src/types.ts`) declares
`id`, `name`, `capabilities`, `candles`, `onEmissions`, `dispose`.
This task extends it with an optional `symInfo?: AdapterSymInfo`
field — additive, no breaking change to existing adapters.
JSDoc `@since 0.4`.

`canvas2d-adapter` sets a hardcoded demo payload
(`ticker: "DEMO"`, `type: "equity"`, `mintick: 0.01`,
`currency: "USD"`, …) so conformance scenarios have a populated
view.

### 8. Tests

- **`barstateView.test.ts`** — table-driven: every combination of
  `(eventKind ∈ {history, close, tick}) × (barIndex ∈ {0, 5}) ×
  (isLastBar ∈ {true, false})` → expected boolean tuple.
- **`symInfoView.test.ts`** — payload + capability set fixtures
  covering: all fields enabled; only `ticker` enabled (others
  empty sentinel); `meta` enabled with deep nested JSON value;
  payload missing a field while capability enabled.
- **`timeframeView.test.ts`** — every canonical group string
  (`"second"`, `"minute"`, `"hour"`, `"daily"`, `"weekly"`,
  `"monthly"`, `"quarterly"`, `"yearly"`) + a custom-group
  fallback (`inSeconds === NaN`).
- **`buildComputeContext.test.ts`** — verify the three views land
  on the returned context.
- **`createScriptRunner.test.ts`** — verify per-step refresh
  ordering (views populated BEFORE compute runs).

### 9. JSDoc gate

Every new export carries `@since 0.4` + compileable `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/views/barstateView.ts` | Create | Derivation |
| `packages/runtime/src/views/symInfoView.ts` | Create | Derivation + capability gate |
| `packages/runtime/src/views/timeframeView.ts` | Create | Derivation |
| `packages/runtime/src/views/index.ts` | Create | Barrel |
| `packages/runtime/src/views/*.test.ts` | Create | Unit tests |
| `packages/runtime/src/runtimeContext.ts` | Modify | Add `views` field |
| `packages/runtime/src/buildComputeContext.ts` | Modify | Wire views |
| `packages/runtime/src/createScriptRunner.ts` | Modify | Per-step refresh |
| `packages/runtime/src/createScriptRunner.test.ts` | Modify | Cover refresh ordering |
| `packages/adapter-kit/src/types.ts` | Modify | Add `Adapter.symInfo?: AdapterSymInfo` (re-exported from runtime) |
| `examples/canvas2d-adapter/src/adapter.ts` | Modify | Wire a demo `symInfo` payload |
| `examples/canvas2d-adapter/src/adapter.test.ts` | Modify | Verify the payload |

## Edge Cases

- **`barstate.isnew`** is `true` for both `history` and `close`
  events because both represent a new bar appearing (vs. a tick
  modifying the head bar). Pine's actual semantics distinguish
  the realtime case; revisit in Phase 5 if scripts depend on
  `isnew` being false during initial history replay.
- **`syminfo.meta`** is frozen even when capability disabled —
  returns the shared `EMPTY_META` const, not a fresh `{}`. Keeps
  identity stable across bars.
- **`timeframe.inSeconds` NaN for unknown groups** — scripts
  must gate on `Number.isFinite(timeframe.inSeconds)` per
  PLAN §4.9. Default canvas2d intervals (`1m`, `5m`, …, `1W`)
  all have canonical groups so `inSeconds` is always finite
  there.
- **`intervalSeconds` override is deferred to Phase 5** —
  `IntervalDescriptor` does not declare the field in 0.4; the
  group×prefix derivation is the only path. Phase 5 widens
  `IntervalDescriptor` and adds the override branch (PLAN §4.9).
- **Determinism** — view derivation is pure; same inputs produce
  byte-identical views.
- **Coverage** — `views/index.ts` exempt per `vitest.config.ts`.

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm docs:check`,
  `pnpm readme:check`, `pnpm conformance`, `pnpm bench:ci`.

## Changeset

`.changeset/phase-4-task-10-runtime-views.md` — **minor** on
`@invinite-org/chartlang-runtime` + `@invinite-org/chartlang-
adapter-kit` (adds optional `Adapter.symInfo`).

## Acceptance Criteria

- `compute({ barstate, syminfo, timeframe })` resolves at
  runtime with populated views.
- Every per-step `barstate` snapshot matches the expected tuple.
- `syminfo` honours `Capabilities.symInfoFields` gating.
- `timeframe` derives correctly across all canonical groups.
- 100% coverage on the new files.
- All Phase-3 conformance scenarios still pass.
- Changeset committed.
