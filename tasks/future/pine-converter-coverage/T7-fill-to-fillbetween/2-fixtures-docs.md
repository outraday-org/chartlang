# Task 2 — `fill` fixtures + compile round-trip + docs

> **Status: TODO**

## Goal

Lock the T7 lowering with fixture triples (two-hline band, two-plot band),
verify they pass the compile round-trip, and update the converter docs
(`supported.md`, `rejects.md`, `diagnostics.md`) + `CLAUDE.md` so the `fill`
mapping is documented and the old hard-reject prose is corrected.

## Prerequisites

- T7 Task 1 (`fill` → `draw.fillBetween` lowering).
- T6 (color transparency) for the colored-band fixture to compile clean.

## Current Behavior

- No fixture exercises `fill` (it was a hard reject, so there is no
  `fill`-bearing `.pine` under `packages/pine-converter/fixtures/`).
- `docs/converter/supported.md` does not list `fill`; `docs/converter/rejects.md`
  lists `fill(...)` under hard rejects (the `fill-not-mapped` entry).
- `packages/pine-converter/CLAUDE.md` ("Transform: control flow + passthrough"
  / `plotFamily`) states `fill` → `fill-not-mapped` (error).

## Desired Behavior

- Two clean fixtures compile end-to-end via
  `packages/pine-converter/src/tests/fixtures-compile.test.ts`:
  1. `NN-fill-hline-band.pine` — two `hline`s + a colored `fill` between them
     (the Trend Wizard consolidation band shape).
  2. `NN-fill-plot-band.pine` — two `plot`s + a `fill` tracking both series.
- One reject fixture: a `fill` over an unresolved/unsupported handle →
  `fill-handle-unresolved` (or narrowed `fill-not-mapped`), output is a
  comment stub (allowed to skip the compile round-trip, like other reject
  fixtures).
- Docs reflect that `fill(hline/plot, …)` is now **supported**; only
  unsupported shapes reject.

## Requirements

### 1. Fixture triples (`packages/pine-converter/fixtures/`)

- For each fixture: `NN-name.pine` + `NN-name.expected.chart.ts` +
  `NN-name.expected.diagnostics.json`. Number them after the current highest
  fixture index (no reorder).
- The two clean fixtures must NOT be added to `KNOWN_NON_COMPILING`
  (`src/tests/fixtures-compile.test.ts`); they must compile.
- The colored-band fixture's `color.rgb(r,g,b,transp)` fill exercises the T6
  color lowering. Confirm the `.expected.chart.ts` color matches T6's rule: a
  **literal** base (`color.rgb`/`color.*` enum/`#RRGGBB` + literal transp) folds
  to a `#RRGGBBAA` hex string; a **dynamic** base lowers to
  `color.withAlpha(<base>, <alpha 0..1>)`. The Trend-Wizard band
  (`color.rgb(205,121,219,88)`) is a literal base → expect the folded
  `#RRGGBBAA` hex.
- **T6 gating:** because the colored band's expected output is fixed by T6's
  `convertColor`, land this group AFTER T6 (T6 is a prerequisite). If T7 must
  land first, park the colored-band fixture in `KNOWN_NON_COMPILING` with a
  `// TODO remove when T6 lands` note and ship an uncolored band fixture as the
  clean case; remove the skip once T6 merges.

### 2. Docs

- `docs/converter/supported.md`: add a `fill(plotA, plotB, color?)` →
  `draw.fillBetween` row (note: two-hline horizontal band + two-plot series
  band).
- `docs/converter/rejects.md`: move `fill` out of "no analogue" — document that
  only unresolved/unsupported `fill` handle shapes reject
  (`fill-handle-unresolved`), with a rewrite suggestion.
- `docs/converter/diagnostics.md` (generated): regenerate so the new
  `fill-handle-unresolved` entry and the repurposed `fill-not-mapped` text
  appear.

### 3. `CLAUDE.md`

- `packages/pine-converter/CLAUDE.md`: update the `plotFamily` / `fill`
  references — `fill(hline/plot, …)` now lowers to `draw.fillBetween` via the
  shared general `emitFillBetweenBand` edge-builder (which `emitLinefill` also
  now routes through, via edge descriptors: `constant`/`series`/`endpoints`);
  only genuinely unsupported `fill` shapes reject (`fill-handle-unresolved` /
  narrowed `fill-not-mapped`).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/fixtures/NN-fill-hline-band.*` | Create | Two-hline band fixture triple. |
| `packages/pine-converter/fixtures/NN-fill-plot-band.*` | Create | Two-plot band fixture triple. |
| `packages/pine-converter/fixtures/NN-fill-reject.*` | Create | Unsupported-shape reject fixture. |
| `docs/converter/supported.md` | Modify | `fill` → `draw.fillBetween` row. |
| `docs/converter/rejects.md` | Modify | Narrow `fill` reject prose. |
| `docs/converter/diagnostics.md` | Modify (regenerate) | New/updated codes. |
| `packages/pine-converter/CLAUDE.md` | Modify | `fill` lowering invariant. |
| `.changeset/converter-fill-fixtures.md` | Create | patch (pine-converter). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage; fixture compile round-trip green for the two
  clean bands)
- `pnpm docs:check`
- `pnpm readme:check`

## Changeset

`.changeset/converter-fill-fixtures.md` — **patch**
(`@invinite-org/chartlang-pine-converter`). (May be covered by T7 Task 1's
changeset if landed together.)

## Acceptance Criteria

- Trend Wizard's `fill(guide_consol_upper, guide_consol_lower, color=…)`
  converts to a compiling `draw.fillBetween` (mirrored by the hline-band
  fixture).
- Both clean band fixtures pass the compile round-trip; the reject fixture
  emits its diagnostic.
- `supported.md` / `rejects.md` / `diagnostics.md` / `CLAUDE.md` updated; all
  gates green.
