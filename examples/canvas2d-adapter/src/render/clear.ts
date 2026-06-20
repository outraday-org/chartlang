// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { RenderCtx } from "@invinite-org/chartlang-adapter-kit/canvas";
import type { Palette } from "../palette.js";
import type { Viewport } from "./coords.js";

// `RenderCtx` (the structural `CanvasRenderingContext2D` subset every
// renderer + the mock satisfy) was moved to the shared canvas sink in
// adapter-kit (Tasks 1–3); re-export it so the canvas2d renderers keep
// importing `RenderCtx` from `./render` while the structural type lives
// once in the shared `./canvas` sub-path.
export type { RenderCtx } from "@invinite-org/chartlang-adapter-kit/canvas";

/**
 * Wipe the canvas to the palette's background colour. Issues exactly
 * one `clearRect` followed by one `fillRect` so consumers see a clean
 * frame on every redraw.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const viewport: Viewport;
 *     declare const palette: Palette;
 *     clear(ctx, viewport, palette);
 *     void clear;
 */
export function clear(ctx: RenderCtx, viewport: Viewport, palette: Palette): void {
    ctx.clearRect(0, 0, viewport.pxWidth, viewport.pxHeight);
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, viewport.pxWidth, viewport.pxHeight);
}
