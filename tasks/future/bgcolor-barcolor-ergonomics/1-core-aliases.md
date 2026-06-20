# Task 1 — Core `bgcolor` / `barcolor` holes + opts types + registry + shim

> **Status: TODO**

> **Deliverable 1** (ergonomics tier — ships after Task 3).

## Goal

Add two top-level Pine-ergonomic sentinel holes on
`@invinite-org/chartlang-core` — `bgcolor(color, opts?)` and
`barcolor(color, opts?)` — that are pure sugar lowering to the **already
landed** `bg-color` / `bar-color` plot styles. Add the two opts types,
append the two `STATEFUL_PRIMITIVES` entries, mirror everything in the
compiler ambient shim in lockstep, add type-level + compile tests, and
create the feature changeset.

This task ships **zero** runtime, wire, validator, or renderer change: the
holes compile down to a `plot(NaN, { style: { kind: "bg-color"|"bar-color",
color, transp } })` shape that the whole existing pipeline already carries.

## Prerequisites

None.

## Current Behavior

- `packages/core/src/plot/plot.ts` exports two plotting holes — `plot`
  (`:291`, `plot(_value: number | Series<number>, _opts?: PlotOpts)`) and
  `hline` (`:307`) — each throwing its sentinel when called outside a
  compiled runtime. There is no `bgcolor` / `barcolor`.
- `PlotOptsStyle` (`:112-213`) already carries the lowering targets:
  `bg-color` (`:192`, `{ readonly kind: "bg-color"; readonly color: Color;
  readonly transp?: number }`) and `bar-color` (`:201`, `{ readonly kind:
  "bar-color"; readonly color: Color }`). `Color = string`
  (`packages/core/src/types.ts:240`).
- `STATEFUL_PRIMITIVES` (`packages/core/src/statefulPrimitives.ts`) lists
  `plot` / `hline` / `alert` as `{ slot: true }`; there is no
  `bgcolor` / `barcolor` entry. `STATEFUL_PRIMITIVES_BY_NAME` derives from
  the same canonical list.
- `packages/compiler/src/program.ts` ambient shim declares `plot` / `hline`
  / `PlotOpts` / `PlotOptsStyle` / the `STATEFUL_PRIMITIVES` set — must stay
  in lockstep with core (compiler CLAUDE.md "Core resolves through an ambient
  shim").

## Desired Behavior

- `bgcolor("#1d4ed8")` and `bgcolor("#1d4ed8", { transp: 80 })` type-check
  and return `void`; `barcolor("#a855f7")` type-checks and returns `void`.
- The holes throw `"bgcolor called outside an active script step"` /
  `"barcolor called outside an active script step"` when called directly
  (the sentinel pattern — asserted for 100% core coverage).
- A first argument of `Color` (a string) is required; `bgcolor` accepts an
  optional `{ transp?: number }`-bearing opts; `barcolor` accepts an
  optional opts bag with no `transp` (the `bar-color` style has no `transp`).
- The compiler program type-checks the same usage (shim mirrors core).
- Existing holes, styles, and the registry are unchanged except for the
  additive `bgcolor` / `barcolor` entries.

> **The lowering target is `plot`, decided in core, not the runtime.**
> `bgcolor(color, opts?)` is sugar for `plot(NaN, { style: { kind:
> "bg-color", color, ...(transp) } })`. The cleanest place to express that
> is in the core hole's own body NEVER executing (it throws) — the *compiler*
> rewrites the callsite. But because the compiler injects a slot id and the
> runtime needs a real implementation, **Deliverable 1 keeps the lowering in
> the runtime emit layer is NOT needed**: instead, `bgcolor`/`barcolor` get
> their own slot-injected callsites and the runtime gets a thin
> `bgcolor`/`barcolor` emit impl that calls the existing `plotImpl` with the
> built `bg-color`/`bar-color` style. See Task 2 §"runtime thin impl". For
> THIS task, core only declares the holes + types + registry; the runtime
> wiring is Task 2's. (Rationale: a core-only "rewrite `bgcolor` → `plot`"
> macro does not exist in the compiler; the existing pattern is one
> registry entry → one slot-injected callee → one runtime impl.)

## Requirements

### 1. Two opts types (`packages/core/src/plot/plot.ts`)

Add next to `PlotOpts` / `HLineOpts`:

```ts
/**
 * Styling options accepted by `bgcolor(...)` — the Pine-ergonomic alias for
 * a `bg-color` pane-background band. `transp` is the 0–100 transparency
 * (0 opaque … 100 fully transparent), mirroring {@link PlotOptsStyle}'s
 * `bg-color` arm. `title` labels the slot for host overrides.
 *
 * @since 1.4
 * @stable
 * @example
 *     const opts: BgColorOpts = { transp: 80, title: "RSI heat" };
 *     void opts;
 */
export type BgColorOpts = Readonly<{
    transp?: number;
    title?: string;
}>;

/**
 * Styling options accepted by `barcolor(...)` — the Pine-ergonomic alias for
 * a `bar-color` candle/bar tint. The `bar-color` style carries no
 * transparency, so this bag only labels the slot.
 *
 * @since 1.4
 * @stable
 * @example
 *     const opts: BarColorOpts = { title: "trend tint" };
 *     void opts;
 */
export type BarColorOpts = Readonly<{
    title?: string;
}>;
```

### 2. Two holes (`packages/core/src/plot/plot.ts`)

Add after `hline`:

```ts
/**
 * Paint the pane background for the current bar — the Pine-ergonomic alias
 * for `plot(NaN, { style: { kind: "bg-color", color, transp } })`. Pass a
 * `Color` (a CSS / hex string, or a per-bar color expression like
 * `close > open ? "#16a34a" : "#dc2626"`). Sugar over the existing
 * `bg-color` plot style — same wire emission, same capability gate.
 *
 * @since 1.4
 * @stable
 * @example
 *     // Inside a compiled `compute`:
 *     //   bgcolor(bar.close > bar.open ? "#16a34a" : "#dc2626", { transp: 80 });
 *     import { bgcolor } from "@invinite-org/chartlang-core";
 *     try { bgcolor("#1d4ed8"); } catch {}
 */
export function bgcolor(_color: Color, _opts?: BgColorOpts): void {
    throw new Error("bgcolor called outside compiled runtime");
}

/**
 * Tint the candle / bar for the current bar — the Pine-ergonomic alias for
 * `plot(NaN, { style: { kind: "bar-color", color } })`. Sugar over the
 * existing `bar-color` plot style.
 *
 * @since 1.4
 * @stable
 * @example
 *     // Inside a compiled `compute`:
 *     //   barcolor(bar.close > bar.open ? "#16a34a" : "#dc2626");
 *     import { barcolor } from "@invinite-org/chartlang-core";
 *     try { barcolor("#a855f7"); } catch {}
 */
export function barcolor(_color: Color, _opts?: BarColorOpts): void {
    throw new Error("barcolor called outside compiled runtime");
}
```

> **Match the existing throw message phrasing.** `plot` / `hline` throw
> `"<name> called outside compiled runtime"` (`plot.ts:292` / `:308`). Use
> the same `"… called outside compiled runtime"` string the file already
> uses, NOT the `state.*` `"… called outside an active script step"` variant.
> (The two phrasings co-exist in core; keep `bgcolor`/`barcolor` consistent
> with their siblings in the SAME file.)

`Color` is already imported in `plot.ts` (`import type { Color, … }`). Add
`bgcolor` / `barcolor` / `BgColorOpts` / `BarColorOpts` to the plot barrel
(`packages/core/src/plot/index.ts` if present) and re-export from the
package root (`packages/core/src/index.ts`) alongside `plot` / `hline` /
`PlotOpts`.

### 3. Registry (`packages/core/src/statefulPrimitives.ts`)

Append (additive within `apiVersion: 1`, per core CLAUDE.md) to the canonical
list, in the plotting region (next to `plot` / `hline`):

```ts
{ name: "bgcolor", slot: true },
{ name: "barcolor", slot: true },
```

`STATEFUL_PRIMITIVES_BY_NAME` derives from the same list — no extra edit.

### 4. Compiler ambient shim (`packages/compiler/src/program.ts`)

Mirror in the `declare module "@invinite-org/chartlang-core"` block,
byte-consistent with core:

- Add `BgColorOpts` / `BarColorOpts` type declarations next to the shim's
  `PlotOpts` / `HLineOpts`.
- Add `bgcolor(color: Color, opts?: BgColorOpts): void;` and
  `barcolor(color: Color, opts?: BarColorOpts): void;` next to the shim's
  `plot` / `hline`.
- The `STATEFUL_PRIMITIVES` set in the shim rides the same `ReadonlySet`
  declaration — no shape change; the runtime/core list is the source of
  truth. Confirm the type still matches.

> Keep the shim's pre-existing simplifications (e.g. its `PlotOpts` shape) as
> they are — "lockstep" means the **`bgcolor`/`barcolor` signatures + the two
> opts types** must match core, not a rewrite of unrelated shim declarations.

### 5. Type-level + compile tests

- **Core** (follow the existing plot type-test location, e.g.
  `packages/core/src/plot/*.types.test.ts` or `types.types.test.ts`): using
  `expect-type`, assert `bgcolor` is callable as `(color: Color) => void`
  and `(color: Color, opts: BgColorOpts) => void`, and `barcolor` as
  `(color: Color) => void` / `(color: Color, opts: BarColorOpts) => void`.
  Assert `BgColorOpts` has an optional `transp` and `BarColorOpts` does NOT.
- **Core unit** (the sentinel-throw test, for 100% coverage): assert
  `bgcolor("#000")` and `barcolor("#000")` throw the documented message —
  mirror the existing `plot` / `hline` throw tests.
- **Compiler** (`packages/compiler/src/compile.test.ts`): a positive
  `compile()` test whose fixture body is:
  ```ts
  bgcolor(bar.close > bar.open ? "#16a34a" : "#dc2626", { transp: 80 });
  barcolor(bar.close > bar.open ? "#16a34a" : "#dc2626");
  ```
  Assert it compiles with **no** type diagnostics (proves the shim mirrors
  core). The slot-injection + `manifest.plots` assertions are Task 2's.

### 6. Changeset

Create `.changeset/<slug>.md` (feature changeset for Deliverable 1):

```md
---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-pine-converter": patch
---

Add `bgcolor(color, opts?)` and `barcolor(color, opts?)` — Pine-ergonomic
top-level aliases for the `bg-color` / `bar-color` plot styles. One call
(`bgcolor(close > open ? "#16a34a" : "#dc2626", { transp: 80 })`) replaces
the verbose `plot(NaN, { style: { kind: "bg-color", … } })`. Surfaced in the
generated primitive reference and taught in the chartlang-coding skill.
```

The **`runtime` minor** covers Task 2's thin `bgcolor`/`barcolor` emit impl;
the **`pine-converter` patch** covers Task 3's `emitBackground` switch to the
sugar form. Folded into this one feature changeset (changesets accumulate
until release).

## Edge cases

- Use `@since 1.4` for the new core surface. Confirm the current core
  package version and bump accordingly (the changeset bumps core minor).
- Do NOT add a `transp` field to `BarColorOpts` — the `bar-color` style has
  no transparency.
- The first argument is `Color` (string). Deliverable 2 will widen the
  authored color to also accept a per-bar color expression — do NOT
  pre-build that here; Deliverable 1 ships the static-color signature only.
- Do NOT touch `PlotEmission` / the wire / the validator / the renderer in
  this task — Deliverable 1 is sugar over the landed pipeline.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/plot/plot.ts` | Modify | Add `BgColorOpts` / `BarColorOpts` + `bgcolor` / `barcolor` holes. |
| `packages/core/src/plot/index.ts` | Modify (if present) | Barrel re-export. |
| `packages/core/src/index.ts` | Modify | Root re-export of the four symbols. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Append two registry entries. |
| `packages/core/src/plot/*.types.test.ts` | Modify/Create | expect-type assertions. |
| `packages/core/src/plot/plot.test.ts` | Modify | Sentinel-throw tests. |
| `packages/compiler/src/program.ts` | Modify | Mirror holes + opts types in shim. |
| `packages/compiler/src/compile.test.ts` | Modify | Positive compile test. |
| `.changeset/<slug>.md` | Create | Deliverable-1 feature changeset. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-core test` (100% coverage; the two
  sentinel throws are asserted like every sibling hole)
- `pnpm -F @invinite-org/chartlang-compiler test`
- `pnpm docs:check` (JSDoc on new exports: `@since`, `@example`, `@stable`)

## Changeset

`.changeset/<slug>.md` — **minor** (core, compiler, runtime) + **patch**
(pine-converter). Shared across Deliverable 1's Tasks 1–3.

## Acceptance Criteria

- `bgcolor` / `barcolor` holes + `BgColorOpts` / `BarColorOpts` defined,
  exported, fully JSDoc'd, and throwing the documented sentinel.
- Two `STATEFUL_PRIMITIVES` entries appended; `BY_NAME` map picks them up.
- `program.ts` shim mirrors core exactly (lockstep) — the positive
  `compile()` test type-checks `bgcolor`/`barcolor` usage with no
  diagnostics.
- expect-type test proves the signatures (`transp` only on `BgColorOpts`).
- No wire / validator / renderer change in this task.
- Changeset committed; typecheck/lint/core+compiler tests/docs:check green.
