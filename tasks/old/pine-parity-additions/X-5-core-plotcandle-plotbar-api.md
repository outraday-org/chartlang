# Core `plotcandle` / `plotbar` author API

> **Status: TODO**

## Goal

Add the two author-facing plot-family free functions `plotcandle(open,
high, low, close, opts?)` and `plotbar(open, high, low, close, opts?)`
to core: sentinel holes, opts types, exports, `STATEFUL_PRIMITIVES`
entries, and the compiler ambient-shim mirror. Mirrors Pine 1:1 and
reuses the exact `bgcolor` / `barcolor` alias precedent.

## Prerequisites

Task 4 (the wire `candle` / `ohlc-bar` styles + `PlotKind` these lower
to).

## Current Behavior

`packages/core/src/plot/plot.ts` declares `plot` / `hline` / `bgcolor` /
`barcolor` as plot-family holes; they are exported from `plot/index.ts`
and the root `index.ts:265`, registered in `statefulPrimitives.ts:115-121`
(`slot: true`), and mirrored in the compiler shim
`packages/compiler/src/program.ts:857-860,1510-1511`. There is no
value-carrying candle/bar author function — only the color-only
`style: { kind: "candle-override" | "bar-override" }` on `plot()`.

## Desired Behavior

```ts
plotcandle(ha.open, ha.high, ha.low, ha.close, { bull: "#26a69a", bear: "#ef5350" });
plotbar(o, h, l, c, { color: "#f59e0b" });
```

Each accepts four OHLC sources (`number | Series<number>`) + an opts
bag, and emits a plot whose wire style is `kind: "candle"` /
`"ohlc-bar"` (Task 6 does the emit). Calling outside a runtime step
throws, like every hole.

## Requirements

### 1. Opts types (`packages/core/src/plot/plot.ts`)

There is **no shared presentation base type** — `PlotOpts` (lines
232-272) and `HLineOpts` each declare `title?` / `pane?` / `z?` /
`visible?` directly with parallel per-field JSDoc (see
`packages/core/CLAUDE.md` → the `z` invariant: `PlotOpts` carries its
own `z?: number` with parallel JSDoc; only `draw.*` uses the `ZOrdered`
mixin). Follow that convention: declare the fields directly, copying
the sibling JSDoc wording. Add the candle/bar-specific colors:

```ts
export type PlotCandleOpts = Readonly<{
    bull?: Color; bear?: Color; doji?: Color;
    wickColor?: Color; borderColor?: Color;
    title?: string; visible?: boolean; z?: number; pane?: PlotPane;
}>;
export type PlotBarOpts = Readonly<{
    color?: Color; upColor?: Color; downColor?: Color;
    title?: string; visible?: boolean; z?: number; pane?: PlotPane;
}>;
```

Colors default at emit time (Task 6), not here. Use the same `Color` /
`PlotPane` types the sibling opts use.

### 2. Function signatures + holes (`packages/core/src/plot/plot.ts`)

```ts
export function plotcandle(
    open: number | Series<number>, high: number | Series<number>,
    low: number | Series<number>, close: number | Series<number>,
    opts?: PlotCandleOpts,
): void;
export function plotbar(
    open: number | Series<number>, high: number | Series<number>,
    low: number | Series<number>, close: number | Series<number>,
    opts?: PlotBarOpts,
): void;
```

Implement each as a sentinel hole (mirror `bgcolor` at `plot.ts:391` /
`barcolor` at 408):
`throw new Error("plotcandle called outside compiled runtime");`. Carry
full JSDoc (`@since 1.8`, `@stable`, `@example` with a Heikin-Ashi-style
call). `scripts/generate-skills-reference.ts` reads
`packages/core/src/plot/plot.ts` for the plot-family section, and
`pnpm gen-hover-registry` reads all core JSDoc — this JSDoc feeds both.

### 3. Exports

- `packages/core/src/plot/index.ts` — re-export both (barrel already
  does `export * from "./plot.js"` at line 4, so this is automatic;
  confirm).
- `packages/core/src/index.ts:265` — extend the named plot-family
  export line (`export { barcolor, bgcolor, hline, plot } from
  "./plot/index.js";`) with `plotcandle`, `plotbar`.

### 4. Core `ComputeContext` members (`packages/core/src/types.ts`)

The core `ComputeContext` type (`types.ts:822`) carries each
plot-family callable as a `typeof`-import member (e.g. line 829:
`readonly bgcolor: typeof import("./plot/plot.js").bgcolor;`). Add:

```ts
readonly plotcandle: typeof import("./plot/plot.js").plotcandle;
readonly plotbar: typeof import("./plot/plot.js").plotbar;
```

Without this the runtime cannot install the impls on the context
(Task 6) and author scripts cannot destructure them.

### 5. Registry entries + cardinality gates

Append next to the plot family in
`packages/core/src/statefulPrimitives.ts` (lines 115-121):

```ts
{ name: "plotcandle", slot: true },
{ name: "plotbar", slot: true },
```

`slot: true` so the compiler injects the callsite slot id (a candle
series owns a per-bar accumulator on the adapter side). The
`skills:gate` `crossCheckTa` check only guards `ta.*` names, so these
plot-family entries are safe to land ahead of the runtime impls.

Update the two pinned counts in the same PR:

- `packages/compiler/src/program.test.ts:222` — bump the pinned
  `STATEFUL_PRIMITIVES.size` by 2.
- `packages/conformance/src/scenarios/phase2Coverage.test.ts` — append
  a plot-family additions constant (mirror
  `FILL_BETWEEN_STATEFUL_ADDITIONS`) to the `STATEFUL_PRIMITIVES.size`
  sum.

### 6. Compiler ambient shim (`packages/compiler/src/program.ts`)

The shim is the **hand-written** `CORE_AMBIENT_SHIM` template literal
(no generator — edit by hand). Mirror the `bgcolor` / `barcolor` shim
entries: add the two `export function plotcandle(...)` / `plotbar(...)`
declarations after line 860 (`plot`/`hline`/`bgcolor`/`barcolor` sit at
857-860) and the `readonly plotcandle: typeof plotcandle;` / `plotbar`
members in the shim's `ComputeContext` after line 1511 (`plot`/`hline`/
`bgcolor`/`barcolor` sit at 1508-1511). Keep signatures byte-identical
to step 2.

### 7. Hover registry regen

Core JSDoc changed ⇒ run `pnpm gen-hover-registry` and commit
`packages/language-service/src/hoverRegistry.generated.ts`
(`pnpm hover:check` gates it).

### 8. Tests (`packages/core/src/plot/*.test.ts`)

- Sentinel-throw unit tests for both holes (mirror the `bgcolor` throw
  test) — preserves 100% line coverage on the holes.
- Type tests: valid `PlotCandleOpts` / `PlotBarOpts` shapes; four
  scalar/Series OHLC args accepted; a missing OHLC arg is a type error.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/plot/plot.ts` | Modify | opts types + 2 signatures + holes + JSDoc |
| `packages/core/src/plot/index.ts` | Verify | barrel export (automatic via `export *`) |
| `packages/core/src/index.ts` | Modify | named export in the plot-family line (~265) |
| `packages/core/src/types.ts` | Modify | 2 `ComputeContext` members |
| `packages/core/src/statefulPrimitives.ts` | Modify | 2 `slot: true` entries |
| `packages/compiler/src/program.ts` | Modify | ambient shim (fns + `ComputeContext` members) |
| `packages/compiler/src/program.test.ts` | Modify | `STATEFUL_PRIMITIVES.size` pin +2 |
| `packages/conformance/src/scenarios/phase2Coverage.test.ts` | Modify | plot-family additions constant |
| `packages/language-service/src/hoverRegistry.generated.ts` | Generate | `pnpm gen-hover-registry` |
| `skills/chartlang-coding/references/primitives.md` | Generate | plot-family section regen |
| `packages/core/src/plot/*.test.ts` / `*.types.test.ts` | Modify | throw + type tests |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (core + compiler + conformance 100% coverage)
- `pnpm docs:check` — JSDoc completeness on the 2 new holes
- `pnpm hover:check` — regenerated hover registry committed
- `pnpm skills:gate` — regen `primitives.md` (run `pnpm skills:generate`;
  the generator reads `packages/core/src/plot/plot.ts` for the
  plot-family section)

## Changeset

`.changeset/core-plotcandle-plotbar.md` —
`"@invinite-org/chartlang-core": minor`,
`"@invinite-org/chartlang-compiler": minor`,
`"@invinite-org/chartlang-language-service": patch` (hover regen).
Body: "Add `plotcandle` / `plotbar` author functions for custom OHLC
candle-series plotting."

## Acceptance Criteria

- Both functions declared, typed, exported, JSDoc-complete
  (`@since 1.8`), throwing outside a step.
- Core `ComputeContext` (`types.ts`) + `STATEFUL_PRIMITIVES` + compiler
  shim mirror both (`slot: true`); the compiler size pin and the
  conformance `phase2Coverage` sum are updated and green.
- Throw + type tests land; core + compiler coverage 100%.
- `pnpm docs:check` / `pnpm hover:check` / `pnpm skills:gate` green;
  changeset committed.
- Additive only — no existing plot type or manifest changes.
