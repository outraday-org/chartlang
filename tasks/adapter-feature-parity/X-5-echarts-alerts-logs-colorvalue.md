# Task 5 — echarts: alertConditions + logs rendering + line-family colorValue

> **Status: TODO**

## Goal

Close echarts' capability-honesty gap (render the `alertConditions` and
`logs` it declares but currently only buffers) and honor `colorValue`
for line-family plots, mirroring the canvas2d reference pattern from
Task 3.

## Prerequisites

Task 3 (canvas2d line-family `colorValue` reference pattern); Task 4
(same echarts file — land sequentially to avoid a merge).

## Current Behavior

In `examples/echarts-adapter/src/createEChartsAdapter.ts`:

- `applyAlert` (`:811-821`), `currentAlertConditions` (`:852-855`), and
  `applyLog` (`:823-828`) push into ring buffers; nothing in
  `buildOption` renders an alert-condition marker or a log pane. The
  `onAlert` host callback fires, but `alertConditions: true` and
  `logs: true` are declared in `ECHARTS_CAPABILITIES` with no on-chart
  rendering.
- Line-family plots set `series` color from `plot.color`
  (`seriesColor`, ~`:258`); `colorValue` is never read for them
  (bg-color / bar-color already honor it).

**Reachability (line-family colorValue):** no script emits line-family
`colorValue` today — only `bgcolor()` / `barcolor()` pass a
`dynamicColor` through `plotImpl`; `plot()` does not (see Task 3's
Current Behavior). Requirement 3 is therefore **wire-level honesty**,
tested via **synthetic `PlotEmission`s** in the echarts unit tests; no
conformance scenario exercises it and the `plot-hash` conformance is
unaffected.

## Desired Behavior

- Alert conditions render as on-chart markers (the
  `canvas2d/render/alertConditions.ts` visual intent, expressed via
  echarts `graphic`).
- Logs render in a log pane/overlay (mirror
  `canvas2d/render/logPane.ts`, last N entries) via `graphic`.
- Line-family plots honor `colorValue` 3-state (omitted ⇒ static,
  present ⇒ override, `null` ⇒ gap), per Task 3's contract.

## Requirements

### 1. alertConditions rendering

Build a `graphic` overlay from `state.currentAlertConditions` each
frame (cleared + rebuilt per drain, matching the buffer semantics).
Match the canvas2d layout (badge/marker per active condition). Anchor
in the overlay pane. Cover the empty-list case (no graphic).

### 2. logs rendering

Build a `graphic` log-pane element from `state.recentLogs` (cap mirrors
canvas2d — last 5). Position consistently (e.g. bottom-left of the
overlay pane). Reuse the canvas2d `logPane` text layout intent.

### 3. line-family colorValue

Echarts line/area series take a single `lineStyle.color`, so honor
per-bar `colorValue` by **segment splitting** (Decision: segment-split,
NOT `visualMap` pieces — for one cross-adapter per-run contract + test
shape): emit consecutive same-color runs as separate line series
(mirrors the canvas2d per-run model and the LWC approach in Task 13),
with a `null` bar as a gap.

Resolve each bar's color as `colorValue === undefined ? plot.color :
colorValue`; `null` ⇒ no segment for that bar. Keep omitted-`colorValue`
output byte-identical to today (single series, existing tests hold).

### 4. Tests + docs + honesty

- alertConditions: a frame with active conditions emits markers; an
  empty frame emits none.
- logs: N log entries render N rows; cap respected.
- line colorValue: omitted ⇒ unchanged; present subset ⇒ per-run/per-
  point colors; `null` ⇒ gap.
- Update `examples/echarts-adapter/CLAUDE.md`: alert/log `graphic`
  rendering + the line-family colorValue strategy.
- Confirm `ECHARTS_CAPABILITIES` now matches reality (no declared-but-
  unrendered flag remains).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/createEChartsAdapter.ts` | Modify | alert/log `graphic`; line colorValue |
| `src/createEChartsAdapter.test.ts` | Modify | alert/log/colorValue tests |
| `examples/echarts-adapter/CLAUDE.md` | Modify | Alert/log + colorValue invariants |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (echarts 100% coverage)
- `pnpm conformance`
- `pnpm adapters:generate` + `pnpm adapters:gate`
- `pnpm docs:check`

## Changeset

`.changeset/echarts-alerts-logs-colorvalue.md` — private example
package (empty changeset).

## Acceptance Criteria

- alertConditions + logs render; capabilities are honest.
- Line-family `colorValue` honored 3-state; omitted path unchanged.
- 100% coverage; conformance + `adapters:gate` green; `CLAUDE.md`
  updated; changeset committed.
