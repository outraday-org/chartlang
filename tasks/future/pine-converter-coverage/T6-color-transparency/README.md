# T6 — Converter: color transparency mapping

## Overview

Map Pine's transparency-carrying color forms onto chartlang's color surface in
the **plot / hline / table** paths: the 4-argument
`color.rgb(r, g, b, transp)` and `color.new(base, transp)`. Trend Wizard uses
these pervasively (e.g. `color.rgb(255,153,0,60)`, `color.new(#ffffff, 0)`,
the dashboard's `get_dynamic_color`). Today they emit **invalid, non-compiling
chartlang with no diagnostic**.

## Current State (evidence — ran built converter)

Pine `plot(close, color=color.rgb(255,153,0,60))` →

```ts
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
…
plot(bar.close, { color: color.rgb(255, 153, 0, 60) });
```

No errors/warnings, but: chartlang `color.rgb` takes **3** args, `color` is
**not imported**, so this won't compile — **silent**.

- A working color converter already exists for the **linefill/draw** path:
  `convertColor` + `transpToAlphaHex` (`src/transform/colorConvert.ts`) fold
  `color.new(base, transp)` → a `#RRGGBBAA` hex
  (`alpha = round(255 * (100 - clamp(transp,0,100)) / 100)`).
- The **plot/hline/table** paths route color args through `enumLookup` (named
  enums only) and otherwise fall back to raw `emitExpr` — so `color.new` /
  4-arg `color.rgb` pass through verbatim and `color` is never imported.

## Target State

- `color.rgb(r, g, b, transp)` and `color.new(base, transp)` in **any**
  emitted position lower via the existing `convertColor` machinery to a
  compiling chartlang color. The fold rule is **fixed** (not "pick one"): a
  **literal** `#RRGGBB` base + literal transp folds to a `#RRGGBBAA` hex
  string; a **dynamic** base (or dynamic transp) emits
  `color.withAlpha(<base>, <alpha>)` with `alpha = (100 - transp) / 100` in
  the 0–1 range core's `withAlpha` expects.
- 3-arg `color.rgb(r,g,b)` stays as-is but ensures `color` is imported when
  referenced.
- The import scanner adds `color` to the core import list / `compute`
  destructure whenever a `color.*` member survives in the output.

## Architecture Decisions (settled)

| Decision | Notes |
|----------|-------|
| Reuse `convertColor` on the plot/hline/table path | Don't fork a second color lowering. Thread `convertColor` into `plotFamily.ts` / `tables.ts` color-arg handling. |
| Hex fold for literal base, `color.withAlpha` for dynamic base (DECIDED) | `colorConvert.ts` folds to `#RRGGBBAA` losslessly for a literal `#RRGGBB` base + literal transp; a **dynamic** base (e.g. `get_dynamic_color`'s computed `base_color`) or dynamic transp emits `color.withAlpha(base, alpha)` with `alpha = (100 - transp) / 100` (core's `withAlpha` takes alpha in 0–1, not 0–255). The hex fold needs a literal base; the dynamic path covers the rest. |
| Pine transp (0=opaque…100=transparent) → chartlang alpha | **Fact**, not a choice: the hex path reuses `transpToAlphaHex` (already built); the dynamic path uses the `(100 - transp) / 100` 0–1 fraction. |
| `color` import gating | Add a new `color: boolean` field to `UsageFlags` in `scanUsage` (`src/codegen/usage.ts`) — it does not exist today — and force it on when a `color.*` member appears (Task 2). |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| Color converter + transp→alpha | `src/transform/colorConvert.ts` (`convertColor`, `transpToAlphaHex`) | The lowering, already built. |
| Plot/hline color emission | `src/transform/plotFamily.ts` | Route color args through `convertColor`. |
| Table cell color | `src/transform/tables.ts` | Same. |
| `color.withAlpha` | `packages/core/src/color/index.ts` | Dynamic-base target. |
| Import scanner | `src/codegen/usage.ts` (`scanUsage`) | Add `color` import gating. |

## Dependencies

- The `get_dynamic_color` dashboard helper also needs **T1** (UDF) to convert
  at all; T6 ensures the colors **inside** it compile.

## Dependency Graph

```
Task 1 (route plot/hline/table color args through convertColor;
        4-arg color.rgb + color.new; literal-vs-dynamic base)
  |
  v
Task 2 (color import gating in scanUsage + fixtures + compile round-trip + docs)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Route plot/hline/table color args through `convertColor`](./1-route-color-args-through-convertcolor.md) | pine-converter | None | Medium |
| 2 | [`color` import gating + fixtures + docs](./2-color-import-gating-fixtures-docs.md) | pine-converter | 1 | Low |

## Acceptance Criteria

- Every Trend Wizard `color.rgb(…,transp)` / `color.new(…)` in plots, hlines,
  and the table converts to compiling chartlang; `color` is imported.

## Deferred / Follow-Up

- `color.hsl(...)` transparency forms (not used by Trend Wizard).
