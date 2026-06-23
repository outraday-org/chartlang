// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Minimal `CanvasRenderingContext2D` subset the canvas-family sink
 * touches. Declared here (and re-used by {@link import("./paintPrimitive").paintPrimitive}
 * and {@link import("./mockContext").MockCanvasContext}) so production
 * `CanvasRenderingContext2D`, `OffscreenCanvasRenderingContext2D`, and
 * the test `MockCanvasContext` all satisfy one structural type. Moved
 * from the canvas2d adapter's `render/clear.ts` so lightweight-charts /
 * uplot / canvas2d share one painter and one mock.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     ctx.clearRect(0, 0, 1, 1);
 *     void ctx;
 */
export type RenderCtx = {
    clearRect(x: number, y: number, w: number, h: number): void;
    translate(x: number, y: number): void;
    save(): void;
    restore(): void;
    beginPath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    stroke(): void;
    // Path-`rect` (adds a rectangle to the current path) + `clip` (intersects
    // the clip region with the current path). Distinct from `fillRect` — these
    // two compose into the standard `beginPath()` → `rect()` → `clip()` idiom
    // an adapter uses to confine a hand-rolled draw pass to a plotting-area
    // box (the uplot candle/hline/drawing overlay clips to uPlot's plot bbox
    // so off-window marks do not spill into the axis gutters).
    rect(x: number, y: number, w: number, h: number): void;
    clip(): void;
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
