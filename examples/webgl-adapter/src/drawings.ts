// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Drawing -> DrawPrimitive mapping for the 2D text overlay. PURE: it reuses the
// SHARED `decomposeDrawing` (adapter-kit geometry layer) to reduce every live
// `draw.*` emission to a flat `DrawPrimitive[]` (polyline / arc / text /
// marker), exactly like canvas2d / uplot / lightweight-charts — the webgl
// adapter NEVER re-derives per-kind drawing geometry. The overlay paints the
// result with the SHARED `paintPrimitive` sink (`overlay.paintDrawings`), so
// arcs / fills / text / markers render natively with no GL tessellation. The
// projection is the SAME overlay-pane pixel `Viewport` the glyph anchors use
// (`paneViewportFromInfo`) — ONE projection source of truth per frame.

import {
    type DrawPrimitive,
    type Viewport,
    decomposeDrawing,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";

import type { AxisRenderInfo } from "./axes.js";
import { paneViewportFromInfo } from "./glyphs.js";
import { BAND, type RenderOrderMark, applyRenderOrder } from "./renderOrder.js";
import type { AdapterState } from "./state.js";

// Bar TIME at a (possibly fractional / out-of-range) bar SLOT — the inverse of
// the compressed slot→bar mapping the GL geometry uses. Interior slots
// interpolate between adjacent bar times; a slot past either data edge
// extrapolates with that edge's spacing, so a `+k` future / far-past drawing
// anchor still projects onto the slot axis. Callers guarantee `bars.length >= 2`.
function slotAnchorTime(bars: ReadonlyArray<Bar>, slot: number): number {
    const last = bars.length - 1;
    if (slot <= 0) return bars[0].time + slot * (bars[1].time - bars[0].time);
    if (slot >= last) {
        return bars[last].time + (slot - last) * (bars[last].time - bars[last - 1].time);
    }
    const i = Math.floor(slot);
    return bars[i].time + (slot - i) * (bars[i + 1].time - bars[i].time);
}

// The overlay-pane drawing viewport. The GL geometry, glyph anchors, and
// override bands all use the COMPRESSED bar SLOT (index) as world x, but the
// SHARED `decomposeDrawing` projects each drawing's bar-TIME anchors. So re-base
// the slot-space viewport's x bounds to the bar TIME at the window's slot edges
// (`slotAnchorTime`, the inverse of the bar→slot mapping): a drawing anchored at
// a bar's time then lands on the SAME pixel as that bar's candle, for ANY
// spacing. y / pxWidth / pxHeight (the slot-space projection) are unchanged.
function drawingViewport(state: AdapterState, info: AxisRenderInfo): Viewport {
    const vp = paneViewportFromInfo(info);
    const bars = state.bars;
    if (bars.length < 2) return vp;
    return { ...vp, xMin: slotAnchorTime(bars, vp.xMin), xMax: slotAnchorTime(bars, vp.xMax) };
}

/**
 * Reduce every live drawing in `state` to a flat, pixel-space
 * {@link DrawPrimitive} list for the overlay pane, ordered by each drawing's
 * `(z, seq)` (ingest order via `state.drawingSeq`). The pixel projection is the
 * overlay pane's {@link import("./glyphs.js").paneViewportFromInfo} `Viewport`
 * — the SAME one the glyph / badge anchors use, so drawings, glyphs, and axis
 * labels share ONE projection source of truth per frame. Each drawing reduces
 * through the SHARED `decomposeDrawing` (the adapter-kit contract — never
 * forked), so all 63 kinds map to the four primitive shapes the overlay's
 * `paintPrimitive` sink paints.
 *
 * `op:"remove"` drawings never reach here — `applyDrawing` deletes them from
 * `state.drawings` at ingest, so this iterates only live drawings. The overlay
 * pane's CSS origin is `(0, 0)` (it is `paneOrder` index 0, the top band), so
 * the origin-relative pixel coordinates `decomposeDrawing` returns need no
 * `cssRect.{x,y}` offset (drawings are overlay-pane only, like the glyphs).
 *
 * Pure — no `ctx`, no DOM, no GL — so the mapping is node-unit-tested.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { createAdapterState } from "chartlang-example-webgl-adapter";
 *     import { drawingPrimitives } from "chartlang-example-webgl-adapter";
 *     const state = createAdapterState();
 *     const prims = drawingPrimitives(state, {
 *         paneKey: "overlay",
 *         cssRect: { x: 0, y: 0, width: 800, height: 400 },
 *         window: { xMin: 0, xMax: 100, yMin: 1, yMax: 2 },
 *         ticks: { priceTicks: [], timeTicks: [] },
 *     });
 *     // prims.length === 0 (no drawings)
 *     void prims;
 */
export function drawingPrimitives(
    state: AdapterState,
    info: AxisRenderInfo,
): ReadonlyArray<DrawPrimitive> {
    if (state.drawings.size === 0) return [];
    const viewport = drawingViewport(state, info);
    // Order drawings through the SHARED `applyRenderOrder` (never a local
    // comparator) tagged `(z, drawing-band, seq)`, so a per-drawing `z` override
    // reorders the drawing band — parity with canvas2d's `collectSortableMarks`.
    // At the default `z = 0` this reduces to ingest order (`drawingSeq`).
    const marks: RenderOrderMark<string>[] = [];
    for (const [handleId, drawing] of state.drawings) {
        marks.push({
            z: drawing.z ?? 0,
            band: BAND.drawing,
            seq: state.drawingSeq.get(handleId) ?? 0,
            payload: handleId,
        });
    }
    const ordered = applyRenderOrder(marks);
    const prims: DrawPrimitive[] = [];
    for (const handleId of ordered) {
        // `state.drawings` and `state.drawingSeq` are written in lockstep by
        // `applyDrawing`, so the entry is always present.
        const drawing = state.drawings.get(handleId);
        /* v8 ignore next -- lockstep with state.drawings; guard never taken */
        if (drawing === undefined) continue;
        prims.push(...decomposeDrawing(drawing, viewport));
    }
    return prims;
}
