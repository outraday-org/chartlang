# canvas2d candle / bar render + capabilities

> **Status: TODO**

## Goal

Render the `candle` and `ohlc-bar` plot styles in the reference
canvas2d adapter: two render functions, the emission-dispatch +
per-bar accumulation, the `Capabilities.plots` opt-in, and adapter
tests. This makes the feature end-to-end visible.

## Prerequisites

Task 4 (wire styles), Task 6 (runtime emits them).

## Current Behavior

`examples/canvas2d-adapter/src/` dispatches each `PlotEmission` on
`style.kind`. Overlay-style kinds (`candle-override`, `bar-override`,
markers) draw immediately; series-topology kinds (`line`, `area`,
`filled-band`) accumulate a per-bar `PlotPoint` and draw at flush.
`render/filledBand.ts` (`drawFilledBand`) + `createCanvas2dAdapter.ts`
(`renderFilledBandSeries`, ~lines 552-578, and the style-extract at
~lines 1005-1034) are the multi-value precedent.
`render/candleOverride.ts` shows OHLC→pixel projection. The adapter
declares supported kinds in `src/capabilities.ts`
(`CANVAS2D_PLOT_KINDS`, ~lines 24-41) — `"candle"` / `"ohlc-bar"` are
absent.

## Desired Behavior

A `plotcandle` series renders a full candle per bar (high-low wick, an
open-close body colored by `close ≥ open`, optional border); a
`plotbar` series renders an OHLC bar (vertical high-low line, left tick
= open, right tick = close). Both use the emission's own OHLC quad, not
the primary chart candles, so a derived series (Heikin-Ashi, HTF
overlay) is drawn correctly.

## Requirements

### 1. Render functions (`examples/canvas2d-adapter/src/render/`)

- `candle.ts` → `drawCandle(ctx, args, viewport)`. `args`: projected
  `{ x, open, high, low, close }` pixel coords + `{ bull, bear, doji,
  wickColor, borderColor }`. Draw the wick (`high`→`low` vertical line),
  then the body rect (`open`↔`close`), pick fill by `close > open` (bull)
  / `close < open` (bear) / `close === open` (doji ?? bull), enforce a
  minimum 1px body height (mirror `candleOverride.ts`'s
  `Math.max(1, …)`), stroke the border if `borderColor` set. A bar whose
  OHLC is all-`null` draws nothing.
- `ohlcBar.ts` → `drawOhlcBar(ctx, args, viewport)`. Vertical high-low
  line at `x`; a short left tick at `open`, right tick at `close`; color
  by `upColor`/`downColor` (fallback `color`) using `close ≥ open`.

Reuse the shared `timeToX` / `priceToY` / `projectShiftedX` helpers
from `render/coords.js` (the same imports `candleOverride.ts` /
`renderFilledBandSeries` use) — do not add parallel projection math.
Every exported symbol in these new files needs full JSDoc (`@since`,
stability marker, `@example`): `pnpm docs:check` walks
`examples/canvas2d-adapter/src` too.

### 2. Dispatch + accumulation (`createCanvas2dAdapter.ts` + `render/coords.ts`)

- Extend the `PlotPoint` type (`render/coords.ts:62-73`) with optional
  per-bar OHLC + color fields, exactly the way the optional
  `upper?` / `lower?` fields carry the filled-band channel today.
- In the style-extract (mirror the `filled-band` branch — lines
  1022-1024 spread `{ upper, lower }` into the accumulated point), add:
  `...(plot.style.kind === "candle" ? { open, high, low, close,
  bull, bear, doji, wickColor, borderColor } : {})` and the analogous
  `ohlc-bar` extract, into the accumulated `PlotPoint`.
- Add `renderCandleSeries` / `renderOhlcBarSeries` (mirror
  `renderFilledBandSeries`, ~line 552): for each accumulated point,
  project the quad to pixels and call `drawCandle` / `drawOhlcBar`.
  Candles/bars are drawn **per bar** (not connected), so — unlike
  filled-band — there is no polygon walk; just iterate and draw.
- Route `candle` / `ohlc-bar` to the series bucket (they own an
  x-per-bar topology), the way `filled-band` is routed, in the
  per-kind dispatch (`applyPlot`).

### 3. Capabilities (`examples/canvas2d-adapter/src/capabilities.ts`)

Add `"candle"` and `"ohlc-bar"` to `CANVAS2D_PLOT_KINDS`. This is the
adapter's opt-in; without it Task 6's runtime gate no-ops the plot.

### 4. CLI adapter embed regen (`pnpm adapters:generate`)

The CLI embeds a generated copy of every example adapter
(`scripts/gen-adapters.ts` → `packages/cli/src/generated/adapters/`);
`pnpm adapters:gate` byte-diffs it in CI. After the src changes, run
`pnpm adapters:generate` and commit the regenerated embed — a src-only
change here otherwise fails the gate (and the stale CLI copy is caught
only by `test:scripts`).

### 5. Tests (`examples/canvas2d-adapter/src/**/*.test.ts`)

- Unit-test `drawCandle` / `drawOhlcBar` against `MockCanvas2DContext`
  (from `src/testing.ts`; mirror the `candleOverride` / `filledBand`
  render tests): assert the fill color chosen for bull / bear / doji,
  the min-body-height clamp (`Math.max(1, …)`, the `candleOverride.ts:58`
  precedent), wick + border stroke calls, and that an all-`null` bar
  issues no draw calls.
- Integration: run a small `plotcandle` script through the adapter and
  assert the accumulated series projects to the expected draw-call
  sequence (mirror the existing `filled-band` integration test).
- Capability: with `"candle"` present the plot renders; confirm the
  adapter still type-checks against the `Capabilities` contract.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/canvas2d-adapter/src/render/candle.ts` (+ test) | Create | `drawCandle` |
| `examples/canvas2d-adapter/src/render/ohlcBar.ts` (+ test) | Create | `drawOhlcBar` |
| `examples/canvas2d-adapter/src/render/coords.ts` | Modify | optional OHLC/color fields on `PlotPoint` |
| `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` | Modify | extract + `renderCandleSeries`/`renderOhlcBarSeries` + dispatch |
| `examples/canvas2d-adapter/src/capabilities.ts` | Modify | add 2 `PlotKind`s to `CANVAS2D_PLOT_KINDS` |
| `packages/cli/src/generated/adapters/**` | Generate | `pnpm adapters:generate` (CLI embed) |
| `examples/canvas2d-adapter/src/**/*.test.ts` | Modify/Create | render + integration + capability tests |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (adapter 100% coverage — bull/bear/doji, min-body, null
  bar, border on/off, up/down bar)
- `pnpm docs:check` (new exported render fns carry full JSDoc)
- `pnpm adapters:gate` (regenerated CLI embed committed)
- `pnpm conformance` (Task 8 adds the scenario; keep the suite green)

## Changeset

`.changeset/canvas2d-candle-render.md` — the adapter package is the
**private** `chartlang-example-canvas2d-adapter`; follow the repo
convention for it (see `.changeset/canvas2d-line-colorvalue.md` in git
history): an **empty-frontmatter** changeset (`---` / `---`, no package
bump) whose body describes the change. Body: "Render `candle` /
`ohlc-bar` custom OHLC series in the canvas2d reference adapter."

## Acceptance Criteria

- `drawCandle` / `drawOhlcBar` render from the emission's own OHLC quad
  using the shared projection helpers (no parallel math).
- `candle` / `ohlc-bar` are accumulated + dispatched like `filled-band`
  (per-bar draw, not a connected polygon); capability opt-in added.
- Color selection (bull/bear/doji, up/down), min-body clamp, border,
  and all-null gap are unit-covered; integration test passes.
- CLI adapter embed regenerated + committed (`pnpm adapters:gate`
  green).
- Adapter coverage 100%; empty-frontmatter changeset committed.
