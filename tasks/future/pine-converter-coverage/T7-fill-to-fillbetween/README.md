# T7 — Converter: `fill(plot/hline, …)` → `draw.fillBetween`

## Overview

Wire Pine's `fill(idA, idB, color)` builtin (fill between two `plot()` /
`hline()` handles) to the already-shipped `draw.fillBetween` primitive. Trend
Wizard fills its consolidation band:
`fill(guide_consol_upper, guide_consol_lower, color = …)`. The **capability
exists** — the converter already lowers `linefill.new` to `draw.fillBetween`
— but the `fill()` builtin is a separate path still hard-rejected.

## Current State (evidence — ran built converter)

Pine:
```pine
u = hline(0.2)
l = hline(-0.2)
fill(u, l, color=color.rgb(205,121,219,88))
```
→ `pine-converter/transform/fill-not-mapped` (error); the `fill` is dropped,
only the two hlines emit.

- Reject site: `src/transform/plotFamily.ts:182` (`default` arm →
  `diagnostics.pushCode("fill-not-mapped", …)`).
- Code: `src/diagnostics/codes.ts` (`fill-not-mapped`, severity `error`,
  message *"`fill(plot1, plot2, ...)` has no chartlang analogue (no plot-fill
  primitive in v1)"*).
- But `draw.fillBetween` **does** exist (`packages/core/src/draw/draw.ts`,
  commit `3bf391a`) and the converter already targets it from
  `src/transform/polylineLinefill.ts` (static two-line `linefill.new` →
  `draw.fillBetween([aA, aB], [bA, bB], { fill })`).

## Target State

- `fill(a, b, color?/transp?)` where `a`/`b` are `hline()` or `plot()`
  handles lowers to `draw.fillBetween` between the two edges.
- For two **hlines** (constant prices) the band is a horizontal region between
  the two levels; for two **plots** (series) it is a per-bar band that tracks
  both series. **Both shapes are in scope for T7** (decision: one general
  edge-builder, below).
- Fill color/transparency lowers via **T6**'s `convertColor`.
- Replace the `fill-not-mapped` hard reject for the supported handle shapes;
  keep a reject only for genuinely unsupported forms (e.g. `fill` over
  series-array handles, or a `fill` arg that resolves to neither
  `hline`/`plot`).

## Architecture Decisions

| Decision | Notes |
|----------|-------|
| **One general edge-builder** (NOT "reuse `emitLinefill`") | `fill` and `linefill` lower through a shared `emitFillBetweenBand(edgeA, edgeB, colorNode, ctx)` that takes **pre-resolved edge descriptors**, not line endpoints. linefill resolves line-drawing ENDPOINTS; `fill` resolves hline CONSTANTS or plot SERIES. The static `emitLinefill` is refactored to build its edge descriptors then call the shared builder — it does NOT serve as a template the `fill` path bends to fit. |
| Edge descriptor | A small union: `{ kind: "constant", price }` (hline) or `{ kind: "series", expr }` (plot) or `{ kind: "endpoints", a, b }` (linefill). The builder renders each kind to a `ReadonlyArray<WorldPoint>` edge. |
| hline (constant) edges | An `hline(p)` is a constant price; the edge is a constant-price `WorldPoint` array spanning the bar range (horizontal band). Document the x-extent in a code comment; confirm `draw.fillBetween`'s arity (runtime reverses `edgeB` to close the `A1→A2→B2→B1` polygon). |
| plot (series) edges | A `plot(seriesExpr)` band tracks the series per bar. Specify the per-bar edge synthesis (the band re-anchors to both plotted series each bar), x-extent/anchor model explicit, and confirm it satisfies the `draw.fillBetween` reversed-`edgeB` polygon close. |
| Resolve handle references | `fill` args are identifiers bound to top-level `hline`/`plot` calls (identity match, like `polylineLinefill.ts`'s `handleNameOf`) OR inline `hline(price)`/`plot(expr)` calls. An arg resolving to neither → `fill-handle-unresolved`. |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| `draw.fillBetween` core | `packages/core/src/draw/draw.ts` (`fillBetween(edgeA, edgeB, style)`) | Emission target. |
| linefill lowering | `src/transform/polylineLinefill.ts` (`emitLinefill`) | **Refactored** to build edge descriptors + call the new shared `emitFillBetweenBand`; behavior-preserving (linefill goldens byte-identical). |
| `handleNameOf` | `src/transform/polylineLinefill.ts` | Pattern for identity-matching a handle identifier to its defining call. |
| `fill` reject site | `src/transform/plotFamily.ts:182` | Replace with the new lowering. |
| Color lowering | **T6** / `src/transform/colorConvert.ts` (`convertColor`) | Fill color/transp (`color.new(base, transp)` → `#RRGGBBAA`). |

## Dependencies

- **T6** (color transparency) for the fill color.
- Independent of T1–T5 otherwise; the capability already exists.

## Dependency Graph

```
T6 (color transparency)
  |
  v
Task 1 (resolve fill handles -> draw.fillBetween; narrow reject)
  |
  v
Task 2 (fixtures: hline-band + plot-band + reject; docs/rejects/CLAUDE)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Lower `fill(plot/hline,…)` to `draw.fillBetween`](./1-fill-to-fillbetween-lowering.md) | pine-converter | T6 | Medium |
| 2 | [`fill` fixtures + compile round-trip + docs](./2-fixtures-docs.md) | pine-converter | 1, T6 | Low |

## Acceptance Criteria

- Trend Wizard's `fill(guide_consol_upper, guide_consol_lower, …)` converts to
  a compiling `draw.fillBetween`; no `fill-not-mapped` for the supported shape.

## Deferred / Follow-Up

- `fill(...)` with `fillgaps` / gradient / per-bar dynamic color args. (Both
  the constant-price hline band and the per-bar plot-series band are in scope;
  only these extra styling args are deferred.)
