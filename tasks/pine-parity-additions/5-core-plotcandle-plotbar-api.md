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
and the root `index.ts:264`, registered in `statefulPrimitives.ts:115-121`
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

Reuse the shared presentation fields (`title?`, `visible?`, `z?`,
`pane?`) the way `PlotOpts` / `BgColorOpts` do — factor from the common
base, do not re-declare. Add only the candle/bar-specific colors:

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

Implement each as a sentinel hole (mirror `bgcolor` / `barcolor`):
`throw new Error("plotcandle called outside compiled runtime");`. Carry
full JSDoc (`@since 1.6`, `@stable`, `@example` with a Heikin-Ashi-style
call). These are the docs-gate source for the plot-family page and the
`skills:generate` plot-family section.

### 3. Exports

- `packages/core/src/plot/index.ts` — re-export both (barrel already
  does `export * from "./plot.js"`, so this is automatic; confirm).
- `packages/core/src/index.ts:264` — add `plotcandle`, `plotbar` to the
  named `plot`-family export list.

### 4. Registry entries (`packages/core/src/statefulPrimitives.ts`)

Append next to the plot family (lines 115-121):

```ts
{ name: "plotcandle", slot: true },
{ name: "plotbar", slot: true },
```

`slot: true` so the compiler injects the callsite slot id (a candle
series owns a per-bar accumulator on the adapter side).

### 5. Compiler ambient shim (`packages/compiler/src/program.ts`)

Mirror the `bgcolor` / `barcolor` shim entries: add the two
`export function plotcandle(...)` / `plotbar(...)` declarations near
line 859 and the `readonly plotcandle: typeof plotcandle;` /
`plotbar` members near line 1510. Keep signatures byte-identical to
step 2. If the shim regenerates from core, run the generator.

### 6. Tests (`packages/core/src/plot/*.test.ts`)

- Sentinel-throw unit tests for both holes (mirror the `bgcolor` throw
  test) — preserves 100% line coverage on the holes.
- Type tests: valid `PlotCandleOpts` / `PlotBarOpts` shapes; four
  scalar/Series OHLC args accepted; a missing OHLC arg is a type error.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/plot/plot.ts` | Modify | opts types + 2 signatures + holes + JSDoc |
| `packages/core/src/plot/index.ts` | Modify/Verify | barrel export |
| `packages/core/src/index.ts` | Modify | named export in the plot-family line |
| `packages/core/src/statefulPrimitives.ts` | Modify | 2 `slot: true` entries |
| `packages/compiler/src/program.ts` | Modify | ambient shim (fns + namespace members) |
| `packages/core/src/plot/*.test.ts` / `*.types.test.ts` | Modify | throw + type tests |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (core + compiler 100% coverage)
- `pnpm docs:check` — JSDoc completeness on the 2 new holes
- `pnpm skills:gate` — regen `primitives.md` (run `pnpm skills:generate`)

## Changeset

`.changeset/core-plotcandle-plotbar.md` —
`"@invinite-org/chartlang-core": minor`,
`"@invinite-org/chartlang-compiler": minor`. Body: "Add `plotcandle` /
`plotbar` author functions for custom OHLC candle-series plotting."

## Acceptance Criteria

- Both functions declared, typed, exported, JSDoc-complete, throwing
  outside a step.
- `STATEFUL_PRIMITIVES` + compiler shim mirror both (`slot: true`).
- Throw + type tests land; core + compiler coverage 100%.
- `pnpm docs:check` / `pnpm skills:gate` green; changeset committed.
- Additive only — no existing plot type or manifest changes.
