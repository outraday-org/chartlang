# Task 5 — Core: `request.security` typed namespace

> **Status: TODO**

## Goal

Land the `request.security({ interval })` typed surface in
`@invinite-org/chartlang-core` per PLAN.md §4.5. Ship the
`RequestNamespace` shape, the `request` const callable hole, the
`RequestSecurityOpts` arg type, and the `SecurityBar` return type
(`Bar`-shape whose fields are filled by the runtime — see Task 11
for the NaN-fallback impl). The compiler's literal-only pass
(Task 8) enforces that `interval` is a string literal or
`input.enum` value. This task ships **types only** — the runtime
hole throws the sentinel.

## Prerequisites

- Task 4 (`ScriptManifest` carries `requestedIntervals` already,
  but the override types from Task 4 ride alongside the
  `request.*` namespace declarations the compiler shim consumes
  in Task 8).

## Current Behavior

- `request.security` is documented in PLAN §4.5 but undeclared in
  code.
- `ComputeContext` has no `request` field.
- The compiler shim has no `request` declaration.

## Desired Behavior

- `import { request } from "@invinite-org/chartlang-core"` resolves
  to a callable hole `request.security(opts)` that throws the
  sentinel outside a script step.
- `request.security({ interval: "1D" })` returns `SecurityBar` —
  a `Bar`-shape whose every field is `Series<number>` or
  `Series<string>`.
- `RequestSecurityOpts = { interval: string }` — minimum viable
  shape for Phase 4. Phase 5 may extend (gaps policy, lookahead).
- `ComputeContext.request: RequestNamespace` typechecks; `compute
  ({ request })` resolves.

## Requirements

### 1. `packages/core/src/request/request.ts`

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Price, Series, Time, Volume } from "../types";

/**
 * Argument to {@link request.security}. The `interval` MUST be a
 * string literal or an `input.enum` value — never a dynamic
 * expression. Enforced at compile time by the §5.6 literal-only
 * pass (`request-security-interval-not-literal` diagnostic).
 *
 * @since 0.4
 * @example
 *     const o: RequestSecurityOpts = { interval: "1D" };
 *     void o;
 */
export type RequestSecurityOpts = Readonly<{ interval: string }>;

/**
 * `Bar`-shape return value of {@link request.security}. Every
 * field is a `Series<...>` view backed by the runtime's secondary-
 * stream ring buffer (or an all-NaN ring when
 * `Capabilities.multiTimeframe: false`). Time-aligned to the
 * main-stream bar per PLAN §6.8.
 *
 * Phase 4 ships the type; the all-NaN fallback path; and the
 * `multi-timeframe-not-supported` diagnostic emit. Phase 5 lands
 * the alignment kernel (`align-htf-series-to-ltf.ts` port).
 *
 * @since 0.4
 * @example
 *     // function compute({ bar, request, ta }) {
 *     //     const daily = request.security({ interval: "1D" });
 *     //     ta.ema(daily.close, 20);
 *     // }
 *     const _t: SecurityBar = {
 *         time: { current: 0, length: 0 } as Series<Time>,
 *         open: { current: 0, length: 0 } as Series<Price>,
 *         high: { current: 0, length: 0 } as Series<Price>,
 *         low: { current: 0, length: 0 } as Series<Price>,
 *         close: { current: 0, length: 0 } as Series<Price>,
 *         volume: { current: 0, length: 0 } as Series<Volume>,
 *         hl2: { current: 0, length: 0 } as Series<Price>,
 *         hlc3: { current: 0, length: 0 } as Series<Price>,
 *         ohlc4: { current: 0, length: 0 } as Series<Price>,
 *         hlcc4: { current: 0, length: 0 } as Series<Price>,
 *         symbol: { current: "", length: 0 } as Series<string>,
 *         interval: { current: "", length: 0 } as Series<string>,
 *     };
 *     void _t;
 */
export type SecurityBar = Readonly<{
    time: Series<Time>;
    open: Series<Price>;
    high: Series<Price>;
    low: Series<Price>;
    close: Series<Price>;
    volume: Series<Volume>;
    hl2: Series<Price>;
    hlc3: Series<Price>;
    ohlc4: Series<Price>;
    hlcc4: Series<Price>;
    symbol: Series<string>;
    interval: Series<string>;
}>;

const sentinel = (name: string): never => {
    throw new Error(`${name} called outside an active script step`);
};

/**
 * `request.*` namespace — Pine's `request.security` equivalent.
 * The compiler walks `request.security(...)` calls to populate
 * `manifest.requestedIntervals`; the runtime returns either the
 * aligned secondary stream or an all-NaN `SecurityBar` when the
 * adapter ships `Capabilities.multiTimeframe: false`.
 *
 * @since 0.4
 * @example
 *     // const daily = request.security({ interval: "1D" });
 *     const _t: typeof request = request;
 *     void _t;
 */
export const request = Object.freeze({
    security(_opts: RequestSecurityOpts): SecurityBar { return sentinel("request.security"); },
});

/**
 * Static type of the `request` namespace — sources
 * `ComputeContext.request`.
 *
 * @since 0.4
 * @example
 *     const t: RequestNamespace = request;
 *     void t;
 */
export type RequestNamespace = typeof request;
```

### 2. `packages/core/src/request/index.ts` barrel

```ts
export { request, type RequestNamespace, type RequestSecurityOpts, type SecurityBar } from "./request";
```

### 3. `packages/core/src/types.ts` — extend `ComputeContext`

```ts
import type { RequestNamespace } from "./request";

export type ComputeContext = {
    readonly bar: Bar;
    readonly inputs: Readonly<Record<string, unknown>>;
    readonly ta: TaNamespace;
    readonly plot: typeof import("./plot/plot").plot;
    readonly hline: typeof import("./plot/plot").hline;
    readonly alert: typeof import("./alert/alert").alert;
    readonly draw: DrawNamespace;
    readonly state: StateNamespace;
    readonly barstate: BarStateView;
    readonly syminfo: SymInfoView;
    readonly timeframe: TimeframeView;
    /** @since 0.4 — PLAN §4.5. */
    readonly request: RequestNamespace;
};
```

### 4. `packages/core/src/index.ts` — re-exports

```ts
export { request } from "./request";
export type {
    RequestNamespace, RequestSecurityOpts, SecurityBar,
} from "./request";
```

### 5. Tests

- **`request.test.ts`** — call `request.security({ interval:
  "1D" })` at module scope; assert the sentinel throws.
- **`request.types.test.ts`** — `expect-type`:
  `expectType<SecurityBar>(...returned by a mocked impl...)`;
  `expectType<RequestSecurityOpts>({ interval: "5m" })`.
- **`securityBar.types.test.ts`** — `expect-type` over every
  field carrying the right `Series<...>` shape.

### 6. JSDoc gate

Every export carries `@since 0.4` + a compileable `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/request/request.ts` | Create | `request` const + `RequestNamespace` + opts + return shape |
| `packages/core/src/request/index.ts` | Create | Barrel |
| `packages/core/src/request/request.test.ts` | Create | Sentinel throws |
| `packages/core/src/request/request.types.test.ts` | Create | `expect-type` over opts + return |
| `packages/core/src/request/securityBar.types.test.ts` | Create | `expect-type` over field types |
| `packages/core/src/types.ts` | Modify | Add `request: RequestNamespace` to `ComputeContext` |
| `packages/core/src/index.ts` | Modify | Re-export `request` + types |

## Edge Cases

- **No `STATEFUL_PRIMITIVES` addition here** — Task 8 appends
  `{ name: "request.security", slot: true }` when it lands the
  compiler pass. Splitting prevents Task 5 from being a
  cardinality-bump cliff before the pass exists.
- **`SecurityBar` is a `Series<T>`-shape, not a `Bar`-shape** —
  scripts read `daily.close.current` (a `Series<Price>` lookup),
  not `daily.close` (a scalar `Price`). This is a deliberate
  divergence from `Bar` so HTF reads can index history (`daily.
  close[5]` = 5 daily bars back) once the alignment kernel lands.
- **`interval` is a runtime `Series<string>`** — even though the
  interval is compile-time literal, the runtime exposes it as a
  series so scripts can read `daily.interval.current` for logs.
- **Sentinel is reachable** — runtime swaps in
  `ComputeContext.request` via `buildComputeContext` (Task 11).
  Module-scope calls trip the sentinel; both branches of every
  hole are covered.

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (100% coverage),
  `pnpm docs:check`, `pnpm readme:check`.

## Changeset

`.changeset/phase-4-task-05-core-request-security.md` — **minor**
on `@invinite-org/chartlang-core`. Additive.

## Acceptance Criteria

- `import { request, type SecurityBar } from "@invinite-org/
  chartlang-core"` resolves.
- `request.security({ interval: "1D" })` at module scope throws
  the sentinel.
- `ComputeContext.request: RequestNamespace` typechecks.
- 100% coverage on the new files.
- JSDoc + `pnpm docs:check` green.
- Changeset committed.
