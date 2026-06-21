# Task 2 — Transform lowering, fixtures, compile round-trip, docs/CLAUDE

> **Status: TODO**

## Goal

Lower a multi-assignment switch branch into a `case` block that emits each
assignment as its own statement (routed through the `var`→`state.*` slot
rewrite), add a fixture that round-trips through the compiler, and update the
docs/CLAUDE surface.

## Prerequisites

- Task 1 (parser branch-body assignment list) complete.

## Current Behavior

The switch lowering (`src/transform/other.ts` / `src/transform/controlFlow.ts`)
emits `switch (x) { case <t>: { <body> break; } … }` from a **single**-value
branch body. With Task 1, a branch body is now an ordered list; the lowering
must emit each element. Output today for the multi-assign case is broken:

```ts
switch ((inputs.sel as string)) {
  case "X": { a = 8; break; }     // b := 21 lost
  case undefined: {  break; }      // comma artifact
}
```

- `:=` reassignment of a `var int … = na` preset variable already lowers to a
  `state.int` slot write `<slot>.value = …` via `src/transform/emitContext.ts`.

## Desired Behavior

```pine
var int a = na
var int b = na
switch sel
    "X" => a := 8, b := 21
    "Y" => a := 4, b := 10
```
→
```ts
const a = state.int(Number.NaN);
const b = state.int(Number.NaN);
switch ((inputs.sel as string)) {
    case "X": { a.value = 8; b.value = 21; break; }
    case "Y": { a.value = 4; b.value = 10; break; }
}
```

## Requirements

### 1. Emit each branch element (`src/transform/other.ts` / `controlFlow.ts`)

- In the switch lowering, iterate the branch body's statement list and emit
  each element as a statement inside the `case { … }` block, in source order,
  followed by `break;`.
- Route each assignment through the existing `emitWithContext`
  (`src/transform/emitContext.ts`) so a `:=` on a `var`→`state.*` slot becomes
  `<slot>.value = …` and a plain reassignment stays bare. No new rewrite logic
  — reuse the per-assignment path.
- The subjectless (boolean-case) `switch` → `if/else if/else` lowering must
  likewise emit a list body per arm.

### 2. Fixture (`packages/pine-converter/fixtures/`)

Add `32-switch-multi-assign.pine` (next free number — confirm against the dir;
sibling TX tasks also add fixtures):

```pine
//@version=6
indicator("Preset selector", overlay=false)
var int a = na
var int b = na
sel = input.string("X", "Preset")
switch sel
    "X" => a := 8, b := 21
    "Y" => a := 4, b := 10
plot(a)
plot(b)
```

> The fixture deliberately uses a bare `input.string("X", "Preset")` (no
> `options=`) so T3 stays **independent of T4** — the switch branch body is what
> is under test here. (A separate T4 fixture covers `options=` → `input.enum`.)

Add `32-switch-multi-assign.expected.chart.ts` (the lowered output above) and
`32-switch-multi-assign.expected.diagnostics.json`. Keep it **OUT** of
`KNOWN_NON_COMPILING` (`src/tests/fixtures-compile.test.ts`) — it must
round-trip and compile.

### 3. Tests

- Transform unit tests: a multi-assign subjected branch emits N slot writes +
  `break`; a subjectless multi-assign arm emits N writes in its `if` block; a
  mixed single/multi switch is correct; defensive arms covered by the
  established `*.synthetic.test.ts` precedent.

### 4. Docs + CLAUDE

- `docs/converter/supported.md`: note multi-assignment switch branches are
  supported.
- `packages/pine-converter/CLAUDE.md`: update the switch-lowering invariant
  (the §"`switch` lowering" prose in the transform section) to state a branch
  body is a statement list, each element emitted in order.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/other.ts` / `controlFlow.ts` | Modify | Emit each branch-body element (subjected + subjectless). |
| `packages/pine-converter/fixtures/32-switch-multi-assign.pine` | Create | Fixture source. |
| `packages/pine-converter/fixtures/32-switch-multi-assign.expected.chart.ts` | Create | Expected output. |
| `packages/pine-converter/fixtures/32-switch-multi-assign.expected.diagnostics.json` | Create | Expected diagnostics. |
| `packages/pine-converter/src/tests/fixtures-compile.test.ts` | Modify | Keep `32` out of `KNOWN_NON_COMPILING`. |
| `packages/pine-converter/src/transform/*.test.ts` | Modify | Transform coverage. |
| `docs/converter/supported.md` | Modify | Document multi-assign switch branches. |
| `packages/pine-converter/CLAUDE.md` | Modify | Update switch-lowering invariant. |
| `.changeset/t3-switch-multi-assign.md` | Create | minor (pine-converter). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (coverage **100%**, incl. compile round-trip)
- `pnpm docs:check`
- `pnpm readme:check`

## Changeset

`.changeset/t3-switch-multi-assign.md` — **minor**
(`@invinite-org/chartlang-pine-converter`).

## Acceptance Criteria

- `32-switch-multi-assign` converts and **compiles**; every per-branch
  assignment is preserved with no parse/lowering diagnostics.
- Trend Wizard's `preset_select` switch (10 assignments per branch) converts
  cleanly.
- Coverage + docs + readme gates green; changeset committed.
