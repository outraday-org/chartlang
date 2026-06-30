# `color.new` / `color.rgb` in Free Expressions

> **Status: TODO**

## Goal

Lower Pine's `color.new(base, transp)` and `color.rgb(r, g, b, transp)`
when they appear in **arbitrary expressions** (assignments, ternaries,
function args other than the already-handled plot/hline/table color
positions). Today the color-lowering pass is wired only into specific
argument positions, so a free-expression `color.new(...)` leaks verbatim
into the emitted output and fails to compile (`Property 'new' does not
exist on type …color` — chartlang has no `.new`, only `withAlpha`).

## Prerequisites

None. (Shares the `colorConvert.ts` helpers with Task 4; sequence after
Task 4 to reuse any helper exports it adds, but not a hard dependency.)

This is the **highest-risk** task in the folder — the expression
emitter is a high-traffic code path covered by 76+ golden fixtures.

## Current Behavior

MASM examples that leak:

```pine
ma_slope_clr          = ma_slope >= 0 ? color.new(clr_green, 0) : color.new(clr_red, 0)
long_pos_exit_color   = color.rgb(54, 58, 69, 40)
```

The lowering helpers exist and work, but only fire in scoped contexts:

```ts
// src/transform/colorConvert.ts (~line 137)
convertColorWith(...) / convertColorNew(...) / convertColorRgb(...)
```

Call sites: `plotFamily.ts`, `tables.ts`, `setterFold.ts`,
`polylineLinefill.ts`, `other.ts` (bgcolor/barcolor). The generic
expression emitter `src/transform/exprEmit.ts` (`emitExpr`) has **no**
color hook, so `color.new(...)` in a free expression is emitted as-is.

Core color API (`packages/core/src/color/index.ts:23`): `withAlpha(c,
alpha)` (alpha 0–1, NOT Pine's 0–100), `rgb(r, g, b, alpha?)`, `hsl`,
named palette. No `.new`.

## Desired Behavior

In any expression position, lower:

- `color.new(base, transp)`:
  - **literal base + literal transp** → `#RRGGBBAA` string literal
  - **dynamic base** (e.g. a variable) + literal/dynamic transp →
    `color.withAlpha(<base>, <alpha 0–1>)` (convert transp 0–100 →
    alpha 0–1)
- `color.rgb(r, g, b)` → `#RRGGBB` (literal) or `color.rgb(r, g, b)`
  passthrough (dynamic)
- `color.rgb(r, g, b, transp)` → `#RRGGBBAA` (literal) or
  `color.rgb(r, g, b, <alpha 0–1>)` (dynamic; convert transp→alpha)

emitting the existing `color-transp-approximated` info diagnostic on the
alpha-approximation path (same as the plot-arg path does today), so
behavior is consistent across positions.

## Requirements

### 1. Hook lowering into `emitExpr`

In `src/transform/exprEmit.ts`, intercept call expressions whose callee
is `color.new` / `color.rgb` (and member access `color.<name>` if not
already resolved upstream) **before** the generic call emit, delegating
to the existing `colorConvert.ts` helpers. Do not duplicate the hex /
alpha math — reuse `convertColorNew` / `convertColorRgb` /
`convertColorWith`.

Minimal-blast-radius approach (preferred): a single guarded branch at
the top of the call-expression arm of `emitExpr` that returns the
lowered string when the callee matches, else falls through unchanged.

### 2. Preserve existing scoped call sites

The plot/hline/table/bgcolor sites already lower correctly. Ensure the
new `emitExpr` hook does not double-lower when those sites pre-process
their color arg (check whether they pass an already-lowered string vs.
the raw AST node into the emitter). If they lower then re-emit through
`emitExpr`, guard against re-entry. Add a regression note + test.

### 3. `color-transp-approximated` diagnostic parity

Reuse the existing diagnostic key — do not add a new code. Confirm it
fires once per free-expression approximation, consistent with the
plot-arg behavior.

**Constraint — `emitExpr` cannot push diagnostics directly.** Per
`packages/pine-converter/CLAUDE.md`, `emitExpr` (`exprEmit.ts`) is a
**pure function not threaded the `DiagnosticCollector`** — this is why
`nz`'s advisory (`nz-scalar-assumed`) is raised at the **top-level
`emitSpecialCall` site (`other.ts`)** where the collector is in scope,
not inside `emitExpr`. A free-expression `color.new(...)` can appear
nested deep in a ternary / assignment RHS, so you cannot raise
`color-transp-approximated` from the `emitExpr` hook the way the
plot/table sites (which hold the collector) do. Surface it via one of:
(a) the top-level `emitSpecialCall` / `transformOther` site that already
has the collector (the `nz-scalar-assumed` precedent), or (b) an
optional structural sink threaded into the emit context (the
`EmitContext.arrayWarn` / `mapWarn` precedent in CLAUDE.md). Do **not**
assume `emitExpr` can call `ctx.addDiagnostic`. Pick the
smaller-blast-radius mechanism and note it in the PR. If surfacing the
diagnostic from the pure path proves disproportionately invasive, it is
acceptable to defer the free-expression `color-transp-approximated`
emission (the alpha is still preserved — the diagnostic is info-only)
and document the deferral; the lowering itself must still land.

### 4. Golden fixtures + full corpus check

Add the next-numbered fixture trio:

```pine
//@version=6
indicator("color free expr")
clr_green = color.rgb(13, 218, 116)
dyn = close > open ? color.new(clr_green, 0) : color.new(color.red, 30)
lbl = color.rgb(54, 58, 69, 40)
plot(close, color = dyn)
```

Regenerate with `UPDATE_FIXTURES=1`; output must use `#RRGGBBAA` /
`color.withAlpha(...)` and compile. **Crucially**, regenerate and
diff-review the entire fixture corpus — any pre-existing fixture that
contained a free-expression color now changes output. Each such change
must be a genuine improvement (was previously non-compiling or leaked);
record them in the PR description.

### 5. Coverage

The expression emitter is coverage-sensitive; add unit tests in
`exprEmit.test.ts` for each lowering branch (literal/dynamic base,
rgb 3-arg/4-arg) to keep 100%.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/transform/exprEmit.ts` | Modify | Hook color lowering into call emit |
| `src/transform/colorConvert.ts` | Modify | Export helpers if needed |
| `src/transform/exprEmit.test.ts` | Modify | Branch coverage |
| `fixtures/NN-color-free-expr.{pine,expected.chart.ts,expected.diagnostics.json}` | Create | Golden trio (compiles) |
| `fixtures/*` (regenerated) | Modify | Corpus re-bless where free-expr colors appear |
| `src/tests/golden.test.ts` | Modify | Bump fixture count assertion |
| `packages/pine-converter/CLAUDE.md` | Modify | Note free-expression color lowering |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (pine-converter 100% coverage, incl. `fixtures-compile`)

## Changeset

`.changeset/converter-color-new-free-expressions.md` — `@invinite-org/chartlang-pine-converter: minor`.

## Acceptance Criteria

- Free-expression `color.new` / `color.rgb` lower to `#RRGGBBAA` /
  `color.withAlpha` / `color.rgb`; emitted output compiles.
- No double-lowering regression at existing plot/table/bgcolor sites.
- `color-transp-approximated` parity (no new code).
- New fixture compiles; any re-blessed corpus fixtures justified in PR.
- 100% coverage; `CLAUDE.md` updated; changeset committed.
