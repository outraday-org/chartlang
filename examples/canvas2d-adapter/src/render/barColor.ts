// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { BarOverrideArgs } from "./barOverride.js";
import { drawBarOverride } from "./barOverride.js";
import type { RenderCtx } from "./clear.js";
import type { Viewport } from "./coords.js";

/**
 * Canvas arguments for Phase 5 `bar-color` overlays.
 *
 * @since 0.5
 * @stable
 * @example
 *     declare const args: BarOverrideArgs;
 *     const barColorArgs: BarColorArgs = args;
 *     void barColorArgs;
 */
export type BarColorArgs = BarOverrideArgs;

/**
 * Render a Phase-5 `bar-color` tint using the same deterministic OHLC
 * outline path as `bar-override`.
 *
 * @since 0.5
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const args: BarColorArgs;
 *     declare const viewport: Viewport;
 *     drawBarColor(ctx, args, viewport);
 */
export function drawBarColor(ctx: RenderCtx, args: BarColorArgs, viewport: Viewport): void {
    drawBarOverride(ctx, args, viewport);
}
