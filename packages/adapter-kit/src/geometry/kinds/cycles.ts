// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Cycle geometry moved from the canvas2d adapter's per-kind renderers
//   examples/canvas2d-adapter/src/render/draw/{cyclicLines,timeCycles,
//   sineLine}.ts.
// The originating math is invinite's cyclic-lines / time-cycles /
// sine-line tools (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02,
// © Invinite); re-licensed MIT for chartlang.

import type {
    CyclicLinesState,
    SineLineState,
    TimeCyclesState,
} from "@invinite-org/chartlang-core";

import { strokeOf } from "../_lib/strokeStyle.js";
import { worldPointToPixel } from "../project.js";
import type { DrawPrimitive, Viewport } from "../types.js";

const DEFAULT_COLOR = "#0ea5e9";
const CYCLIC_MAX_REPEATS = 256;
const TIME_CYCLES_MAX_REPEATS_PER_SIDE = 64;
const SINE_SAMPLES_PER_PERIOD = 32;
const VIEWPORT_PAD_PX = 16;

/**
 * Decompose a `cyclic-lines` drawing — repeated full-height vertical
 * lines spaced at `periodPx = |toX − fromX|` to the right of the `from`
 * anchor. Returns `[]` when the period is non-positive or non-finite;
 * caps at 256 repeats, breaking past the right edge and skipping strokes
 * left of the viewport (matching the source).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: CyclicLinesState;
 *     declare const v: Viewport;
 *     const prims = decomposeCyclicLines(s, v);
 *     void prims;
 */
export function decomposeCyclicLines(
    state: CyclicLinesState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const fromPx = worldPointToPixel(state.anchors[0], view);
    const toPx = worldPointToPixel(state.anchors[1], view);
    const periodPx = Math.abs(toPx.x - fromPx.x);
    if (!Number.isFinite(periodPx) || periodPx <= 0) return [];
    const stroke = strokeOf(state.style, DEFAULT_COLOR);
    const out: DrawPrimitive[] = [];
    for (let k = 0; k < CYCLIC_MAX_REPEATS; k++) {
        const x = fromPx.x + k * periodPx;
        if (x > view.pxWidth + 16) break;
        if (x < -16) continue;
        out.push({
            kind: "polyline",
            points: [
                { x, y: 0 },
                { x, y: view.pxHeight },
            ],
            closed: false,
            stroke,
        });
    }
    return out;
}

/**
 * Decompose a `time-cycles` drawing — concentric upper-half arcs centred
 * at the midpoint of `(from, to)` on the `from.price` baseline, radius
 * `|toX − fromX| / 2`, tiled across the viewport at multiples of the
 * diameter. Returns `[]` when the diameter is non-positive or non-finite.
 * Each arc spans `[π, 2π]` (upper half).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: TimeCyclesState;
 *     declare const v: Viewport;
 *     const prims = decomposeTimeCycles(s, v);
 *     void prims;
 */
export function decomposeTimeCycles(
    state: TimeCyclesState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const fromPx = worldPointToPixel(state.anchors[0], view);
    const toPx = worldPointToPixel(state.anchors[1], view);
    const diameter = Math.abs(toPx.x - fromPx.x);
    if (!Number.isFinite(diameter) || diameter <= 0) return [];
    const radius = diameter / 2;
    const baselineY = fromPx.y;
    const primaryCx = (fromPx.x + toPx.x) / 2;
    const stroke = strokeOf(state.style, DEFAULT_COLOR);
    const out: DrawPrimitive[] = [];
    const pushArc = (cx: number): void => {
        out.push({
            kind: "arc",
            cx,
            cy: baselineY,
            r: radius,
            start: Math.PI,
            end: 2 * Math.PI,
            closed: false,
            stroke,
        });
    };
    pushArc(primaryCx);
    for (let k = 1; k < TIME_CYCLES_MAX_REPEATS_PER_SIDE; k++) {
        const cx = primaryCx + k * diameter;
        if (cx - radius > view.pxWidth + 16) {
            pushArc(cx);
            break;
        }
        pushArc(cx);
    }
    for (let k = 1; k < TIME_CYCLES_MAX_REPEATS_PER_SIDE; k++) {
        const cx = primaryCx - k * diameter;
        if (cx + radius < -16) {
            pushArc(cx);
            break;
        }
        pushArc(cx);
    }
    return out;
}

/**
 * Decompose a `sine-line` drawing — one sampled sinusoidal polyline. The
 * half-period is `|toX − fromX|`; baseline is the midpoint of
 * `(fromY, toY)`; amplitude is half the y-distance between anchors. The
 * wave starts at the extreme nearest `from` (sign `peakAtFrom`), sampled
 * 32 points per full period across the padded viewport. Returns `[]`
 * when the half-period is non-positive or non-finite.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: SineLineState;
 *     declare const v: Viewport;
 *     const prims = decomposeSineLine(s, v);
 *     void prims;
 */
export function decomposeSineLine(
    state: SineLineState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const fromPx = worldPointToPixel(state.anchors[0], view);
    const toPx = worldPointToPixel(state.anchors[1], view);
    const halfPeriodPx = Math.abs(toPx.x - fromPx.x);
    if (!Number.isFinite(halfPeriodPx) || halfPeriodPx <= 0) return [];
    const fullPeriodPx = 2 * halfPeriodPx;
    const baselineY = (fromPx.y + toPx.y) / 2;
    const amplitudePx = Math.abs(fromPx.y - toPx.y) / 2;
    const peakAtFrom = fromPx.y < toPx.y ? 1 : -1;
    const sampleY = (x: number): number => {
        const phase = (2 * Math.PI * (x - fromPx.x)) / fullPeriodPx;
        return baselineY - peakAtFrom * amplitudePx * Math.cos(phase);
    };
    const xMin = -VIEWPORT_PAD_PX;
    const xMax = view.pxWidth + VIEWPORT_PAD_PX;
    const stepPx = fullPeriodPx / SINE_SAMPLES_PER_PERIOD;
    const sampleCount = Math.max(2, Math.ceil((xMax - xMin) / stepPx) + 1);
    const points = [{ x: xMin, y: sampleY(xMin) }];
    for (let i = 1; i < sampleCount; i++) {
        const x = xMin + i * stepPx;
        points.push({ x, y: sampleY(x) });
    }
    return [
        { kind: "polyline", points, closed: false, stroke: strokeOf(state.style, DEFAULT_COLOR) },
    ];
}
