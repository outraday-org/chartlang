# Task 12 — lightweight-charts: bg-color + alertConditions/logs + z

> **Status: TODO**

## Goal

Render the `bg-color` lightweight-charts currently no-ops, render the
`alertConditions` and `logs` it declares but buffers, and add
z-render-order (within LC's achievable stacking) via the shared sort.

## Prerequisites

Task 1 (shared sort); Task 11 (same LC file — land sequentially).

## Current Behavior

In `createLightweightChartsAdapter.ts`:

- `bg-color` is a documented no-op (`:573-577`) — LC's background is a
  single chart-layout option, not a per-bar band.
- `alertConditions` (`:617-620`) + `logs` (`:629-634`) buffer into
  state and never render; both declared `true` in `LWC_CAPABILITIES`
  (`capabilities.ts:77-78`).
- No `plot.z` / `drawing.z` read; LC paints native series, price lines,
  and the `DrawingPrimitive` overlay in fixed order.

## Desired Behavior

- `bg-color` paints per-bar background bands (honoring `transp` and
  `colorValue` 3-state) through the `DrawingPrimitive` canvas overlay
  (LC has no native per-bar bg, so use the same overlay the drawings
  use).
- alertConditions + logs render via the canvas overlay (mirror
  `canvas2d/render/alertConditions.ts` + `render/logPane.ts`).
- z-order: drawings + overlay-painted marks order by `(z ?? 0, band,
  seq)` via the shared sort; native series stacking is constrained by
  LC (document what is and isn't achievable — e.g. an overlay-painted
  drawing can sit visually above/below relative to other overlay marks,
  but native series order is LC-managed).

## Requirements

### 1. bg-color via overlay

Add a bg-color band store (keyed by bar time, like `barColors`) and
paint it in the `DrawingPrimitive` overlay's `paintInto` pass (the
overlay already has a canvas sink + viewport). Resolve the per-bar
color with the 3-state `colorValue` contract (omitted ⇒ `style.color`,
present ⇒ override, `null` ⇒ no band that bar) and apply `transp` as
opacity. Reuse the `uplot`/`canvas2d` `bgColor` painting intent. Remove
the documented no-op note from the file header + `CLAUDE.md`.

### 2. alertConditions + logs via overlay

Paint `state.currentAlertConditions` (rebuilt per drain) +
`state.recentLogs` (cap 5) in the overlay pass, always-on-top (after
drawings), matching canvas2d's v1 posture. Empty list ⇒ nothing.

### 3. z-order

Import `sortByRenderOrder` / `RENDER_BAND`. **Decision: best-effort
native-series ordering + documented constraint** (LC native series are
LC-managed and cannot be repainted — full draw-hook control is not an
option here). Order the overlay-painted marks (drawings + bg-color
bands, if treated as drawings) by the shared key; assign `seq` at
ingest. For native series (lines/candles/price lines), document the LC
stacking constraint — the shared sort governs the overlay layer;
native-series z is best-effort via series creation order. State the
residual limitation clearly in `CLAUDE.md` (this is the "implement where
the model allows; document the rest" reality for a native-time library,
consistent with the chosen full-rendering scope).

### 4. Tests + docs + honesty

- bg-color paints bands (3-state colorValue + transp); the prior no-op
  test is replaced.
- alertConditions + logs render (and empty case) via the overlay
  call-log.
- z: overlay marks order by the shared sort (a `z:-1` drawing below a
  `z:0` drawing/band).
- `LWC_CAPABILITIES` now backed by rendering for bg-color/
  alertConditions/logs.
- Update `examples/lightweight-charts-adapter/CLAUDE.md`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/createLightweightChartsAdapter.ts` | Modify | bg-color store; alert/log; z ordering |
| `src/drawingPrimitive.ts` | Modify | Paint bg-color bands + alert/log + z-sorted overlay |
| `src/createLightweightChartsAdapter.test.ts` | Modify | bg-color/alert/log/z tests |
| `examples/lightweight-charts-adapter/CLAUDE.md` | Modify | bg-color + alert/log + z invariants |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (lwc 100% coverage)
- `pnpm conformance`
- `pnpm adapters:generate` + `pnpm adapters:gate`
- `pnpm docs:check`

## Changeset

`.changeset/lwc-bgcolor-alerts-z.md` — private example package (empty
changeset).

## Acceptance Criteria

- bg-color renders (3-state colorValue + transp); alertConditions +
  logs render; overlay z-order via the shared sort; native-series
  constraint documented.
- 100% coverage; conformance + `adapters:gate` green; `CLAUDE.md`
  updated; changeset committed.
