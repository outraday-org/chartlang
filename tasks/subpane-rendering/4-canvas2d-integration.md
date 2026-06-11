# Task 4 — Canvas2d adapter pane integration (state + viewport + render walk)

> **Status: TODO**

## Goal

Wire the Task-3 layout helpers into `createCanvas2dAdapter.ts`:
make `AdapterState` pane-aware, replace the single global viewport
with per-pane viewports, and rewrite the render loop to walk
panes. Bars render in the price pane only; subpane plot points
and hlines render on their own y-scale inside their pane rect.

## Prerequisites

Task 3 (pane-layout helpers exist and pass their own tests).

## Current Behavior

- `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts:113-126` —
  `AdapterState` carries flat-keyed `plotSeries: Map<string,
  PlotPoint[]>` (by slotId only), `plotSeriesStyle`, `hlines: Map<
  string, HLine>` — no pane information.
- `computeViewport` (lines 146-188) builds **one** viewport from
  bars ∪ every plotSeries point — RSI in 0-100 expands the y-range.
- `applyPlot` (lines 377-399) writes by `plot.slotId` only; the
  emission's `pane` field is discarded.
- `renderFrame` (lines 338-375) clears once, draws bars, walks
  every `plotSeries` entry in the single viewport.

## Desired Behavior

- `AdapterState`:
  - `paneOrder: string[]` — distinct pane keys in first-emit order;
    `"overlay"` always at index 0.
  - `plotSeries: Map<string, PlotPoint[]>` keyed by
    `${paneKey}|${slotId}`.
  - `plotSeriesStyle: Map<string, PlotStyle>` same composite key.
  - `hlines: Map<string, HLine>` where `HLine` gains
    `paneKey: string`. Map key stays `slotId`.
- `applyPlot` reads `plot.pane`, registers the pane key on first
  sight, and routes the emission into the right bucket.
- `renderFrame` walks `computePaneLayout(state.paneOrder,
  state.canvas)`. Per pane:
  1. Compute the per-pane viewport.
  2. `clearPaneRect`.
  3. Translate the canvas by `rect.y`, draw the pane's content,
     untranslate. (Bars and overlay glyphs only in the overlay
     pane; plots / hlines per pane; drawings overlay-only.)
  4. For subpanes, draw the separator at the top.
- Empty bars + subpane plots keep the existing empty-bars guard
  for the overlay pane; subpane viewports use their own y-range.

## Requirements

### 1. `createCanvas2dAdapter.ts` — state shape

Update the `AdapterState` declaration block (lines 113-126):

```ts
type HLine = {
    readonly price: number;
    readonly color: string | null;
    readonly lineWidth: number;
    readonly lineStyle: LineStyle;
    readonly paneKey: string; // NEW
};

type AdapterState = {
    readonly ctx: RenderCtx;
    readonly canvas: { width: number; height: number };
    readonly bars: Bar[];
    paneOrder: string[]; // NEW — mutable; ["overlay", ...]
    readonly plotSeries: Map<string, PlotPoint[]>; // keyed `${pane}|${slot}`
    readonly plotSeriesStyle: Map<string, PlotStyle>; // same key
    readonly plotOverlays: Map<string, PlotEmission>;
    readonly hlines: Map<string, HLine>; // keyed by slotId; carries paneKey
    readonly recentAlerts: AlertEmission[];
    readonly currentAlertConditions: AlertConditionEmission[];
    readonly recentLogs: LogEmission[];
    readonly drawings: Map<string, DrawingEmission>;
    readonly palette: Palette;
};
```

Initialise `paneOrder: ["overlay"]` in the state-init block
(~line 510). On `dispose` (line 554), reset
`state.paneOrder = ["overlay"]` along with the existing `Map.clear`
calls.

### 2. `createCanvas2dAdapter.ts` — composite key helper (file-private)

Add near the other helpers:

```ts
function paneSlotKey(paneKey: string, slotId: string): string {
    return `${paneKey}|${slotId}`;
}

function isOverlayKey(key: string): boolean {
    return key.startsWith("overlay|");
}
```

### 3. `createCanvas2dAdapter.ts` — `applyPlot` rewrite

Replace the existing `applyPlot` body (lines 377-399):

```ts
function applyPlot(state: AdapterState, plot: PlotEmission): void {
    const paneKey = plot.pane;
    if (paneKey !== "overlay" && !state.paneOrder.includes(paneKey)) {
        state.paneOrder.push(paneKey);
    }
    if (
        plot.style.kind === "line" ||
        plot.style.kind === "step-line" ||
        plot.style.kind === "histogram"
    ) {
        const key = paneSlotKey(paneKey, plot.slotId);
        const series = state.plotSeries.get(key) ?? [];
        series.push({ time: plot.time, value: plot.value, color: plot.color });
        state.plotSeries.set(key, series);
        state.plotSeriesStyle.set(key, plot.style);
        return;
    }
    if (plot.style.kind === "horizontal-line") {
        state.hlines.set(plot.slotId, {
            price: plot.value ?? 0,
            color: plot.color,
            lineWidth: plot.style.lineWidth,
            lineStyle: plot.style.lineStyle,
            paneKey,
        });
        return;
    }
    state.plotOverlays.set(plot.slotId, plot);
}
```

### 4. `createCanvas2dAdapter.ts` — per-pane viewport

Rename `computeViewport` to `computePaneViewport(state, paneEntry:
PaneLayoutEntry) => Viewport`. Body:

```ts
function computePaneViewport(
    state: AdapterState,
    entry: PaneLayoutEntry,
): Viewport {
    const { bars } = state;
    const { rect, paneKey } = entry;
    if (bars.length === 0) {
        return {
            xMin: 0, xMax: 1, yMin: 0, yMax: 1,
            pxWidth: rect.w, pxHeight: rect.h,
        };
    }
    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    for (const bar of bars) {
        if (bar.time < xMin) xMin = bar.time;
        if (bar.time > xMax) xMax = bar.time;
    }

    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    if (paneKey === "overlay") {
        for (const bar of bars) {
            if (bar.low < yMin) yMin = bar.low;
            if (bar.high > yMax) yMax = bar.high;
        }
    }
    for (const [key, series] of state.plotSeries) {
        if (!key.startsWith(`${paneKey}|`)) continue;
        for (const point of series) {
            if (point.value === null) continue;
            if (point.value < yMin) yMin = point.value;
            if (point.value > yMax) yMax = point.value;
        }
    }
    for (const hline of state.hlines.values()) {
        if (hline.paneKey !== paneKey) continue;
        if (hline.price < yMin) yMin = hline.price;
        if (hline.price > yMax) yMax = hline.price;
    }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
        yMin = 0;
        yMax = 1;
    } else if (yMin === yMax) {
        yMin -= 1;
        yMax += 1;
    }
    const yPad = (yMax - yMin) * Y_AXIS_PADDING;
    return {
        xMin,
        xMax: xMax === xMin ? xMin + 1 : xMax,
        yMin: yMin - yPad,
        yMax: yMax + yPad,
        pxWidth: rect.w,
        pxHeight: rect.h,
    };
}
```

### 5. `createCanvas2dAdapter.ts` — `renderFrame` rewrite

Replace the body (lines 338-375). The translate-per-pane discipline
keeps the pure `render/<kind>.ts` helpers untouched — they emit y
coordinates relative to `viewport.pxHeight`, and the wrapper
adds `rect.y` via `ctx.translate`:

```ts
function renderFrame(state: AdapterState): void {
    const layout = computePaneLayout(state.paneOrder, state.canvas);

    for (const entry of layout) {
        const viewport = computePaneViewport(state, entry);
        clearPaneRect(state.ctx, entry.rect, state.palette);
        state.ctx.save();
        state.ctx.translate(0, entry.rect.y);

        if (entry.paneKey === "overlay") {
            renderBackgroundOverlays(state, viewport);
            drawCandles(state.ctx, state.bars, viewport, state.palette);
            renderBarOverlays(state, viewport);
        }
        for (const [key, series] of state.plotSeries) {
            if (!key.startsWith(`${entry.paneKey}|`)) continue;
            const style = state.plotSeriesStyle.get(key);
            if (style !== undefined && style.kind === "histogram") {
                renderHistogramSeries(state.ctx, series, style.baseline, viewport, state.palette);
                continue;
            }
            drawLine(state.ctx, series, viewport, state.palette);
        }
        if (entry.paneKey === "overlay") renderGlyphOverlays(state, viewport);
        for (const hline of state.hlines.values()) {
            if (hline.paneKey !== entry.paneKey) continue;
            drawHorizontalLine(state.ctx, hline, viewport, state.palette);
        }

        state.ctx.restore();
        if (entry.paneKey !== "overlay") {
            drawPaneSeparator(state.ctx, entry.rect, state.palette);
        }
    }

    // Phase-3 drawings + alerts + alert conditions + logs are
    // overlay-bound. Rewrap with save/translate(0, overlay.rect.y)
    // and call the existing drawingDispatch / drawAlertBadge /
    // drawAlertConditions / drawLogPane blocks (unchanged from the
    // current renderFrame tail at lines 356-374, just moved inside
    // the overlay-translate wrapper).
}
```

The overlay-bound tail (drawings + alerts + alert conditions +
log pane) is **moved inside a single `save / translate(0,
overlay.rect.y) / restore` wrapper** but otherwise unchanged — the
implementer copies the existing lines 356-374 verbatim into that
wrapper.

### 6. `createCanvas2dAdapter.test.ts` — new pane-routing assertions

Add tests:

- **overlay-only mount keeps single pane:** EMA-cross-style bundle
  emits no subpane entries — `state.paneOrder.length === 1` and
  `state.paneOrder[0] === "overlay"`.
- **subpane key registration:** an emission with `pane:
  "script:rsi"` adds `"script:rsi"` to `state.paneOrder` once;
  repeated emissions don't duplicate the entry.
- **composite-key buckets:** an emission with `slotId: "x:1:1#0"`
  and `pane: "script:rsi"` lands in `state.plotSeries.get(
  "script:rsi|x:1:1#0")`; the overlay-key bucket
  (`"overlay|x:1:1#0"`) is empty.
- **price y-scale independence:** craft a state where bars span
  `[100, 110]` and a subpane has values `[0, 100]`; assert the
  overlay viewport's `yMax` is ≤ 110 + padding (i.e. the subpane
  series does not expand the price y-range). Use the overlay
  pane entry from `computePaneLayout`.
- **subpane hline routing:** an `hline` with `pane: "rsi"` has
  `state.hlines.get(slotId).paneKey === "rsi"` and the hline
  appears in the subpane's viewport y-range calculation.
- **dispose resets paneOrder:** after `dispose`, `state.paneOrder
  === ["overlay"]`.

Match the file's existing test style (mock canvas, structural
state assertions, no actual pixel inspection).

### 7. `createCanvas2dAdapter.ts` — render-helper imports

Imports at top of file should include:

```ts
import {
    computePaneLayout,
    type PaneLayoutEntry,
    clearPaneRect,
    drawPaneSeparator,
} from "./render/index.js";
```

(The Task-3 re-exports.)

### 8. `integration.test.ts` — re-pin overlay-only hash

The EMA-cross bundle has zero subpanes; `computePaneLayout`
returns one entry covering the full canvas. The new render loop
adds `save` / `translate(0, 0)` / `restore` pairs around the
overlay pane block + the drawings/alerts block, and swaps `clear`
→ `clearPaneRect`. Investigate the call-log delta first; the only
expected differences are these added records and the
clear→clearPaneRect swap. Re-pin the hash and reference the delta
in the commit message: "pane layout refactor — call log shape
changed (save/translate/restore + clearPaneRect); behaviour
unchanged for overlay-only scripts."

### 9. `MockCanvas2DContext` extensions if needed

Verify `save` / `restore` / `translate` are in the mock's
`RecordedCall` union (`grep "translate\|save\b\|restore"
examples/canvas2d-adapter/src/testing.ts`). If absent: add the
records + canonicalisation rules, extend `testing.test.ts` per
method, ensure `hashCallLog` hashes the new records (existing
convention is unconditional). This is a direct prerequisite of the
render-loop change so it lands in the same task.

### 10. `examples/canvas2d-adapter/README.md`

Add a paragraph under "Phase 2 invariants":

> **Pane-aware state shape.** `AdapterState.plotSeries` is keyed by
> `${paneKey}|${slotId}` composite strings. `paneOrder` is always
> `["overlay", ...subpaneKeysInFirstEmitOrder]`. The render loop
> walks `computePaneLayout(state.paneOrder, state.canvas)` and
> draws each pane inside its rect via `ctx.save();
> ctx.translate(0, rect.y); ...; ctx.restore()` — pure
> `render/<kind>.ts` helpers continue to emit y coordinates
> relative to `viewport.pxHeight`.

Stay under the 100-line cap.

### Edge cases

- **`PlotEmission.pane` from synthetic test feeds** — host tests
  may bypass the runtime. The wire type already requires `pane`, so
  no defaulting is needed in the adapter.
- **Empty subpane** — a pane key that was registered but has no
  current emissions (all `value === null`) — viewport falls back
  to `(0, 1)` per the `!isFinite` guard.
- **Histogram baseline in a subpane** — `priceToY(baseline,
  viewport)` is called against the subpane viewport (the
  histogram helper already takes a viewport; the per-pane viewport
  is passed in by the render-loop walk). No special-casing needed.
- **Drawings in subpanes** — explicitly out of scope; all drawings
  render against the overlay viewport (documented in the README).
  Pane-routed drawings are deferred (see README's "Deferred"
  section).
- **`drawHorizontalLine` x-range** — the helper currently draws
  across the full `viewport.pxWidth`; subpane rects share the
  canvas width with overlay (`rect.w === canvas.width`), so the
  line spans the subpane's full width correctly.
- **Coverage gate** — `computePaneViewport` has branches for
  `bars.length === 0`, `paneKey === "overlay"` vs subpane, finite
  vs non-finite y-range, and degenerate `xMin === xMax`. The new
  test cases exercise each.
- **§16.3 test layers** — the adapter's existing unit + integration
  layers cover the changes; no property test required (the routing
  is deterministic and small-state). The bench layer is unchanged.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` | Modify | Pane-aware state, `applyPlot`, `computePaneViewport`, `renderFrame` |
| `examples/canvas2d-adapter/src/createCanvas2dAdapter.test.ts` | Modify | Pane-routing assertions |
| `examples/canvas2d-adapter/src/integration.test.ts` | Modify | Re-pin overlay-only hash with commit-note rationale |
| `examples/canvas2d-adapter/src/testing.ts` | Modify (if needed) | `save` / `restore` / `translate` mock support |
| `examples/canvas2d-adapter/src/testing.test.ts` | Modify (if needed) | Cover new mock methods |
| `examples/canvas2d-adapter/README.md` | Modify | Document pane-aware state shape |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F chartlang-example-canvas2d-adapter test` (coverage 100%)
- `pnpm docs:check`
- `pnpm readme:check`
- `pnpm conformance` — must stay green (RSI scenario carve-out
  removal happens in Task 5).

## Changeset

`.changeset/subpane-4-canvas2d-integration.md` — private package,
unscoped entry only.

## Acceptance Criteria

- `AdapterState.paneOrder` is initialised to `["overlay"]` and
  grows on first-seen non-overlay pane; reset on `dispose`.
- `applyPlot` routes via composite `${paneKey}|${slotId}` keys.
- `computePaneViewport` produces an independent y-scale per pane;
  the overlay pane's `yMax` is unaffected by a 0-100 subpane plot.
- `renderFrame` walks `computePaneLayout` and uses
  `ctx.save/translate/restore` around each pane's draw block.
- Subpane plots and hlines render inside their rect; the separator
  line is drawn between the price pane and the first subpane.
- `MockCanvas2DContext` records `save` / `restore` / `translate`
  (added if previously missing).
- The integration test's hash is either unchanged or intentionally
  re-pinned with a commit-message note documenting the call-log
  delta (added save/translate/restore + clear→clearPaneRect).
- Coverage stays at 100%.
- `pnpm docs:check` / `pnpm readme:check` / `pnpm conformance`
  green.
- Changeset committed.
