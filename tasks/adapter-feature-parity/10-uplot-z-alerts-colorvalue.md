# Task 10 — uplot: z-order + alertConditions/logs + line-family colorValue

> **Status: TODO**

## Goal

Complete uplot parity: add z-render-order via the shared sort, render
the `alertConditions` and `logs` it declares but buffers, and honor
`colorValue` for line-family plots.

## Prerequisites

Task 1 (shared sort), Task 3 (line-family colorValue reference), Task 9
(glyph draw pass exists to participate in the z-order).

## Current Behavior

In `createUplotAdapter.ts`:

- No `plot.z` / `drawing.z` is read; plots always paint under drawings
  in a fixed order.
- `alertConditions` are buffered (`currentAlertConditions` cleared +
  repopulated at `:950-953`) and never rendered; `applyLog` (`:921`)
  buffers `recentLogs` (cap 5) and never renders. Both declared `true`
  (`capabilities.ts:87-88`).
- Line-family plots take a single series stroke from `point.color`
  (`seriesColor` `:483`); `colorValue` is not applied (bg/bar-color
  honor it).

## Desired Behavior

- A single z-sorted paint pass orders the draw-hook passes (series /
  glyphs / hlines / drawings) by `(z ?? 0, band, seq)`.
- alertConditions + logs render via the draw hook + canvas sink.
- Line/step/area/histogram honor `colorValue` 3-state via per-run
  stroke painting in the draw hook.

## Requirements

### 1. z-render-order

Import `sortByRenderOrder` / `RENDER_BAND`. Because uPlot draws line/
step/area/histogram as native series but candles/bands/hlines/glyphs/
drawings via the draw hook, build a unified mark list with
`(z, band, seq)` and drive the **draw-hook** passes in sorted order.
**Decision: best-effort native-series ordering + documented constraint —
do NOT repaint native series in the draw hook.** Order native series via
uPlot's native series draw order / `zIndex` where the model allows; the
hook-painted marks are fully z-sorted among themselves. Document the
achievable ordering + the residual uPlot constraint in the adapter
`CLAUDE.md` (a `z:-1` drawing must be able to sit below a `z:0` plot —
state how that is realized, and where native-vs-hook ordering is
bounded). Assign `seq` at ingest, mirroring canvas2d.

### 2. alertConditions + logs

Paint from `state.currentAlertConditions` (rebuilt per drain) +
`state.recentLogs` (cap 5) via the draw hook + canvas sink, mirroring
`canvas2d/render/alertConditions.ts` + `render/logPane.ts`. Always-on-
top (after the z-sorted pass), matching canvas2d's v1 posture. Empty
list ⇒ nothing.

### 3. line-family colorValue

uPlot's native series stroke is whole-series, so per-bar color requires
a custom paths/draw approach. Resolve each bar's color as `colorValue
=== undefined ? point.color : colorValue`; paint the line as
consecutive same-color runs in the draw hook (the canvas2d per-run
model), breaking on `colorValue === null` (gap) and composing with the
`value:null` gap. Add `colorValue` to the stored `PlotPoint`
(`:224-237`). Keep omitted-`colorValue` output byte-identical (existing
tests hold). Document the whole-series → per-run limitation removal in
`CLAUDE.md` (the audit noted this gap was undocumented).

### 4. Tests + docs + honesty

- z (a `z:-1` drawing below a `z:0` plot; a `z:1` plot above drawings)
  via the canvas call-log ordering.
- alertConditions + logs render (and empty case).
- line colorValue: omitted unchanged; present subset ⇒ per-run; `null`
  ⇒ gap.
- `capabilities.ts` flags now all backed by rendering.
- Update `examples/uplot-adapter/CLAUDE.md`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/createUplotAdapter.ts` | Modify | z-sort pass; alert/log; line colorValue runs |
| `src/createUplotAdapter.test.ts` | Modify | z/alert/log/colorValue tests |
| `examples/uplot-adapter/CLAUDE.md` | Modify | z + alert/log + colorValue invariants |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (uplot 100% coverage)
- `pnpm conformance`
- `pnpm adapters:generate` + `pnpm adapters:gate`
- `pnpm docs:check`

## Changeset

`.changeset/uplot-z-alerts-colorvalue.md` — private example package
(empty changeset).

## Acceptance Criteria

- z-order via shared sort; alertConditions + logs render; line-family
  colorValue honored 3-state; omitted path unchanged.
- 100% coverage; conformance + `adapters:gate` green; `CLAUDE.md`
  updated; changeset committed.
