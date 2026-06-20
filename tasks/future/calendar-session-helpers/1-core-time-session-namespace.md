# Task 1 — Core `time.*` / `session.*` namespace + registry + compiler shim

> **Status: TODO**

## Goal

Introduce two new script-facing namespaces in core — `time` (calendar
accessors) and `session` (`isOpen`) — as frozen objects of **sentinel holes**
(the runtime installs the real behavior, like every other primitive), wire them
onto `ComputeContext`, re-export from the package root, append their entries to
`STATEFUL_PRIMITIVES` as **`slot: false`** (stateless, like `ta.nz`), and mirror
all of it in the compiler's ambient shim (`program.ts`) in lockstep. Add
type-level tests. Create the feature changeset.

## Prerequisites

None.

## Current Behavior

- Script-facing callables are sentinel holes that throw `"<name> called outside
  an active script step"` when invoked directly (`packages/core/CLAUDE.md`);
  the runtime installs the real impl on `ComputeContext`.
- `ComputeContext` (`packages/core/src/types.ts:705-720`) lists `bar`, `inputs`,
  `ta`, `plot`, `hline`, `alert`, `state`, `barstate`, `syminfo`, `timeframe`,
  `request`, `runtime`. There is **no** `time` or `session` field.
- `STATEFUL_PRIMITIVES` (`packages/core/src/statefulPrimitives.ts`) carries
  `ta.nz` as the only `slot: false` entry (`:114`); `STATEFUL_PRIMITIVES_BY_NAME`
  derives from the same canonical list.
- `Time = number` is UTC ms epoch (`types.ts:24`).
- `program.ts` ambient shim mirrors every core export, including the
  `ComputeContext` member list (`:1345-1348` region) and the
  `STATEFUL_PRIMITIVES` shape, in lockstep.

## Desired Behavior

- `time.year(bar.time)` … `time.second(bar.time)` and `time.dayofweek(bar.time)`
  type-check and return `number`; each accepts an optional `tz?: string` second
  argument. `time.timestamp(2024, 1, 2)` (and with `hh/mm/ss/tz`) returns a
  `Time`.
- `session.isOpen(bar.time, "0930-1600")` type-checks and returns `boolean`;
  optional `tz?: string` third argument.
- Calling any of them directly outside a step throws the active-step sentinel.
- The compiler program type-checks the same (shim mirrors core).
- The registry gains `time.*` + `session.isOpen` entries as `slot: false` —
  no callsite-id injection, but still flagged by `stateful-call-inside-loop`.

## Requirements

### 1. New `time` namespace (`packages/core/src/time-accessors/timeAccessors.ts`, new)

> Use a NEW folder `time-accessors/` for the **script-facing** namespace. Do
> NOT touch `packages/core/src/time/` — that is the host-only `Intl` folder and
> stays unexported (its `CLAUDE.md` governs it). Keeping the two separate
> avoids any accidental barrel re-export of the `Intl` path.

Define a `TimeNamespace` type and a frozen `time` object of sentinel holes:

```ts
export type TimeNamespace = Readonly<{
    year(t: Time, tz?: string): number;
    month(t: Time, tz?: string): number;       // 1..12
    dayofmonth(t: Time, tz?: string): number;   // 1..31
    dayofweek(t: Time, tz?: string): number;     // 1=Sun .. 7=Sat (Pine)
    hour(t: Time, tz?: string): number;          // 0..23
    minute(t: Time, tz?: string): number;        // 0..59
    second(t: Time, tz?: string): number;        // 0..59
    timestamp(
        year: number, month: number, day: number,
        hour?: number, minute?: number, second?: number, tz?: string,
    ): Time;
}>;
```

Each method body is `return sentinel("time.<name>")` (mirror the `sentinel`
hole pattern used in `state/state.ts`). Full JSDoc on the namespace + each
method (`@since 1.2`, `@stable`, `@example`), including the **`tz` default =
`syminfo.timezone` (fallback `"UTC"`)** note and the **Pine `dayofweek`
`1=Sun..7=Sat`** convention. `@example` must be a self-contained `void`
expression so `docs:check` passes (mirror sibling holes).

### 2. New `session` namespace (`packages/core/src/time-accessors/sessionAccessors.ts`, new)

```ts
export type SessionNamespace = Readonly<{
    isOpen(t: Time, spec: string, tz?: string): boolean;
}>;
```

`isOpen` body is `return sentinel("session.isOpen")`. JSDoc documents the
`spec` grammar (`"HH:MM-HH:MM"` or `"HHMM-HHMM"`), the `tz` default, and that
v1 is **UTC + fixed-offset** (a DST zone resolves to UTC + a diagnostic — point
at the determinism note in the docs page from Task 6).

A folder barrel `time-accessors/index.ts` re-exports `time`, `session`,
`TimeNamespace`, `SessionNamespace`.

### 3. `ComputeContext` (`packages/core/src/types.ts`)

Add two members after `timeframe` (before `request`), each with a
`/** … @since 1.2 */` doc line:

```ts
    /** Calendar accessors over a `Time` epoch (UTC-first). @since 1.2 */
    readonly time: TimeNamespace;
    /** Session-window membership helpers. @since 1.2 */
    readonly session: SessionNamespace;
```

Import `TimeNamespace` / `SessionNamespace` into `types.ts` (mirror how
`StateNamespace` / `TimeframeView` are imported at `:12`/`:14`).

### 4. Barrel re-export (`packages/core/src/index.ts`)

Add `export { session, time } from "./time-accessors/index.js";` and
`export type { SessionNamespace, TimeNamespace } from "./time-accessors/index.js";`
near the `barstate`/`syminfo`/`timeframe` exports (`:217-218`).

### 5. Registry (`packages/core/src/statefulPrimitives.ts`)

Append, in a new `// Calendar / session accessors — stateless (slot: false)`
region near `ta.nz`'s neighbourhood (order is append-only; put them after the
`request.*` block, before `defineAlertCondition.signal`):

```ts
{ name: "time.year", slot: false },
{ name: "time.month", slot: false },
{ name: "time.dayofmonth", slot: false },
{ name: "time.dayofweek", slot: false },
{ name: "time.hour", slot: false },
{ name: "time.minute", slot: false },
{ name: "time.second", slot: false },
{ name: "time.timestamp", slot: false },
{ name: "session.isOpen", slot: false },
```

> `slot: false` is load-bearing: `callsiteIdInjection` skips the slot-id literal
> (compiler CLAUDE "STATEFUL_PRIMITIVES is a ReadonlySet"), so the runtime
> function receives the author's arguments directly with **no** injected leading
> `slotId`. `statefulCallInLoop` still flags them (Pine-parity). Update the
> "(currently N entries)" counts in both JSDoc blocks (`:222`, `:250`).
> `resolveCalleeName` already preserves dotted names (`state.tick.float`), so
> `time.year` / `session.isOpen` resolve correctly with no analyser change.

### 6. Compiler ambient shim (`packages/compiler/src/program.ts`)

Mirror, byte-consistent with core (escaped backticks per the shim string
style):

- `export type TimeNamespace = Readonly<{ … }>;` and
  `export type SessionNamespace = Readonly<{ isOpen(t: Time, spec: string, tz?: string): boolean; }>;`
  declared near the other view namespaces (after `TimeframeView`, `:1047`).
- `export const time: TimeNamespace;` and `export const session: SessionNamespace;`.
- Add `readonly time: TimeNamespace;` and `readonly session: SessionNamespace;`
  to the `ComputeContext` declaration (after `readonly timeframe`, `:1348`).
- The `STATEFUL_PRIMITIVES` registry note rides the existing
  `ReadonlySet`/`ReadonlyMap` shim declarations (runtime/core list is the source
  of truth) — confirm the type still matches; nothing to add beyond that.

### 7. Type-level tests

- **Core** (`packages/core/src/time-accessors/timeAccessors.types.test.ts`,
  new): with `expect-type`, assert `time.year(0)` and `time.year(0, "UTC")` are
  `number`; `time.timestamp(2024, 1, 2)` is `Time`; `session.isOpen(0,
  "0930-1600")` is `boolean`. (Follow the `state` type-test location +
  `expect-type` style.)
- **Compiler** (`packages/compiler/src/compile.test.ts`): a positive
  `compile()` test whose fixture body is:
  ```ts
  const dow = time.dayofweek(bar.time);
  const hh = time.hour(bar.time, syminfo.timezone);
  const open = session.isOpen(bar.time, "0930-1600");
  plot(open && dow >= 2 ? bar.close + hh : Number.NaN);
  ```
  Assert it compiles with **no** type diagnostics (proves the shim mirrors
  core; `compile()` type-checks, `transformAndAnalyse` does not).

### 8. Sentinel-hole throw tests (core 100% coverage)

In a co-located `*.test.ts`, assert each hole throws `"… called outside an
active script step"` when invoked directly (mirror sibling hole tests; this is
what gives core its 100% line coverage).

### 9. Changeset

Create `.changeset/calendar-session-helpers.md` (one feature changeset for the
whole work):

```md
---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-pine-converter": minor
"@invinite-org/chartlang-cli": patch
---

Add `time.*` calendar accessors (`time.year/month/dayofmonth/dayofweek/hour/
minute/second/timestamp`), a `session.isOpen(t, spec, tz?)` helper, and an
`input.session` kind. Calendar fields are derived from a `Time` epoch via the
host (authors stay sandboxed — `Date`/`Intl` remain banned). v1 is UTC +
fixed-offset only; exchange-tz/DST is a scoped follow-up. The Pine converter
lowers `dayofweek` / `time()` / `input.session`.
```

The **`cli` patch** covers Task 6's additive docs-entry (a `packages/*/src/`
change to a published package), folded into this one changeset.

## Edge cases

- `time.year(NaN)` / any non-finite `t` — the **runtime** (Task 2) returns
  `NaN`; the core hole only type-checks, so no edge handling here.
- Do NOT add `time.weekofyear` / `time.dayofyear` / `time_close` — deferred.
- `@since 1.2`; core is `1.1.1`, this changeset bumps core minor.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/time-accessors/timeAccessors.ts` | Create | `TimeNamespace` + `time` holes. |
| `packages/core/src/time-accessors/sessionAccessors.ts` | Create | `SessionNamespace` + `session` hole. |
| `packages/core/src/time-accessors/index.ts` | Create | Folder barrel. |
| `packages/core/src/time-accessors/*.types.test.ts` | Create | expect-type assertions. |
| `packages/core/src/time-accessors/*.test.ts` | Create | Sentinel-hole throw tests. |
| `packages/core/src/types.ts` | Modify | Import + add `time` / `session` to `ComputeContext`. |
| `packages/core/src/index.ts` | Modify | Re-export `time` / `session` + types. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Append 9 `slot: false` entries; bump counts. |
| `packages/compiler/src/program.ts` | Modify | Mirror namespaces + `ComputeContext` members. |
| `packages/compiler/src/compile.test.ts` | Modify | Positive compile test. |
| `.changeset/calendar-session-helpers.md` | Create | Feature changeset. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-core test` (100% coverage; sentinel throws
  asserted)
- `pnpm -F @invinite-org/chartlang-compiler test`
- `pnpm docs:check` (JSDoc on new exports: `@since`, `@example`, `@stable`)

## Changeset

`.changeset/calendar-session-helpers.md` — **minor** (core, compiler, runtime,
adapter-kit, pine-converter) + **patch** (cli).

## Acceptance Criteria

- `TimeNamespace` / `SessionNamespace` defined + exported with full JSDoc;
  holes throw the active-step sentinel when called directly.
- `ComputeContext.time` / `.session` added; barrel re-exports both.
- 9 registry entries appended as `slot: false`; counts bumped.
- `program.ts` shim mirrors core exactly (lockstep).
- expect-type tests prove return types; `compile()` test proves usage
  type-checks with no diagnostics.
- Changeset committed; typecheck/lint/core+compiler tests/docs:check green.
