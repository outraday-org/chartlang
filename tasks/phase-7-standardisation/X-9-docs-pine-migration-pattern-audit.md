# Pine migration guide: pattern audit vs top ~50 scripts

> **Status: Complete**

## Goal

Finalise `docs/spec/pine-migration.md` for 1.0 with the
pattern-coverage approach (user-confirmed): audit the distinct idioms
used by the top ~50 public Pine scripts, add a **pattern-coverage
matrix** to the guide mapping every idiom to a documented chartlang
equivalent or an explicit "not supported, see roadmap" entry, and add
worked examples only for idioms not already covered. The matrix — not
50 ports — is the deliverable.

## Prerequisites

- Tasks 4–6 — the guide cross-links the finished spec pages
  (grammar for forbidden constructs, semantics for series/NaN rules).

## Current Behavior

`docs/spec/pine-migration.md` (200 lines, Phase 6) ships six worked
examples (indicators, drawings, alerts, inputs, state, MTF — HTF +
LTF), a feature matrix flagging strategy primitives / webhooks /
advanced `plot()` options as gaps, and a 5-script audit checklist.
The Phase 7 done-criterion requires coverage of "the patterns from
the top ~50 Pine scripts."

## Desired Behavior

The guide gains:

- A **Pattern-coverage matrix** section: one row per distinct Pine
  idiom found in the audit — `| Pine idiom | example script(s) |
  chartlang equivalent | status |` where status is `covered`
  (links the worked example or primitive page), `covered-inline`
  (one-liner mapping in the row), or `not-supported` (links the
  roadmap note).
- New worked examples for any audited idiom that has a chartlang
  equivalent but no example (expected candidates based on common
  TradingView scripts: `ta.crossover`/`crossunder` signal patterns,
  `plotshape`/`plotchar` marker mapping, `bgcolor`/`barcolor`
  mapping, multi-output indicators via several `plot` calls,
  `security()` with `lookahead` semantics differences,
  volume-profile usage, session-based resets via the `time` subpath,
  `input.timeframe` → `input.interval`).
- A **Not supported in 1.0** section consolidating every
  `not-supported` row: strategy primitives (`strategy.*`),
  `request.financial`/`dividends`/`economic` (data-source-neutral
  posture, PLAN §21), webhooks, `varip` beyond `state.tick.*`
  semantics, library scripts (`library()`/`import`), arrays/matrices
  beyond bounded use, `line.new`-style imperative drawing mutation
  where chartlang's handle model differs. Each with its roadmap
  pointer ("Beyond 1.0", PLAN §19).
- The audit method + script list documented in an appendix so the
  claim "top ~50" is verifiable.

## Requirements

### 1. The audit

Compile a list of ~50 widely-used public Pine scripts. Sources, in
preference order: TradingView's built-in indicator set (the ~30
standard indicators every Pine author knows: RSI, MACD, BB, Stoch,
Ichimoku, SuperTrend, VWAP, ADX, ATR, PSAR, OBV, CMF, MFI, CCI,
WilliamsR, Aroon, Keltner, Donchian, EMA/SMA ribbons, Pivot Points,
Volume Profile, ZigZag …) plus ~20 of the most-liked community
scripts (by editor's-pick / popularity at audit time). For each
script record: name, idioms used (checklist of ~20 idiom categories —
inputs, plots, shapes/chars, bgcolor/barcolor, alerts,
alertcondition, security HTF, security LTF, var state, varip, lines/
boxes/labels/tables, sessions, arrays, loops, libraries,
strategy calls, fills, hline, barssince/valuewhen-style helpers,
math/nz/na handling).

The audit table lives in the appendix as
`| script | idiom categories used |` — terse, one line per script.
Web access at execution time may be limited; if live popularity data
is unavailable, the built-in indicator set + a documented static list
of well-known community scripts (SuperTrend variants, Squeeze
Momentum, QQE, UT Bot, Chandelier Exit, etc.) satisfies the
criterion — note the method honestly in the appendix.

### 2. The matrix

Derive distinct idioms from the audit (expected: ~20–25 rows). Every
row resolves to `covered` / `covered-inline` / `not-supported` — no
blank cells. `covered` rows must link an existing worked example,
spec section, or `docs/primitives/` page (dead links fail
`docs:build`).

### 3. New worked examples

For each `covered`-status idiom lacking an example, add one in the
established format (Pine source block → chartlang equivalent block →
notes). Keep each example minimal (≤ 40 lines combined). Every
chartlang snippet must compile — verify each against the real surface
(the `docs:check` example executor does not run spec pages, so
verification is manual: paste into a scratch `.chart.ts` and run
`pnpm chartlang compile` on it; record the check in the PR
description).

### 4. Guide structure after this task

1. High-level mental model (existing)
2. Worked examples (existing 6 + new ones)
3. Pattern-coverage matrix (new)
4. Not supported in 1.0 (new, consolidates the existing feature
   matrix gaps)
5. Appendix: audit method + script list (new)

Front-matter `since` stays `"0.6"`; add `revised: "1.0"`.

### 5. Length discipline

The guide may grow substantially (200 → ~450-550 lines) — that is
fine; `readme:check` caps READMEs, not docs pages. Resist
example sprawl: an idiom that differs from an existing example only
in primitive name gets a matrix row (`covered-inline`), not a new
example.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `docs/spec/pine-migration.md` | Modify | Matrix + new examples + not-supported section + appendix. |
| `docs/.vitepress/config.ts` | Modify (only if sidebar label changes) | Keep sidebar accurate. |

## Gates

- `pnpm docs:build` — every matrix link resolves.
- `pnpm docs:check`
- `pnpm readme:check`
- `pnpm lint`

## Changeset

None — docs-only.

## Acceptance Criteria

- [ ] Audit appendix lists ~50 scripts with idiom categories; method
      documented honestly.
- [ ] Pattern-coverage matrix has zero blank status cells; every
      `covered` row links a resolving target.
- [ ] Every new chartlang snippet compiled via
      `pnpm chartlang compile` (verification recorded in the PR
      description).
- [ ] Not-supported section consolidates every gap with a roadmap
      pointer.
- [ ] `pnpm docs:build` green.
