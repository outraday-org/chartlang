# Task 3 — Converter: lower `var color` + bool/string `var` history

> **Status: TODO**

## Goal

Make the Pine converter emit the Task 1/2 slots: `var color` →
`state.color`, and a history-indexed `var bool` / `var string` →
`state.boolSeries` / `state.stringSeries`. Retire the
`series-history-non-numeric` deferral for the now-supported bool/string cases,
and add `color` to the converter's scalar-state type inference so a `var color`
no longer falls back to a bare `let` / `state.float`.

## Prerequisites

Task 1 (core surface) + Task 2 (runtime slots) — the emitted code must compile.

## Current Behavior (evidence — ran built converter)

`var color long_pos_exit_clr = na` then `c := close > open ? color.green :
color.red` → **no diagnostic**, but persistence is lost and the type clashes:

```ts
let c = Number.NaN;                                   // not state.* — not persistent
c = (bar.close > bar.open) ? color.green : color.red; // number slot ← Color
```

And `long_pos_active[1]` (history on a `var bool`) hits the deferral documented
in `packages/pine-converter/CLAUDE.md` §"KNOWN GAPS"
(`series-history-non-numeric` info; the `<slot>.value[n]` form does not
compile).

Mechanics (`src/transform/other.ts`):
- `registerStateSlots` infers a scalar's factory from its literal init
  (int/float/bool/string); an un-inferable init (a `#RRGGBB` color, an
  identifier) defaults to `state.float` + `scalar-state-type-defaulted` — there
  is no `color` arm.
- `scanHistorySeries` lowers a history-indexed **numeric** `var` to
  `state.series` (`emitSeriesSlot`); a non-numeric history-indexed `var` keeps
  the scalar slot and emits `series-history-non-numeric`.

## Desired Behavior

```ts
// var color long_pos_exit_clr = na
const longPosExitClr = state.color(color.na);
longPosExitClr.value = (bar.close > bar.open) ? color.green : color.red;

// var bool long_pos_active ... ; long_pos_active[1]
const longPosActive = state.boolSeries(false);
longPosActive.value = entered;
... longPosActive[1] ...        // false on first bar

// var string long_exit_label_suffix = "-" ; suffix[1]
const longExitLabelSuffix = state.stringSeries("-");
```

- A `var`/`varip` **color** scalar → `state.color(<init>)`; reads → `<slot>.value`,
  `:=`/`=` → `<slot>.value = …`. `na` init → `color.na` (the converter's
  na-flavour already distinguishes handle/numeric — add the color flavour).
- A history-indexed (`[n]` anywhere) `var bool` / `var string` →
  `state.boolSeries` / `state.stringSeries`; value reads → `<slot>.value`,
  history reads → bare `<slot>[n]`, writes → `<slot>.value = …` (mirror the
  numeric `state.series` lowering split).
- A bool/string `var` that is **never** `[n]`-indexed keeps its leaner scalar
  slot (`state.bool` / `state.string`) — unchanged.
- `series-history-non-numeric` is no longer emitted for bool/string (retired);
  keep it only for any type still unsupported.

## Requirements

### 1. Color scalar inference (`src/transform/other.ts` `registerStateSlots`)

Add a `color` arm: a `var`/`varip` whose declared type is `color` OR whose init
is a color literal / `color.*` / `na`-in-color-context → `state.color`. Route
the na init through the color na-flavour (see §3). Drop the
`scalar-state-type-defaulted` fallback for this case.

### 2. Bool/string history lowering (`scanHistorySeries` / `emitSeriesSlot`)

Extend the history-series lowering: a history-indexed `var bool` →
`state.boolSeries(<init>)`, `var string` → `state.stringSeries(<init>)`. Reuse
`forEachHistoryAccess` (`exprEmit.ts`) to detect `[n]`. Wire the
`EmitContext.seriesSlots` entry so value reads → `.value`, history reads → bare
slot, `:=` → `.value =` — exactly the numeric split, with the element type
chosen from the var's inferred type.

### 3. na-flavour for color (`src/semantic/` / `exprEmit.ts`)

The semantic na-flavour pass currently yields `handle` or `numeric`. Add a
`color` flavour so `var color x = na` emits `color.na` (Task 1 default), not
`Number.NaN`. `exprEmit` reads `SemanticAnnotation.naKind` — extend it.

### 4. Retire / narrow `series-history-non-numeric`

Stop emitting it for bool/string (now supported). Keep the code (append-only)
for any genuinely still-unsupported type. Update
`packages/pine-converter/CLAUDE.md` §"KNOWN GAPS".

### 5. Coverage

100% line/branch/function. Synthetic-AST unit tests for parser-unreachable
arms (the established precedent) for any new defensive branch.

## Edge cases

- `varip color` / `varip bool`-series → still approximate to the non-tick slot
  + `varip-series-approximated` (deferred; do not block).
- A bool/string `var` indexed with a **non-literal** offset (`x[i]`) keeps the
  existing `dynamic-series-index` (error) — unchanged.
- A color used only as a transient (non-`var`) value is unaffected — this is
  about **persistent** color state.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/transform/other.ts` | Modify | `state.color` inference + bool/string history lowering. |
| `src/transform/exprEmit.ts` | Modify | Color na-flavour emit; history-access reuse. |
| `src/semantic/*.ts` | Modify | `color` na-flavour annotation. |
| `src/transform/emitContext.ts` | Modify | Route non-numeric series value/history/`:=`. |
| `packages/pine-converter/CLAUDE.md` | Modify | Retire/narrow `series-history-non-numeric`. |
| `src/transform/*.test.ts` (+ synthetic) | Modify/Create | Coverage. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (100% coverage)
- `pnpm docs:check`

## Changeset

Covered by Task 1's shared T12 changeset (pine-converter is patch).

## Acceptance Criteria

- `var color` → `state.color` (persistent, `color.na` init); bool/string `var`
  history → `state.boolSeries`/`stringSeries` with the value/history/`:=` split.
- `series-history-non-numeric` no longer fires for bool/string; converter
  coverage 100%.
