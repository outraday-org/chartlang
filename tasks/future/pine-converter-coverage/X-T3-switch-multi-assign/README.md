# T3 — Converter: `switch` branch comma multi-assignment

## Overview

Support Pine `switch` branches that perform **multiple comma-separated
assignments** in one case arm. Trend Wizard's preset selector uses this:

```pine
switch preset_select
    "Trade Rational Default" => ma_1_lgth_preset := 8, ma_2_lgth_preset := 21, …
    "Swing Trading"          => ma_1_lgth_preset := 4, ma_2_lgth_preset := 10, …
```

Each branch assigns ~10 variables as a comma sequence. The converter today
parses only the **first** assignment and breaks on the comma.

## Current State (evidence — ran built converter)

Pine:
```pine
switch sel
    "X" => a := 8, b := 21
    "Y" => a := 4, b := 10
```
→ `pine-converter/parse/expected-token` + 3× `unexpected-token`. Output:

```ts
switch ((inputs.sel as string)) {
  case "X": { a = 8; break; }     // b := 21 lost
  case undefined: {  break; }      // comma artifact
  case "Y": { a = 4; break; }
  case undefined: {  break; }
}
```

- Single-value `switch` lowering works (`src/transform/other.ts`, `emitFor`/
  switch lowering; `controlFlow.ts`). The gap is the **comma-sequence of
  assignments** as a single branch body.
- The lexer suppresses newlines after a trailing comma (line-continuation
  rule), so `a := 8, b := 21` is one logical line; the parser's branch-body
  reader stops at the first `,`.

## Target State

- A switch (and arrow `=>`) branch body may be a **comma-separated assignment
  list**; each becomes a statement in the emitted `case` block:
  `case "X": { a.value = 8; b.value = 21; break; }` (slot writes per the
  `var`→`state.*` lowering).
- Works for both the subjected (`switch x`) and subjectless forms.

## Architecture Decisions (to finalize in step 2)

| Decision | Notes |
|----------|-------|
| Parse comma-list at the branch body, not globally | Keep the global comma semantics (tuple/args) intact; only the `=>` branch body gains a sequence-of-assignments reader. |
| Reuse assignment lowering | Each element is an `Assignment`; route through the existing `var`/`state.*` rewrite (`emitContext.ts`) so `:=` → `<slot>.value = …`. |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| Switch lowering | `src/transform/other.ts` / `controlFlow.ts` | Extend branch body to a statement list. |
| Assignment parse | `src/parser/expressions.ts` (`parseAssignment`) | Per-element parsing. |
| Slot write rewrite | `src/transform/emitContext.ts` | `:=` → `<slot>.value =`. |

## Dependencies

- None hard. Pairs naturally with the `var int … = na` preset variables Trend
  Wizard declares (already lowered to `state.int`).

## Dependency Graph

```
Task 1 (parser: comma-separated assignment list as a switch/arrow branch body)
  |
  v
Task 2 (transform lowering + fixtures + compile round-trip + docs/CLAUDE)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Parser: comma-separated assignment list branch body](./1-parser-branch-assignment-list.md) | pine-converter | None | Medium |
| 2 | [Transform lowering, fixtures, compile round-trip, docs/CLAUDE](./2-transform-fixtures-docs.md) | pine-converter, docs | 1 | Medium |

## Acceptance Criteria

- Trend Wizard's `preset_select` switch converts with all per-branch
  assignments preserved, no parse errors.

## Deferred / Follow-Up

- Comma-sequenced **statements** outside switch branches (Pine allows it in a
  few spots) — only add if a real script needs it.
