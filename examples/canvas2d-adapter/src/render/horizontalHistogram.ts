// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette";
import type { RenderCtx } from "./clear";
import { priceToY, type Viewport } from "./coords";

/**
 * Single canvas row for a Phase 5 horizontal histogram.
 *
 * @since 0.5
 * @stable
 * @example
 *     const bucket: HorizontalHistogramBucket = { price: 100, volume: 25 };
 *     void bucket;
 */
export type HorizontalHistogramBucket = {
    readonly price: number;
    readonly volume: number;
    readonly color?: string;
};

/**
 * Canvas layout inputs for a Phase 5 horizontal histogram.
 *
 * @since 0.5
 * @stable
 * @example
 *     const args: HorizontalHistogramArgs = { buckets: [], maxWidth: 80, rowHeight: 4 };
 *     void args;
 */
export type HorizontalHistogramArgs = {
    readonly buckets: ReadonlyArray<HorizontalHistogramBucket>;
    readonly maxWidth: number;
    readonly rowHeight: number;
};

/**
 * Render Phase-5 `horizontal-histogram` buckets at the right edge.
 *
 * @since 0.5
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const viewport: Viewport;
 *     declare const palette: Palette;
 *     drawHorizontalHistogram(ctx, { buckets: [], maxWidth: 80, rowHeight: 4 }, viewport, palette);
 */
export function drawHorizontalHistogram(
    ctx: RenderCtx,
    args: HorizontalHistogramArgs,
    viewport: Viewport,
    palette: Palette,
): void {
    let maxVolume = 0;
    for (const bucket of args.buckets) {
        if (bucket.volume > maxVolume) maxVolume = bucket.volume;
    }
    if (maxVolume <= 0) return;
    for (const bucket of args.buckets) {
        const width = (bucket.volume / maxVolume) * args.maxWidth;
        const y = priceToY(bucket.price, viewport) - args.rowHeight / 2;
        ctx.fillStyle = bucket.color ?? palette.plotDefault;
        ctx.fillRect(viewport.pxWidth - width, y, width, args.rowHeight);
    }
}
