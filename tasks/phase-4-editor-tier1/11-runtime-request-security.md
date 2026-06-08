# Task 11 — Runtime: `request.security` typed runtime + NaN fallback

> **Status: TODO**

## Goal

Wire the runtime side of `request.security({ interval })` per
PLAN.md §4.5 / §7.4. The HTF time-alignment kernel does NOT land
here (Phase 5 — `align-htf-series-to-ltf.ts` port). Phase 4 ships
the **NaN-fallback** path: when `Capabilities.multiTimeframe:
false`, every `request.security(...)` call returns a `SecurityBar`
whose every field is an all-NaN `Series<number>` (or
empty-string `Series<string>`), and a `multi-timeframe-not-
supported` diagnostic is pushed once per script mount. When the
requested interval is not in `Capabilities.intervals`, fall back
to NaN + emit `unsupported-interval`.

## Prerequisites

- Task 10 (`buildComputeContext` is at the Task-10 baseline;
  this task adds `request` to it).

## Current Behavior

- `request.security` is a callable hole in core (Task 5).
- `manifest.requestedIntervals` carries the literal set (Task 8).
- The runtime has no `request` namespace impl.
- The runtime has no secondary-stream ring buffer.

## Desired Behavior

- `compute({ request })` at runtime returns a real
  `request.security({ interval: "1D" })` impl that:
  - **Capability check 1**: if `interval` is not in
    `capabilities.intervals.map(d => d.value)`, push
    `unsupported-interval` once per (mount × interval), return
    NaN `SecurityBar`.
  - **Capability check 2**: if `capabilities.multiTimeframe ===
    false`, push `multi-timeframe-not-supported` once per
    (mount × interval), return NaN `SecurityBar`.
  - **Happy path**: when both checks pass, return the per-slot
    cached `SecurityBar`. In Phase 4 the cache always returns
    NaN (no alignment kernel); Phase 5 wires the real series
    pull.
- The `slotId` injected at the call site keys the per-slot
  `SecurityBar` instance — `request.security({ interval: "1D" })`
  at slot `slot#0` and slot `slot#1` get distinct stable
  `SecurityBar` references across bars.
- Cardinality of script-level NaN warnings ≤ 1 per (interval ×
  mount) so loop-emitting scripts don't flood diagnostics.

## Requirements

### 1. `packages/runtime/src/request/securityBarStub.ts`

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { SecurityBar, Series } from "@invinite-org/chartlang-core";

/**
 * Build an all-NaN `SecurityBar` reusable across the Phase-4
 * lifetime. Identity is per slot; mutation is forbidden.
 *
 * Phase 5 replaces the impl with a real series-backed bar
 * pulled from the secondary-stream ring buffer.
 *
 * @since 0.4
 * @example
 *     // const bar = makeNanSecurityBar();
 *     // bar.close.current === NaN
 *     const _t: SecurityBar = makeNanSecurityBar();
 *     void _t;
 */
export function makeNanSecurityBar(): SecurityBar {
    const nanNumberSeries: Series<number> = Object.freeze({
        current: Number.NaN,
        length: 0,
    }) as unknown as Series<number>;
    const nanStringSeries: Series<string> = Object.freeze({
        current: "",
        length: 0,
    }) as unknown as Series<string>;
    return Object.freeze({
        time: nanNumberSeries,
        open: nanNumberSeries,
        high: nanNumberSeries,
        low: nanNumberSeries,
        close: nanNumberSeries,
        volume: nanNumberSeries,
        hl2: nanNumberSeries,
        hlc3: nanNumberSeries,
        ohlc4: nanNumberSeries,
        hlcc4: nanNumberSeries,
        symbol: nanStringSeries,
        interval: nanStringSeries,
    });
}
```

The `Series<T>` shape only carries `current` + `length`; the
`[n: number]` lookup yields `undefined`, which TypeScript widens
to `T` per the existing `Series<T>` signature. Runtime tests
verify `current` is NaN / empty string and that indexed access is
`undefined` in the Phase-4 stub; Phase 5's real ring-buffer-backed
series supplies historical values.

### 2. `packages/runtime/src/request/requestNamespace.ts`

```ts
import type {
    RequestNamespace, RequestSecurityOpts, SecurityBar,
} from "@invinite-org/chartlang-core";
import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext";
import { makeNanSecurityBar } from "./securityBarStub";

/** Build the runtime `request` namespace.
 *
 * `request.security` accepts the compiler-injected `slotId` as its
 * first parameter — same pattern as `ta.*` / `state.*` primitives.
 * The compiler's `callsiteIdInjection` transformer rewrites
 * `request.security({ interval: "1D" })` into
 * `request.security("slot#0", { interval: "1D" })`. */
export function buildRequestNamespace(): RequestNamespace {
    const ns = {
        security: (slotId: string, opts: RequestSecurityOpts): SecurityBar => {
            const ctx = ACTIVE_RUNTIME_CONTEXT.current;
            if (!ctx) throw new Error("request.security called outside an active script step");

            // Cache the SecurityBar per (slotId, interval) to keep identity stable.
            const cacheKey = `${slotId}|${opts.interval}`;
            let bar = ctx.requestSecurityBars.get(cacheKey);
            if (bar) return bar;

            // Diagnostic dedup — fire at most once per (mount, interval, slotId).
            const known = ctx.capabilities.intervals.some((d) => d.value === opts.interval);
            if (!known) {
                pushOnce(ctx, "unsupported-interval", `Requested interval "${opts.interval}" is not in Capabilities.intervals`, slotId);
            } else if (!ctx.capabilities.multiTimeframe) {
                pushOnce(ctx, "multi-timeframe-not-supported", `Adapter ships multiTimeframe: false; request.security returns NaN`, slotId);
            }

            bar = makeNanSecurityBar();
            ctx.requestSecurityBars.set(cacheKey, bar);
            return bar;
        },
    };
    Object.freeze(ns);
    return ns as unknown as RequestNamespace;
}

function pushOnce(ctx: RuntimeContext, code: string, message: string, slotId: string): void {
    const key = `${code}|${slotId}`;
    if (ctx.diagnosedRequestKeys.has(key)) return;
    ctx.diagnosedRequestKeys.add(key);
    ctx.emissions.diagnostics.push({
        kind: "diagnostic",
        code,
        message,
        relatedCallsite: slotId,
        bar: ctx.barIndex(),
        time: ctx.stream.bar.time,
    });
}
```

### 3. `packages/runtime/src/runtimeContext.ts` — extend

```ts
export type RuntimeContext = {
    // ... existing fields ...
    /** @since 0.4 — per-(slotId, interval) `SecurityBar` cache. */
    readonly requestSecurityBars: Map<string, SecurityBar>;
    /** @since 0.4 — dedup for `unsupported-interval` / `multi-timeframe-not-supported`. */
    readonly diagnosedRequestKeys: Set<string>;
};
```

### 4. `packages/runtime/src/buildComputeContext.ts` — wire request

```ts
return {
    bar, inputs, ta, plot, hline, alert, draw,
    state: buildStateNamespace(),
    barstate: ctx.views.barstate,
    syminfo: ctx.views.syminfo,
    timeframe: ctx.views.timeframe,
    request: buildRequestNamespace(),
};
```

### 5. `packages/runtime/src/createScriptRunner.ts` — diagnostic codes

Both `"unsupported-interval"` and `"multi-timeframe-not-supported"`
are **already** declared in adapter-kit's `DiagnosticCode` union
(`packages/adapter-kit/src/types.ts`). No type extension is
needed. This task is the first to emit them at runtime — verify
the union still includes them and that the emission shape matches
`RuntimeDiagnostic`.

### 6. Tests

- **`securityBarStub.test.ts`** — verify every field reads NaN /
  empty string and verify `Object.isFrozen`. Do not require
  identity stability across separate `makeNanSecurityBar()` calls;
  stable identity is the request-namespace cache's responsibility.
- **`requestNamespace.test.ts`** — integration with synthetic
  `ACTIVE_RUNTIME_CONTEXT`:
  - Happy path: known interval + `multiTimeframe: true` returns
    NaN bar (Phase 4 stub) without diagnostics.
  - Unknown interval: emits `unsupported-interval` once across
    multiple bar steps.
  - `multiTimeframe: false`: emits `multi-timeframe-not-
    supported` once.
  - Two `request.security` calls at different slot ids: distinct
    `SecurityBar` references; per-slot dedup of diagnostics.
  - Two calls at the same slot id: identity stable; no duplicate
    emissions.
- **`createScriptRunner.test.ts`** — verify the cache is reset on
  `dispose`.

### 7. JSDoc gate

Every new export carries `@since 0.4` + compileable `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/request/securityBarStub.ts` | Create | NaN-bar factory |
| `packages/runtime/src/request/requestNamespace.ts` | Create | Runtime `request` impl |
| `packages/runtime/src/request/index.ts` | Create | Barrel |
| `packages/runtime/src/request/securityBarStub.test.ts` | Create | NaN-invariant unit tests |
| `packages/runtime/src/request/requestNamespace.test.ts` | Create | Capability-gating tests |
| `packages/runtime/src/runtimeContext.ts` | Modify | Add cache + dedup set |
| `packages/runtime/src/buildComputeContext.ts` | Modify | Wire `request` |
| `packages/runtime/src/createScriptRunner.ts` | Modify | Reset cache on dispose |
| `packages/runtime/src/createScriptRunner.test.ts` | Modify | Cover dispose |
| `packages/adapter-kit/src/types.ts` | Verify only | Both diagnostic codes already declared |

## Edge Cases

- **Dedup per (slotId, interval, code)** — a script that calls
  `request.security({ interval: "1D" })` 1000 bars in a row emits
  the diagnostic ONCE. Looped-callsite scripts are still flagged
  by `stateful-call-inside-loop` at compile time, but defense in
  depth: runtime dedup ensures diagnostics don't flood.
- **Identity stability** — the same `SecurityBar` reference must
  be returned across bars for the same (slotId, interval). This
  matters for scripts that cache `daily.close` in a `state.*`
  slot.
- **Unknown intervals NEVER trigger
  `multi-timeframe-not-supported`** — the unknown-interval check
  is exclusive. Otherwise scripts targeting wrong intervals get
  noisy duplicated diagnostics.
- **Phase-5 forward-compat** — when Phase 5 swaps in the real
  alignment kernel, the cache key + the `requestSecurityBars`
  map structure stays. The `makeNanSecurityBar` factory gets
  replaced with `makeAlignedSecurityBar(slotId, interval, stream)`.
- **Coverage** — `request/index.ts` exempt.
- **No `STATEFUL_PRIMITIVES` change here** — Task 8 already added
  `request.security` to the set. Slot-id injection is in place;
  this task just consumes it at runtime.

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (100% coverage),
  `pnpm docs:check`, `pnpm readme:check`, `pnpm conformance`
  (existing scenarios still pass; new scenarios land in Task 16),
  `pnpm bench:ci`.

## Changeset

`.changeset/phase-4-task-11-runtime-request-security.md` —
**minor** on `@invinite-org/chartlang-runtime`. Adapter-kit is
unchanged (the diagnostic codes are pre-declared).

## Acceptance Criteria

- `request.security({ interval: "1D" })` returns a stable
  `SecurityBar` per slot.
- Phase-4 stub yields NaN for every numeric field.
- Diagnostics fire once per (slotId, interval, code) with the
  expected payload.
- 100% coverage on the new files.
- All Phase-3 conformance scenarios still pass.
- Changeset committed.
