# T12 — Core + converter: non-numeric persistent state

## Overview

Add persistent (`var`) state for **non-numeric** types that `MASM_Strat.md`
relies on: `var color` slots and **`var bool`/`var string` history**
(`x[1]` on a persistent boolean/string). chartlang today has `state.int/float/
bool/string` scalars and a numeric `state.series`, but **no `state.color`** and
**no `state.series<bool>`/`<string>`** — so MASM's persistent colors and its
`long_pos_active[1]` / `short_pos_active[1]` reads lower to broken output.

This is the only core-capability task surfaced by MASM (T8-shaped:
core + runtime + converter). The v6 migration **eases** the bool half — in v6
a bool `[]` returns `false` (not `na`) on the first bar, so a `state.series<bool>`
maps cleanly with a `false` default.

## Current State (evidence — ran built converter)

`var color long_pos_exit_clr = na` then `c := close > open ? color.green :
color.red` → **no diagnostic**, but:

```ts
let c = Number.NaN;                                  // persistence LOST (not state.*)
c = (bar.close > bar.open) ? color.green : color.red; // number slot ← color (type clash)
```

And `long_pos_active[1]` (history on a `var bool`) hits the converter's known
deferral — `packages/pine-converter/CLAUDE.md` §"KNOWN GAPS":
*`bool`/`string` `var` history is a `state.series<bool>`/`<string>` deferred
follow-up … emits `series-history-non-numeric`*.

Root causes:
- `src/transform/other.ts` (`registerStateSlots` / `scanHistorySeries`):
  history-indexed numeric `var` → `state.series`; numeric scalars → `state.*`;
  but a `var color` falls outside the inferable types and a bool/string history
  read has no slot to lower into.
- core (`packages/core/src/state/state.ts`) has no `state.color` and
  `state.series` is numeric-only.

## Target State

- **core**: `state.series<boolean>` and `state.series<string>` (or a generic
  `state.series<T>`), and a persistent **`state.color`** slot (or
  `state.series<Color>`). Defaults: bool → `false` (v6 semantics), string →
  `""`/`na`, color → `na`/transparent.
- **runtime**: slot resolution + history buffers for the new types (extend
  `state/seriesSlot.ts`).
- **converter**: `var color` → `state.color`; history-indexed `var bool`/`var
  string` → `state.series<bool>`/`<string>` (retire `series-history-non-numeric`
  for these); value reads / `:=` writes / `[n]` reads route correctly.

## Architecture Decisions (to finalize in step 2)

| Decision | Notes |
|----------|-------|
| Generic `state.series<T>` vs. typed factories | Either generalize the existing numeric `state.series` to `<T>` (bool/string/color) or add typed siblings. Match the existing `state.*` ergonomics; keep wire/snapshot determinism. |
| `state.color` representation | A `Color` persisted across bars. Decide storage (hex string vs. `Color` object) and default. Reuse `packages/core/src/color/`. |
| First-bar / `na` defaults | v6: bool `[]` → `false` first bar. string/color defaults must be defined deterministically (no host variance). |
| Converter type inference | `var color X = na` currently defaults to `state.float` + `scalar-state-type-defaulted` (or, as observed, a bare `let`). Add `color`/`bool`/`string` inference so the right slot is chosen; retire the non-numeric deferral diagnostics where now supported. |
| Scope: persistence vs. history | Two needs: (a) a persistent color *scalar* (`var color`, no `[]`), (b) bool/string *history* (`[n]`). Both want a non-numeric slot; sequence core → runtime → converter. |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| Numeric `state.series` | `packages/core/src/state/state.ts`, runtime `state/seriesSlot.ts` | Template to generalize to `<T>`. |
| Color type | `packages/core/src/color/` | `state.color` value type. |
| Converter state-slot lowering | `src/transform/other.ts` (`registerStateSlots`, `scanHistorySeries`, `emitSeriesSlot`) | Choose the new slots; retire `series-history-non-numeric`. |
| Known-gap note | `packages/pine-converter/CLAUDE.md` §"KNOWN GAPS" | Update when bool/string history lands. |

## Dependencies

- v6 migration eases the bool default (informational, not a hard dep).
- Core-spanning like **T8** — sequence late; can share the determinism/wire
  review with T8.

## Dependency Graph

```
Task 1 (core: state.color + bool/string series types + ambient shim)
  |
  v
Task 2 (runtime: non-numeric ring + slot resolution + history/persistence)
  |
  v
Task 3 (converter: var color -> state.color; bool/string var history ->
        state.boolSeries/stringSeries; retire series-history-non-numeric)
  |
  v
Task 4 (fixtures + compile round-trip + example/docs/skills + MASM acceptance)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Core: `state.color` + non-numeric series types](./1-core-nonnumeric-state-types.md) | core, compiler | None | Medium |
| 2 | [Runtime: non-numeric slot resolution + history buffers](./2-runtime-nonnumeric-slots.md) | runtime | 1 | High |
| 3 | [Converter: lower `var color` + bool/string `var` history](./3-converter-lower-nonnumeric-state.md) | pine-converter | 1, 2 | Medium |
| 4 | [Fixtures, compile round-trip, docs/skills, acceptance](./4-fixtures-docs-acceptance.md) | pine-converter, core, docs | 1–3 | Low |

## Acceptance Criteria

- MASM's `var color long_pos_exit_clr` / `short_pos_exit_clr` persist and
  type-check; `long_pos_active[1]` / `short_pos_active[1]` convert to compiling
  `state.series<boolean>` reads (false on first bar).

## Deferred / Follow-Up

- `varip` non-numeric series (`state.tick.series<…>`) — approximate to non-tick
  + warn (mirror the existing `varip-series-approximated`).
- Persistent collections of non-numeric values (see `../map-collection/`).
