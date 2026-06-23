# Task 7 — konva: alertConditions + logs rendering + line-family colorValue

> **Status: TODO**

## Goal

Render the `alertConditions` and `logs` konva declares but only buffers,
and honor `colorValue` for line-family plots — mirroring the canvas2d
reference (Task 3) in the konva node model.

## Prerequisites

Task 3 (line-family colorValue reference); Task 6 (same konva file).

## Current Behavior

`createKonvaAdapter.ts` validates and IGNORES alerts / alertConditions
/ logs (`:879-884`); `alerts: log,toast`, `alertConditions: true`,
`logs: true` are declared (`capabilities.ts:59,85-86`) but nothing
renders them (documented as a deferred no-op in the konva `CLAUDE.md`).
Line-family plots use `seriesColor(series, …)` → `plot.color`
(`:430,469,765`); `colorValue` is not applied (bg-color honors it,
bar-color will after Task 6).

## Desired Behavior

- Alert conditions + logs render as konva nodes (Text/Rect groups) in
  the overlay pane, mirroring `canvas2d/render/alertConditions.ts` +
  `render/logPane.ts`.
- Line/step/area/histogram honor `colorValue` 3-state via per-run
  konva line segments (the canvas2d per-run model).

## Requirements

### 1. alertConditions + logs nodes

Replace the validated-and-ignored arms (`:879-884`) with renderers:

- alertConditions: from `state.currentAlertConditions` (rebuilt per
  drain), draw a marker/badge group per active condition in the overlay
  pane. Empty list ⇒ nothing.
- logs: from `state.recentLogs` (cap 5, matching canvas2d), draw a log
  pane group (last N rows). Position consistently (bottom-left overlay).

Keep alerts/logs painting ABOVE the z-sorted pass (Task 6) — always-on-
top, matching canvas2d's v1 posture. Update the konva `CLAUDE.md` to
remove the "validated-and-ignored" note.

### 2. line-family colorValue

For konva line/area, resolve each bar's color as `colorValue ===
undefined ? plot.color : colorValue`; split the polyline into
consecutive same-color runs (each its own `Line` node or a multi-color
path), and break the run on `colorValue === null` (gap) — composing
with the existing `value:null` segmentation (`lineSegments`,
`:383-402`). Histogram: per-bar color, `null` ⇒ no bar. Omitted-
`colorValue` output stays byte-identical (existing tests hold).

### 3. Tests + docs + honesty

- alertConditions render (and empty case); logs render N rows + cap.
- line colorValue: omitted unchanged; present subset ⇒ per-run colors;
  `null` ⇒ gap.
- `capabilities.ts` flags now all backed by real rendering.
- Update `examples/konva-adapter/CLAUDE.md` accordingly.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/createKonvaAdapter.ts` | Modify | alert/log nodes; line colorValue runs |
| `src/createKonvaAdapter.test.ts` | Modify | alert/log/colorValue tests |
| `examples/konva-adapter/CLAUDE.md` | Modify | Alert/log + colorValue invariants |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (konva 100% coverage)
- `pnpm conformance`
- `pnpm adapters:generate` + `pnpm adapters:gate`
- `pnpm docs:check`

## Changeset

`.changeset/konva-alerts-logs-colorvalue.md` — private example package
(empty changeset).

## Acceptance Criteria

- alertConditions + logs render; capabilities honest.
- Line-family colorValue honored 3-state; omitted path unchanged.
- 100% coverage; conformance + `adapters:gate` green; `CLAUDE.md`
  updated; changeset committed.
