// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Spiral + cubic-Bezier approximation ported from
//   invinite/src/components/trading-chart/tools/fib-spiral-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { FibSpiralState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";
import { sampleCubic, type Point2 } from "./bezier.js";
import { worldPointToCanvas } from "./worldToCanvas.js";

const DEFAULT_COLOR = "#facc15";
const DEFAULT_LINE_WIDTH = 1;
// Number of quarter-turns sampled = 8 → 2 full rotations.
const QUARTERS = 8;
// Samples per quarter for the cubic Bezier approximation.
const SAMPLES_PER_QUARTER = 16;
// φ ≈ 1.618. Each quarter scales the spiral radius by 1/φ inward (per
// the classical golden spiral construction).
const PHI = (1 + Math.sqrt(5)) / 2;
// Classical Bezier-arc factor for a 90° quadrant: k = 4(√2 − 1)/3.
const K = (4 * (Math.sqrt(2) - 1)) / 3;

/**
 * Render a `fib-spiral` drawing emission as a chained cubic-Bezier
 * approximation of a golden spiral. Each quarter-turn is one cubic
 * Bezier with the classical `k ≈ 0.5523` arc factor; the spiral radius
 * shrinks by 1/φ per quarter (φ ≈ 1.618). Centre = `anchors[0]`; the
 * initial radius is `|anchors[1] − anchors[0]|` in canvas space. Always
 * clockwise (the invinite `counterClockwise` flag is deferred — see
 * `tasks/phase-3-drawing-parity/12-fibonacci-b.plan.md` §2).
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderFibSpiral(ctx, e, view);
 *     void renderFibSpiral;
 */
export function renderFibSpiral(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as FibSpiralState;
    const centre = worldPointToCanvas(state.anchors[0], view);
    const edge = worldPointToCanvas(state.anchors[1], view);
    const color = state.style.color ?? DEFAULT_COLOR;
    let r = Math.hypot(edge.x - centre.x, edge.y - centre.y);
    if (r === 0) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = DEFAULT_LINE_WIDTH;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(centre.x + r, centre.y);
    // Sweep clockwise. Each quarter rotates the start tangent by π/2.
    for (let q = 0; q < QUARTERS; q++) {
        const baseAngle = q * (Math.PI / 2);
        const r1 = r;
        const r2 = r / PHI;
        const cos0 = Math.cos(baseAngle);
        const sin0 = Math.sin(baseAngle);
        const cos1 = Math.cos(baseAngle + Math.PI / 2);
        const sin1 = Math.sin(baseAngle + Math.PI / 2);
        const p0: Point2 = { x: centre.x + r1 * cos0, y: centre.y + r1 * sin0 };
        const p3: Point2 = { x: centre.x + r2 * cos1, y: centre.y + r2 * sin1 };
        // Tangent at p0 is perpendicular-clockwise to (cos0, sin0).
        const p1: Point2 = {
            x: p0.x + K * r1 * cos1,
            y: p0.y + K * r1 * sin1,
        };
        // Tangent at p3 points back toward p0's direction (rotated 90°
        // further); scale by k * r2.
        const p2: Point2 = {
            x: p3.x + K * r2 * cos0,
            y: p3.y + K * r2 * sin0,
        };
        const pts = sampleCubic(p0, p1, p2, p3, SAMPLES_PER_QUARTER);
        // Skip the first point (it's the previous quarter's endpoint /
        // the initial moveTo).
        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
        r = r2;
    }
    ctx.stroke();
}
