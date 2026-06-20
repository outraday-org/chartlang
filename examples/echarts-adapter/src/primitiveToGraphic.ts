// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    DrawPrimitive,
    FillStyle,
    Point2,
    StrokeStyle,
} from "@invinite-org/chartlang-adapter-kit";

// The ECharts `graphic` style subset the IR maps onto. `lineDash`/`fill`/
// `strokeOpacity`/`fillOpacity` are omitted (not set to a sentinel) when the
// IR carries no value, so the emitted option tree — and its pinned hash — stays
// minimal. `PathStyleProps` (the real ECharts type) is wider; this narrow
// shape is structurally assignable to it.
type GraphicPathStyle = {
    readonly stroke?: string;
    readonly lineWidth?: number;
    readonly lineDash?: ReadonlyArray<number>;
    readonly strokeOpacity?: number;
    readonly fill?: string;
    readonly fillOpacity?: number;
};

type GraphicTextStyle = {
    readonly text: string;
    readonly fill: string;
    readonly font: string;
    readonly align: "left" | "center" | "right";
    readonly verticalAlign: "top" | "middle" | "bottom";
    readonly backgroundColor?: string;
};

/**
 * The narrow ECharts `graphic` element shape {@link primitiveToGraphic}
 * produces. Each member is structurally assignable to ECharts'
 * `GraphicComponentLooseOption` (the `option.graphic[]` element type), but the
 * narrow union keeps the mapper type-safe instead of falling back to ECharts'
 * `Dictionary<any>`-loose path option. `polyline` / `polygon` / `circle` /
 * `arc` carry a `shape` + path `style`; `text` carries `x` / `y` + a text
 * `style`.
 *
 * @since 1.5
 * @experimental
 * @example
 *     import type { EChartsGraphicElement } from "chartlang-example-echarts-adapter";
 *     const el: EChartsGraphicElement = {
 *         type: "polyline",
 *         shape: { points: [[0, 0], [10, 10]] },
 *         style: { stroke: "#000000", lineWidth: 1 },
 *     };
 *     void el;
 */
export type EChartsGraphicElement =
    | {
          readonly type: "polyline" | "polygon";
          readonly shape: { readonly points: ReadonlyArray<readonly [number, number]> };
          readonly style: GraphicPathStyle;
      }
    | {
          readonly type: "circle";
          readonly shape: { readonly cx: number; readonly cy: number; readonly r: number };
          readonly style: GraphicPathStyle;
      }
    | {
          readonly type: "arc";
          readonly shape: {
              readonly cx: number;
              readonly cy: number;
              readonly r: number;
              readonly startAngle: number;
              readonly endAngle: number;
          };
          readonly style: GraphicPathStyle;
      }
    | {
          readonly type: "text";
          readonly x: number;
          readonly y: number;
          readonly style: GraphicTextStyle;
      };

// Map an IR stroke onto the ECharts path-style stroke keys. `dash: []` is a
// solid stroke, so `lineDash` is omitted (ECharts reads a missing `lineDash`
// as solid) to keep the option tree minimal; `alpha` becomes `strokeOpacity`
// only when present (an omitted alpha is fully opaque).
function strokeStyle(stroke: StrokeStyle): GraphicPathStyle {
    return {
        stroke: stroke.color,
        lineWidth: stroke.width,
        ...(stroke.dash.length > 0 ? { lineDash: stroke.dash } : {}),
        ...(stroke.alpha !== undefined ? { strokeOpacity: stroke.alpha } : {}),
    };
}

// Merge an IR fill into a path style. Fill colour + `fillOpacity` are added;
// an absent fill leaves both keys off (ECharts treats a missing `fill` as no
// fill — no `"none"` sentinel needed).
function withFill(base: GraphicPathStyle, fill: FillStyle | undefined): GraphicPathStyle {
    if (fill === undefined) return base;
    return { ...base, fill: fill.color, fillOpacity: fill.alpha };
}

// Combine optional IR stroke + fill into one ECharts path style.
function pathStyle(stroke: StrokeStyle | undefined, fill: FillStyle | undefined): GraphicPathStyle {
    return withFill(stroke === undefined ? {} : strokeStyle(stroke), fill);
}

function toPair(p: Point2): readonly [number, number] {
    return [p.x, p.y];
}

function isFinitePoint(p: Point2): boolean {
    return Number.isFinite(p.x) && Number.isFinite(p.y);
}

/**
 * Whether every coordinate of a {@link DrawPrimitive} is finite. ECharts logs
 * a console warning for a `graphic` element with a non-finite coordinate (a
 * `NaN` price / time anchor projects to a `NaN` pixel), so the adapter drops
 * non-finite primitives instead of painting them. This diverges from the
 * ctx-based adapters, which paint a no-op path — see the README. An empty
 * polyline (all points dropped upstream) is also treated as non-finite so the
 * element is skipped rather than emitting a zero-point shape.
 *
 * @since 1.5
 * @experimental
 * @example
 *     import { primitiveIsFinite } from "chartlang-example-echarts-adapter";
 *     const ok = primitiveIsFinite({
 *         kind: "text", x: 1, y: 2, text: "a", color: "#000",
 *         font: "10px sans-serif", align: "left", baseline: "top",
 *     });
 *     // ok === true
 *     void ok;
 */
export function primitiveIsFinite(prim: DrawPrimitive): boolean {
    switch (prim.kind) {
        case "polyline":
            return prim.points.length > 0 && prim.points.every(isFinitePoint);
        case "arc":
            return (
                Number.isFinite(prim.cx) &&
                Number.isFinite(prim.cy) &&
                Number.isFinite(prim.r) &&
                Number.isFinite(prim.start) &&
                Number.isFinite(prim.end)
            );
        case "text":
            return Number.isFinite(prim.x) && Number.isFinite(prim.y);
        case "marker":
            return Number.isFinite(prim.x) && Number.isFinite(prim.y) && Number.isFinite(prim.size);
    }
}

// A marker glyph maps to a small ECharts graphic: `circle` for the round
// marker, a `polygon` of the shape's vertices for the rest. The IR `size` is
// the glyph's full extent, so the half-extent `h` is the centre-to-vertex
// distance.
function markerGraphic(p: Extract<DrawPrimitive, { kind: "marker" }>): EChartsGraphicElement {
    const style = pathStyle(p.stroke, p.fill);
    const h = p.size / 2;
    if (p.shape === "circle") {
        return { type: "circle", shape: { cx: p.x, cy: p.y, r: h }, style };
    }
    const points: ReadonlyArray<readonly [number, number]> =
        p.shape === "square"
            ? [
                  [p.x - h, p.y - h],
                  [p.x + h, p.y - h],
                  [p.x + h, p.y + h],
                  [p.x - h, p.y + h],
              ]
            : p.shape === "diamond"
              ? [
                    [p.x, p.y - h],
                    [p.x + h, p.y],
                    [p.x, p.y + h],
                    [p.x - h, p.y],
                ]
              : p.shape === "triangle-up"
                ? [
                      [p.x, p.y - h],
                      [p.x + h, p.y + h],
                      [p.x - h, p.y + h],
                  ]
                : [
                      [p.x, p.y + h],
                      [p.x + h, p.y - h],
                      [p.x - h, p.y - h],
                  ];
    return { type: "polygon", shape: { points }, style };
}

/**
 * Map one shared {@link DrawPrimitive} (from
 * `decomposeDrawing(emission, viewport)`) onto an ECharts `graphic` element.
 * ECharts is not ctx-based, so drawings render through the declarative
 * `graphic` component rather than a `paintPrimitive` sink. The IR is already
 * in PIXEL coordinates — exactly what `graphic` elements consume — so this is
 * a pure structural remap: an open `polyline` → `polyline`, a `closed` one →
 * `polygon`; `arc` → `arc`; `text` → `text`; `marker` → a small `circle` /
 * `polygon` per shape. Stroke / fill / dash / alpha map onto the path or text
 * style.
 *
 * The function is total over the four IR kinds; the `default` arm is the
 * `never` exhaustiveness guard (a future IR kind fails `pnpm typecheck` here).
 *
 * @since 1.5
 * @experimental
 * @example
 *     import { primitiveToGraphic } from "chartlang-example-echarts-adapter";
 *     const el = primitiveToGraphic({
 *         kind: "polyline",
 *         points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
 *         closed: false,
 *         stroke: { color: "#000000", width: 1, dash: [] },
 *     });
 *     // el.type === "polyline"
 *     void el;
 */
export function primitiveToGraphic(p: DrawPrimitive): EChartsGraphicElement {
    switch (p.kind) {
        case "polyline":
            return {
                type: p.closed ? "polygon" : "polyline",
                shape: { points: p.points.map(toPair) },
                style: pathStyle(p.stroke, p.fill),
            };
        case "arc":
            return {
                type: "arc",
                shape: { cx: p.cx, cy: p.cy, r: p.r, startAngle: p.start, endAngle: p.end },
                style: pathStyle(p.stroke, p.fill),
            };
        case "text":
            return {
                type: "text",
                x: p.x,
                y: p.y,
                style: {
                    text: p.text,
                    fill: p.color,
                    font: p.font,
                    align: p.align,
                    verticalAlign: p.baseline,
                    ...(p.bgColor !== undefined ? { backgroundColor: p.bgColor } : {}),
                },
            };
        case "marker":
            return markerGraphic(p);
        default: {
            const _exhaustive: never = p;
            void _exhaustive;
            return { type: "polyline", shape: { points: [] }, style: {} };
        }
    }
}
