# Task 2 — `color` import gating + fixtures + docs

> **Status: TODO**

## Goal

Ensure the generated module **imports `color`** (and destructures it where the
surface requires) whenever a `color.*` member survives in the output, then ship
the fixture triples + compile round-trip + docs/skill updates that prove the
Task-1 lowering compiles.

## Prerequisites

- T6 Task 1 (color args routed through `convertColor`).

## Current Behavior

- `scanUsage(scaffold)` (`src/codegen/usage.ts`) is the single source of truth
  for the core import list AND the `compute` destructure. It force-ons
  `draw`/`state` from scaffold allocations and otherwise substring-scans the
  generated source. It does **not** add `color` when a `color.*` member appears
  — so `plot(bar.close, { color: color.rgb(...) })` references an unimported
  `color`. (Evidence: the import line was
  `import { defineIndicator, plot } from "@invinite-org/chartlang-core"` — no
  `color`.)
- After Task 1, many color args fold to plain `#RRGGBBAA` **strings** (no
  `color` reference) — but a **dynamic base** path emits
  `color.withAlpha(...)`, and 3-arg `color.rgb(...)` stays a `color` member —
  both need `color` imported.

## Desired Behavior

```ts
import { defineIndicator, plot, color } from "@invinite-org/chartlang-core";
//                                  ^^^^^ added when color.* survives
…
compute({ bar, plot, color }) { … color.withAlpha(base, 0.5) … }
```

A script whose colors all fold to hex strings imports **no** `color` (byte-
compat — no spurious import).

## Requirements

### 1. Gate `color` in `scanUsage`

- Add a NEW `color: boolean` field to the `UsageFlags` type in
  `src/codegen/usage.ts` (it does **not** exist today — the current flags are
  `draw`/`state`/`ta`/`plot`/`hline`/`alert`/`input`/`request`/`barstate`/
  `drawingHandle`/`barIndex`). Set it in `scanUsage` when the generated source
  corpus contains a `color.` member token (same substring-scan approach it uses
  for other symbols). Wire the flag into both the import list and the
  `compute({ … })` destructure so they never drift (the file's invariant).
- Do **not** import `color` when every color folded to a hex string literal —
  the scan keys on an actual `color.` occurrence, so this holds automatically.

### 2. Fixtures (`packages/pine-converter/fixtures/`)

Each a `.pine` + `.expected.chart.ts` + `.expected.diagnostics.json` triple,
passing the compile round-trip in `src/tests/fixtures-compile.test.ts`:

- `NN-color-rgb-transp.*` — `plot(close, color=color.rgb(255,153,0,60))` →
  hex string, **no** `color` import.
- `NN-color-new-literal.*` — `color.new(color.white, 50)` → hex string.
- `NN-color-dynamic-base.*` — a `var color c = …; … color.new(c, 50)` (dynamic
  base) → `color.withAlpha(...)` **with** `color` imported + destructured.

### 3. Docs + skill + CLAUDE.md

- `docs/converter/supported.md` — color-transparency row (4-arg rgb /
  `color.new` → hex or `withAlpha`).
- `skills/chartlang-coding/references/translating-from-pine.md` — Pine
  transparency → chartlang alpha note.
- `packages/pine-converter/CLAUDE.md` — document the `color` import gating in
  `scanUsage`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/codegen/usage.ts` | Modify | Force-on `color` import + destructure when `color.*` survives. |
| `packages/pine-converter/src/codegen/usage.test.ts` | Modify | Import-gating coverage (present / absent). |
| `packages/pine-converter/fixtures/NN-color-rgb-transp.*` | Create | 4-arg rgb fixture (hex, no import). |
| `packages/pine-converter/fixtures/NN-color-new-literal.*` | Create | `color.new` literal fixture. |
| `packages/pine-converter/fixtures/NN-color-dynamic-base.*` | Create | Dynamic-base `withAlpha` + import fixture. |
| `packages/pine-converter/src/tests/fixtures-compile.test.ts` | Modify | Round-trip the new fixtures. |
| `docs/converter/supported.md` | Modify | Color-transparency row. |
| `skills/chartlang-coding/references/translating-from-pine.md` | Modify | Transparency mapping note. |
| `packages/pine-converter/CLAUDE.md` | Modify | `color` import-gating invariant. |
| `.changeset/converter-color-transparency.md` | Create | patch (pine-converter). |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (100% coverage; fixture
  compile round-trip green)
- `pnpm docs:check`, `pnpm readme:check`
- `pnpm skills:gate` (skill reference changed)

## Changeset

`.changeset/converter-color-transparency.md` — **patch**
(`@invinite-org/chartlang-pine-converter`).

## Acceptance Criteria

- A `color.withAlpha`/3-arg `color.rgb` output imports + destructures `color`;
  an all-hex output imports none (byte-compat).
- The three fixtures compile via the round-trip; docs/skill/CLAUDE updated;
  coverage + gates green; changeset committed.
- Every Trend Wizard `color.rgb(…,transp)` / `color.new(…)` in plots, hlines,
  and the dashboard table converts to compiling chartlang.
