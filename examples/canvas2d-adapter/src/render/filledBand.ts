// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette";
import type { RenderCtx } from "./clear";

/**
 * One side of a filled band — `y` is `null` to mark a per-bar gap (no
 * value at this `x`). `x` is the world-space CSS-pixel coordinate
 * the caller derives via `timeToX`.
 *
 * @since 0.2
 * @experimental
 * @example
 *     const p: BandPoint = { x: 100, y: 50 };
 *     const gap: BandPoint = { x: 110, y: null };
 *     void p; void gap;
 */
export type BandPoint = {
    readonly x: number;
    readonly y: number | null;
};

/**
 * Inputs for {@link drawFilledBand}. `upper` and `lower` carry the
 * two boundary polylines in the same `x` order (consumers should pass
 * matched-length arrays — the renderer iterates `upper` left-to-right
 * and `lower` right-to-left).
 *
 * @since 0.2
 * @experimental
 * @example
 *     const args: FilledBandArgs = {
 *         upper: [{ x: 0, y: 50 }, { x: 10, y: 60 }],
 *         lower: [{ x: 0, y: 40 }, { x: 10, y: 45 }],
 *         color: "#26a69a", alpha: 0.2,
 *     };
 *     void args;
 */
export type FilledBandArgs = {
    readonly upper: ReadonlyArray<BandPoint>;
    readonly lower: ReadonlyArray<BandPoint>;
    readonly color: string | null;
    readonly alpha: number;
};

type ResolvedBandPoint = { readonly x: number; readonly y: number };

function isFiniteBandPoint(p: BandPoint): p is ResolvedBandPoint {
    return p.y !== null && Number.isFinite(p.y);
}

/**
 * Render a filled band between two polylines. Returns early if either
 * boundary has no finite point in common. The fill uses the band's
 * `color` (falling back to `palette.plotDefault`) at the supplied
 * `alpha`; `globalAlpha` is reset to `1` before returning so
 * downstream draws are unaffected.
 *
 * The renderer walks `upper` left-to-right and `lower` right-to-left
 * inside a single `beginPath` → `closePath` → `fill` so the polygon
 * closes cleanly at both ends.
 *
 * @since 0.2
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const palette: Palette;
 *     drawFilledBand(ctx, {
 *         upper: [{ x: 0, y: 50 }, { x: 10, y: 60 }],
 *         lower: [{ x: 0, y: 40 }, { x: 10, y: 45 }],
 *         color: "#26a69a", alpha: 0.2,
 *     }, palette);
 *     void drawFilledBand;
 */
export function drawFilledBand(ctx: RenderCtx, args: FilledBandArgs, palette: Palette): void {
    const upperFinite = args.upper.filter(isFiniteBandPoint);
    const lowerFinite = args.lower.filter(isFiniteBandPoint);
    if (upperFinite.length === 0 || lowerFinite.length === 0) return;

    ctx.fillStyle = args.color ?? palette.plotDefault;
    ctx.globalAlpha = args.alpha;
    ctx.beginPath();
    const firstUpper = upperFinite[0];
    ctx.moveTo(firstUpper.x, firstUpper.y);
    for (let i = 1; i < upperFinite.length; i++) {
        const p = upperFinite[i];
        ctx.lineTo(p.x, p.y);
    }
    for (let i = lowerFinite.length - 1; i >= 0; i--) {
        const p = lowerFinite[i];
        ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
}
