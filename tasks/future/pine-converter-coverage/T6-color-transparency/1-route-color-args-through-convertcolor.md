# Task 1 — Route plot/hline/table color args through `convertColor`

> **Status: TODO**

## Goal

Make every color argument the converter emits on the **plot / hline / table**
paths pass through the already-built `convertColor` lowering, so Pine's
transparency-carrying forms — 4-arg `color.rgb(r, g, b, transp)` and
`color.new(base, transp)` — become compiling chartlang instead of the silent
invalid output produced today. Define the **literal-base** (fold to
`#RRGGBBAA` hex) vs **dynamic-base** (`color.withAlpha(base, alpha)`) split.

## Prerequisites

None (T6 is self-contained; the dashboard's `get_dynamic_color` helper also
needs **T1** to convert at all, but T6's color lowering is independent and
testable on plain `plot`/`hline`).

## Current Behavior

- `convertColor(node, annotations)` + `transpToAlphaHex(transp)`
  (`src/transform/colorConvert.ts`) already fold `color.new(base, transp)` with
  a compile-time `#RRGGBB` base + literal int `transp` into a quoted
  `#RRGGBBAA` string (`alpha = round(255 * (100 - clamp(transp,0,100)) / 100)`).
  Used today only by the linefill/polyline path
  (`src/transform/polylineLinefill.ts`).
- The plot/hline path (`src/transform/plotFamily.ts`) and the table path
  (`src/transform/tables.ts`) route color args through `enumLookup`
  (named enums like `color.red` → `"#FF5252"`) and otherwise fall back to raw
  `emitExpr` — so `color.new(...)` and 4-arg `color.rgb(...)` pass through
  verbatim. (Evidence: `plot(close, color=color.rgb(255,153,0,60))` →
  `plot(bar.close, { color: color.rgb(255, 153, 0, 60) })`; chartlang
  `color.rgb` takes 3 args and `color` is unimported → won't compile, no
  diagnostic.)

## Desired Behavior

```ts
// plot(close, color=color.rgb(255,153,0,60))   transp 60 → alpha 0x66
plot(bar.close, { color: "#FF990066" });         // literal base → #RRGGBBAA hex

// plot(x, color=color.new(color.white, 50))
plot(x, { color: "#FFFFFF80" });                  // literal base → hex

// table cell bgcolor=get_dynamic_color(v)  → returns color.new(base_color, trans)
// dynamic base inside the helper:
color.withAlpha(base_color, alpha);               // dynamic base → withAlpha
```

## Requirements

### 1. Generalise `convertColor` coverage

- Ensure `convertColor` handles **4-arg `color.rgb(r, g, b, transp)`** (today
  it centers on `color.new`): treat the 4th arg as the Pine transparency and
  fold to `#RRGGBBAA` when r/g/b/transp are literals; otherwise fall to the
  dynamic path.
- Keep 3-arg `color.rgb(r, g, b)` mapping to a chartlang `color.rgb(r,g,b)`
  call (no alpha) — but ensure `color` becomes an imported symbol (Task 2).

### 2. Literal-base vs dynamic-base split

- **Literal base** (`#RRGGBB` literal or a `color.*` enum) + **literal transp**
  → fold to a `#RRGGBBAA` string via `transpToAlphaHex` (existing behaviour).
- **Dynamic base** (a computed expression, e.g. a `var`/param/ternary like
  `get_dynamic_color`'s `base_color`) or **dynamic transp** → emit
  `color.withAlpha(<emitted base>, <alpha>)`. Core's `withAlpha(c, alpha)`
  takes `alpha` in the **0–1** range (NOT 0–255), so for a literal transp emit
  `(100 - clamp(transp,0,100)) / 100` (e.g. `color.withAlpha(base_color, 0.4)`
  for transp 60), or an emitted expression computing that fraction for a
  dynamic transp. `color.withAlpha` exists in `packages/core/src/color/index.ts`.
- Centralise this decision inside `convertColor` so all three call paths
  (plot, table, linefill) share one rule — no per-path divergence.

### 3. Thread `convertColor` into plot/hline/table

- `src/transform/plotFamily.ts`: where a plot/hline `color=`/`bgcolor`/etc.
  arg is emitted, call `convertColor(arg, annotations)` instead of the raw
  `emitExpr`/enum-only path.
- `src/transform/tables.ts`: same for `bgcolor`/`text_color` cell args.
- Preserve the existing `enumLookup` fast-path for a bare named enum (it
  already yields a hex string) — `convertColor` should subsume it or delegate
  to it, but a bare `color.red` must keep mapping to its hex.

### 4. Diagnostics

- A `color.new`/`color.rgb` with non-foldable but resolvable args takes the
  `color.withAlpha` path silently. Append a NEW `color-transp-approximated`
  (info) to `src/diagnostics/codes.ts` (append-only, no reorder) for the
  plot/hline/table color-folding paths, and keep the existing
  `linefill-color-transp-approximated` (info) scoped to the linefill path —
  do not overload one code across both. No hard error for supported forms.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/colorConvert.ts` | Modify | 4-arg `color.rgb`; literal-vs-dynamic split; `color.withAlpha` emission. |
| `packages/pine-converter/src/transform/plotFamily.ts` | Modify | Route plot/hline color args through `convertColor`. |
| `packages/pine-converter/src/transform/tables.ts` | Modify | Route cell bg/text color args through `convertColor`. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Append `color-transp-approximated` (info) for plot/hline/table folding (linefill keeps its own code). |
| `packages/pine-converter/src/transform/colorConvert.test.ts` | Modify | 4-arg rgb, color.new, dynamic base/transp coverage. |
| `packages/pine-converter/CLAUDE.md` | Modify | Document the shared color rule across plot/table/linefill. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (100% coverage)

(`pnpm docs:check` / `readme:check` / `skills:gate` run in Task 2, which owns
the `docs/`, skill, and fixture changes — Task 1 touches only transform source,
codes, tests, and `CLAUDE.md`.)

## Changeset

Covered by Task 2's `@invinite-org/chartlang-pine-converter` **patch**
changeset.

## Acceptance Criteria

- 4-arg `color.rgb(...,transp)` and `color.new(base,transp)` on plot/hline/table
  paths lower to a compiling chartlang color (hex for literal base, `withAlpha`
  for dynamic base).
- Bare named enums still map to their hex; one shared `convertColor` rule across
  all three paths; 100% coverage; `CLAUDE.md` updated.
