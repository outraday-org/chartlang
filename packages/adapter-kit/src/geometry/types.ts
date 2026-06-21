// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * A 2D point in renderer pixel space — the structural type every
 * projection helper returns and every {@link DrawPrimitive} consumes.
 * Read-only so decomposers can't mutate vertices they don't own.
 *
 * @since 1.3
 * @stable
 * @example
 *     const p: Point2 = { x: 100, y: 50 };
 *     void p;
 */
export type Point2 = { readonly x: number; readonly y: number };

/**
 * Visible window into world coordinates. `xMin`/`xMax` are bar times in
 * UTC milliseconds; `yMin`/`yMax` are prices in the quote currency.
 * `pxWidth`/`pxHeight` are the renderer's drawable size in CSS pixels.
 * Ported verbatim from the canvas2d adapter's `render/coords.ts` so all
 * adapters share one projection contract.
 *
 * @since 1.3
 * @stable
 * @example
 *     const vp: Viewport = {
 *         xMin: 0, xMax: 9, yMin: 100, yMax: 110,
 *         pxWidth: 800, pxHeight: 400,
 *     };
 *     void vp;
 */
export type Viewport = {
    readonly xMin: number;
    readonly xMax: number;
    readonly yMin: number;
    readonly yMax: number;
    readonly pxWidth: number;
    readonly pxHeight: number;
};

/**
 * Resolved stroke styling for a {@link DrawPrimitive}. `dash` is the
 * `setLineDash` segment array — `[]` is a solid stroke. Decomposers map
 * a `LineStyle` to `dash` via the `_lib/dash` helper.
 *
 * `alpha ∈ [0, 1]` is the optional stroke opacity the painter brackets
 * around the `stroke()` call (the `highlighter` freehand kind sets it).
 * When omitted the stroke is fully opaque and the painter emits no
 * `globalAlpha` mutation — so a stroke without `alpha` is byte-identical
 * to a Task-1 stroke.
 *
 * @since 1.3
 * @stable
 * @example
 *     const s: StrokeStyle = { color: "#000000", width: 1, dash: [] };
 *     void s;
 */
export type StrokeStyle = {
    readonly color: string;
    readonly width: number;
    readonly dash: ReadonlyArray<number>;
    readonly alpha?: number;
};

/**
 * Resolved fill styling for a {@link DrawPrimitive}. `alpha ∈ [0, 1]`
 * is applied around the fill so a subsequent stroke draws at full
 * opacity.
 *
 * @since 1.3
 * @stable
 * @example
 *     const f: FillStyle = { color: "#dbeafe", alpha: 0.4 };
 *     void f;
 */
export type FillStyle = { readonly color: string; readonly alpha: number };

/**
 * Renderer-agnostic intermediate representation every drawing reduces
 * to. {@link decomposeDrawing} returns a flat `DrawPrimitive[]`; each
 * adapter paints the list with its own sink (canvas `paintPrimitive`,
 * Konva nodes, ECharts `graphic`, …). The four shapes — `polyline`,
 * `arc`, `text`, `marker` — are the smallest set all the target chart
 * libraries can consume.
 *
 * - `polyline` — an open or `closed` path with optional `stroke` / `fill`.
 * - `arc` — a circular arc centred on `(cx, cy)` from `start` to `end`
 *   radians, with optional `stroke` / `fill`.
 * - `text` — a single label at `(x, y)` with explicit `align` / `baseline`.
 * - `marker` — a sized glyph at `(x, y)` (reserved for adapter / future
 *   kinds; no basic kind emits it).
 *
 * @since 1.3
 * @stable
 * @example
 *     const seg: DrawPrimitive = {
 *         kind: "polyline",
 *         points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
 *         closed: false,
 *         stroke: { color: "#000000", width: 1, dash: [] },
 *     };
 *     void seg;
 */
export type DrawPrimitive =
    | {
          readonly kind: "polyline";
          readonly points: ReadonlyArray<Point2>;
          readonly closed: boolean;
          readonly stroke?: StrokeStyle;
          readonly fill?: FillStyle;
      }
    | {
          readonly kind: "arc";
          readonly cx: number;
          readonly cy: number;
          readonly r: number;
          readonly start: number;
          readonly end: number;
          /**
           * Whether the painter issues `closePath()` after the arc —
           * drawing the chord back to the arc's start. `true` only for a
           * full-circle shape (e.g. `circle`); partial arcs (the
           * `trend-angle` indicator, `time-cycles`) MUST be `false`, else
           * the chord renders as a spurious diameter line.
           */
          readonly closed: boolean;
          readonly stroke?: StrokeStyle;
          readonly fill?: FillStyle;
      }
    | {
          readonly kind: "text";
          readonly x: number;
          readonly y: number;
          readonly text: string;
          readonly color: string;
          readonly font: string;
          readonly align: "left" | "center" | "right";
          readonly baseline: "top" | "middle" | "bottom";
          readonly bgColor?: string;
      }
    | {
          readonly kind: "marker";
          readonly shape: "circle" | "square" | "diamond" | "triangle-up" | "triangle-down";
          readonly x: number;
          readonly y: number;
          readonly size: number;
          readonly stroke?: StrokeStyle;
          readonly fill?: FillStyle;
      };
