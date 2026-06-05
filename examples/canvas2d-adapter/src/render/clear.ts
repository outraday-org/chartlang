// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette";
import type { Viewport } from "./coords";

/**
 * Minimal `CanvasRenderingContext2D` subset the canvas2d renderer
 * touches. Declared here (and re-used by every helper) so production
 * `CanvasRenderingContext2D`, `OffscreenCanvasRenderingContext2D`, and
 * test `MockCanvas2DContext` all satisfy a single structural type.
 *
 * Phase-2 additions (per `tasks/phase-2-indicator-parity/1-plotkind-expansion`):
 * `fillText` (label renderer), `globalAlpha` (area + filled-band
 * fills), `font` (label renderer), `textAlign` + `textBaseline`
 * (label-position dispatch). `closePath` / `fill` / `fillRect` /
 * `setLineDash` already shipped in Phase 1.
 *
 * @since 0.1
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     ctx.clearRect(0, 0, 1, 1);
 *     void ctx;
 */
export type RenderCtx = {
    clearRect(x: number, y: number, w: number, h: number): void;
    beginPath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    stroke(): void;
    fillRect(x: number, y: number, w: number, h: number): void;
    fill(): void;
    arc(x: number, y: number, radius: number, start: number, end: number): void;
    closePath(): void;
    setLineDash(segments: ReadonlyArray<number>): void;
    fillText(text: string, x: number, y: number): void;
    strokeStyle: string;
    fillStyle: string;
    lineWidth: number;
    globalAlpha: number;
    font: string;
    textAlign: "start" | "center" | "end" | "left" | "right";
    textBaseline: "top" | "middle" | "bottom" | "alphabetic" | "hanging";
};

/**
 * Wipe the canvas to the palette's background colour. Issues exactly
 * one `clearRect` followed by one `fillRect` so consumers see a clean
 * frame on every redraw.
 *
 * @since 0.1
 * @experimental
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
