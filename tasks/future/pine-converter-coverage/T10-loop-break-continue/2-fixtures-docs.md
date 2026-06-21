# Task 2 — Fixtures, compile round-trip, docs/CLAUDE

> **Status: TODO**

## Goal

Lock the Task-1 loop changes behind fixture triples that round-trip through the
compiler, and update the loop-policy invariant in CLAUDE.md. After this task,
`break`/`continue` loops and loop-body `+=` are a tested, documented, supported
idiom — never silent invalid output.

## Prerequisites

- Task 1 (`break`/`continue` parse + no-unroll loop lowering + `+=` fix +
  runtime-index rule) complete.

## Current Behavior

- A `for`+`break`+`+=` loop emits invalid, non-compiling output with **no**
  diagnostic (Task-1 evidence). No fixture exercises `break`/`continue` today.
- Fixtures are numbered triples under `packages/pine-converter/fixtures/`
  (`NN.pine` + `NN.expected.chart.ts` + `NN.expected.diagnostics.json`); the
  compile round-trip is `src/tests/fixtures-compile.test.ts` with the
  `KNOWN_NON_COMPILING` skip set. Use the next free `NN` (confirm against the
  dir — sibling TX tasks also add fixtures; do not hardcode a colliding number).
- `packages/pine-converter/CLAUDE.md` documents the loop policy
  (stateful/non-stateful unroll split) — now needs the no-unroll-with-break
  case and the runtime-index rule.

## Desired Behavior

- A fixture mirroring MASM's consolidation loop (`for`+`if`+`break`+`+=`,
  runtime `ma_slope[i]`) converts to a compiling chartlang runtime `for`.
- A second fixture covers `continue` and a nested-`if`+`break`.
- The loop-policy invariant documents both the no-unroll-with-break rule and
  the runtime series-index allowance.

## Requirements

### 1. Fixtures (`packages/pine-converter/fixtures/`)

Add `NN-loop-break-counter.pine` (next free number) — the MASM consolidation
shape:

```pine
//@version=6
indicator("Loop break counter", overlay=false)
tol = input.int(4, "Tolerance")
rng = input.float(1.0, "Range", step=0.1)
ms = ta.ema(((close - close[1]) / close[1] * 100), 3)
consol_count = 0
for i = 0 to tol
    if (ms[i] > rng) or (ms[i] < -rng)
        consol_count := 0
        break
    consol_count += 1
plot(consol_count)
```

Add `NN-loop-break-counter.expected.chart.ts` (a runtime `for` with `break`
inside, `consol_count += 1`, legal `ms[i]` index) and
`NN-loop-break-counter.expected.diagnostics.json`. Add a second triple
`NN-loop-continue.pine` exercising `continue` + a nested `if`+`break`. Keep both
**OUT** of `KNOWN_NON_COMPILING` — they must round-trip and compile through
`src/tests/fixtures-compile.test.ts`.

### 2. Diagnostics

- Confirm the Task-1 codes (`break-continue-outside-loop`,
  `stateful-loop-with-break`) are registered in
  `packages/pine-converter/src/diagnostics/codes.ts` (append-only) and exercised
  so `code-coverage-grep.test.ts` passes. Add a reject fixture (`ta.*` inside a
  break-loop) asserting the `stateful-loop-with-break` diagnostic; that fixture
  stays a comment-stub (allowed to skip the compile round-trip via its error
  severity, like other reject fixtures).

### 3. CLAUDE.md (`packages/pine-converter/CLAUDE.md`)

- Update the loop-policy invariant (§"Transform: control flow … `emitFor`"):
  document (a) `break`/`continue` force the runtime-`for` path (no unroll), (b)
  the loop-body `+=` lowering, (c) the runtime series-index allowance for a
  `Series`/`state.series`/`bar.*` receiver inside a loop, and (d) the
  stateful-body-with-break reject. Per the repo rule, a behavior change updates
  that folder's CLAUDE.md in the same PR.

### 4. Docs

- `docs/converter/supported.md`: add `break`/`continue` loops to supported
  idioms.
- `docs/converter/rejects.md`: document the stateful-body-with-break reject.
- `docs/converter/diagnostics.md` is generated — re-run its generator so the
  new codes get pages.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/fixtures/NN-loop-break-counter.pine` | Create | Fixture (MASM consolidation shape). |
| `packages/pine-converter/fixtures/NN-loop-break-counter.expected.chart.ts` | Create | Expected output. |
| `packages/pine-converter/fixtures/NN-loop-break-counter.expected.diagnostics.json` | Create | Expected diagnostics. |
| `packages/pine-converter/fixtures/NN-loop-continue.{pine,expected.chart.ts,expected.diagnostics.json}` | Create | `continue` + nested-if-break triple. |
| `packages/pine-converter/fixtures/NN-loop-stateful-break-reject.{pine,expected.chart.ts,expected.diagnostics.json}` | Create | Reject fixture (`ta.*` in break-loop). |
| `packages/pine-converter/src/tests/fixtures-compile.test.ts` | Modify | Keep clean fixtures out of `KNOWN_NON_COMPILING`. |
| `packages/pine-converter/CLAUDE.md` | Modify | Update loop-policy invariant. |
| `docs/converter/supported.md`, `docs/converter/rejects.md` | Modify | Document loops + reject. |
| `.changeset/t10-loop-break-continue.md` | Create | minor (pine-converter). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (coverage **100%**, incl. compile round-trip)
- `pnpm docs:check`
- `pnpm readme:check`

## Changeset

`.changeset/t10-loop-break-continue.md` — **minor**
(`@invinite-org/chartlang-pine-converter`).

## Acceptance Criteria

- `NN-loop-break-counter` + `NN-loop-continue` convert and **compile**
  (round-trip green, not in `KNOWN_NON_COMPILING`).
- The stateful-break reject fixture emits its diagnostic.
- Loop-policy CLAUDE.md invariant + docs updated; coverage + docs + readme
  gates green; changeset committed.
