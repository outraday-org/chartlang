# Task 1 — Lower `fill(plot/hline, …)` to `draw.fillBetween`

> **Status: TODO**

## Goal

Replace the `fill-not-mapped` hard reject for the supported handle shapes:
resolve a Pine `fill(idA, idB, color?)` call's two handle arguments back to
their defining `hline()` / `plot()` calls and emit a `draw.fillBetween` band
between the two edges via a **new shared edge-builder** (`emitFillBetweenBand`)
that both `fill` and the existing static `linefill` lowering route through. Keep
a narrowed reject only for genuinely unsupported `fill` forms.

**Scope decision:** T7 supports BOTH `fill(hline1, hline2)` (constant-price
horizontal band) AND `fill(plot1, plot2)` (per-bar series band) via ONE general
edge-builder. The static `emitLinefill` is NOT a template the `fill` path bends
to fit — it is refactored to build edge descriptors and call the same shared
builder.

## Prerequisites

- T6 (color transparency) — the fill color/transp arg lowers via
  `convertColor`. (Can be developed in parallel; the fixture's clean compile
  needs T6's color handling for a `color.rgb(r,g,b,transp)` fill.)

## Current Behavior

- `packages/pine-converter/src/transform/plotFamily.ts:182` — the `default`
  arm of `emitPlotFamily` pushes `fill-not-mapped` for `fill` and returns
  `null` (the fill is dropped; only the hlines/plots emit).
- `packages/pine-converter/src/diagnostics/codes.ts` — `fill-not-mapped`
  (severity `error`, *"`fill(plot1, plot2, ...)` has no chartlang analogue (no
  plot-fill primitive in v1)"*).
- The capability + lowering already exist:
  `packages/pine-converter/src/transform/polylineLinefill.ts` (`emitLinefill`)
  lowers a static two-line `linefill.new(lineA, lineB, color)` to
  `draw.fillBetween([aA, aB], [bA, bB], { fill })`, resolving each line's
  endpoints off its `line.new` site and folding the fill color via
  `convertColor` (`src/transform/colorConvert.ts`). `draw.fillBetween` is real
  core (`packages/core/src/draw/draw.ts`).

## Desired Behavior

```pine
u = hline(0.2)
l = hline(-0.2)
fill(u, l, color = color.rgb(205, 121, 219, 88))
```
→
```ts
draw.fillBetween(
    [bar.point(0, 0.2), bar.point(0, 0.2)],
    [bar.point(0, -0.2), bar.point(0, -0.2)],
    { fill: "#CD79DB16" },
);
```

(exact edge construction per Requirement 2). Two `plot(seriesExpr)` handles
produce a per-bar band tracking both series. A `fill` over an unsupported handle
(e.g. a series-array element) or an arg resolving to neither `hline`/`plot`
keeps a (narrowed) reject.

## Requirements

### 1. Resolve handle args (`src/transform/plotFamily.ts` + a helper)

- `fill`'s first two positional args are either identifiers bound to a top-level
  `hline(...)` / `plot(...)` call, OR an inline `hline(price)` / `plot(expr)`
  call directly in the `fill` argument. Resolve each identifier to its defining
  call by identity/name — mirror `polylineLinefill.ts`'s `handleNameOf`
  (identity match on the declaration initializer / assignment value). An arg
  that resolves to neither `hline` nor `plot` → narrowed reject (see Req 4).
- Build an **edge descriptor** per arg: an `hline(p)` →
  `{ kind: "constant", price: p }`; a `plot(expr)` →
  `{ kind: "series", expr }`. (The linefill path produces
  `{ kind: "endpoints", a, b }` from a `line.new` site — see Req 2.)

### 2. Emit `draw.fillBetween` via a shared general edge-builder

- Introduce `emitFillBetweenBand(edgeA, edgeB, colorNode, ctx)` (the SHARED
  general builder) that takes two **pre-resolved edge descriptors** and renders
  each to a `ReadonlyArray<WorldPoint>` edge for `draw.fillBetween(edgeA, edgeB,
  { fill })`. This is NOT "reuse `emitLinefill` as a template" — `emitLinefill`
  is refactored to build its `{ kind: "endpoints", … }` descriptors and call
  the same builder (behavior-preserving; linefill goldens stay byte-identical).
- Edge rendering per descriptor kind:
  - `{ kind: "constant", price }` (hline): a constant-price `WorldPoint` array
    spanning the bar range — a horizontal band. Document the x-extent in a code
    comment.
  - `{ kind: "series", expr }` (plot): a per-bar band — the edge re-anchors to
    the plotted series each bar (specify the per-bar anchor/x-extent model
    explicitly).
  - `{ kind: "endpoints", a, b }` (linefill): the two `line.new` endpoints, as
    today.
- The runtime reverses `edgeB` to close the `A1→A2→B2→B1` polygon — confirm the
  builder passes `edgeB` un-reversed so the closed band is correct for all three
  edge kinds (the same convention the current linefill lowering relies on).
- Fill color/transp from the `color=` named arg (or positional) lowers via
  `convertColor` (T6) — `color.new(base, transp)` folds to `#RRGGBBAA`. No
  `color=` → `draw.fillBetween`'s default fill.

### 3. Wire into `emitPlotFamily`

- Add a `case "fill":` to `emitPlotFamily` (`plotFamily.ts`) before the
  `default` reject arm, dispatching to the new lowering. The `default` arm
  keeps `fill-not-mapped` for any other unrecognized plot-family callee.

### 4. Narrowed reject (append-only, `src/diagnostics/codes.ts`)

- `fill-not-mapped` STAYS registered (the code STRING is a stable public
  contract — never renamed/reordered), but its **message is updated** and it now
  fires ONLY for genuinely unsupported `fill` shapes after T7 lands. State the
  surviving cases explicitly: a `fill` over a series-array element / ring
  handle, a `fill` with a gradient/`fillgaps` form (deferred), or any
  plot-family callee that is not `fill`/`hline`/`plot`.
- Add `fill-handle-unresolved` (error, appended, never reordered) for a `fill`
  arg that resolves to neither a top-level `hline`/`plot` handle nor an inline
  `hline`/`plot` call. `fill` is NEVER silently dropped — every unsupported
  shape emits one of the two codes.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/plotFamily.ts` | Modify | `case "fill"` dispatch; handle/inline resolution → edge descriptors. |
| `packages/pine-converter/src/transform/polylineLinefill.ts` | Modify | Add shared `emitFillBetweenBand(edgeA, edgeB, colorNode, ctx)`; refactor `emitLinefill` to build `{ kind: "endpoints" }` descriptors + call it (behavior-preserving). |
| `packages/pine-converter/src/transform/plot-family.test.ts` | Modify | `fill` hline-band + plot-band lowering + narrowed-reject unit tests. |
| `packages/pine-converter/src/transform/polylineLinefill.coverage.test.ts` | Modify | Synthetic-AST defensive arms for `emitFillBetweenBand` (missing args, non-identifier args, unresolved handle, unknown edge-descriptor kind). |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Append `fill-handle-unresolved`; update `fill-not-mapped` message. |
| `.changeset/converter-fill-fillbetween.md` | Create | patch (pine-converter). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage on pine-converter)
- `pnpm docs:check`

## Changeset

`.changeset/converter-fill-fillbetween.md` — **patch**
(`@invinite-org/chartlang-pine-converter`).

## Acceptance Criteria

- `fill(hlineA, hlineB, color=…)` and `fill(plotA, plotB)` lower to a
  `draw.fillBetween` instead of `fill-not-mapped`.
- An unresolved/unsupported `fill` arg emits `fill-handle-unresolved` (or the
  narrowed `fill-not-mapped`), never silently drops without a diagnostic.
- The `linefill.new` path is unchanged (shared helper refactor is
  behavior-preserving — existing linefill goldens byte-identical).
