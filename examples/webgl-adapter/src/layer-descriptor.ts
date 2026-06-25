// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/layer-descriptor.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.
//
// The color resolvers below are additionally ported from invinite's
// webgl/colors.ts @ cd883292 — re-driven by the chartlang `Palette` (hex
// strings) + `Bar`, NOT invinite's CSS-var / theme-epoch cache (dropped).

import type { Bar } from "@invinite-org/chartlang-core";

/**
 * Unit-interval RGBA tuple — each component in `[0, 1]`. The descriptor
 * carries colors pre-divided by 255 so a GPU program (Tasks 6–13) can feed
 * them straight to a uniform without further conversion (the invinite
 * convention). Built once at descriptor-build time from a {@link Palette}
 * hex string via {@link hexToRgbaUnit}.
 *
 * @since 0.1
 * @stable
 * @example
 *     const teal: RgbaUnit = hexToRgbaUnit("#26a69a", 1);
 *     // teal[0] ≈ 38 / 255
 *     void teal;
 */
export type RgbaUnit = readonly [number, number, number, number];

/**
 * Colour palette consumed by the WebGL renderer's descriptor builders and
 * GPU programs. Mirrors the canvas2d reference adapter's `Palette` shape
 * byte-for-byte (every slot mandatory) so the two adapters stay
 * interchangeable; the candle bull / bear values are the canonical
 * TradingView `#26a69a` / `#ef5350` hexes ported from invinite's
 * `candle-default-colors.ts` (the behavioural reference — the surrounding
 * shape is chartlang-native). Defined locally rather than imported from
 * canvas2d: the no-cross-example-`src`-import invariant forbids one example
 * reaching into another's source.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { type Palette, DEFAULT_PALETTE } from "chartlang-example-webgl-adapter";
 *     const p: Palette = { ...DEFAULT_PALETTE, background: "#101820" };
 *     void p;
 */
export type Palette = {
    readonly background: string;
    readonly candleBullBody: string;
    readonly candleBearBody: string;
    readonly candleWick: string;
    readonly gridLine: string;
    readonly paneBorder: string;
    readonly plotDefault: string;
    readonly alertInfo: string;
    readonly alertWarning: string;
    readonly alertCritical: string;
};

/**
 * Default palette used when the consumer omits `opts.palette` (Task 5 seeds
 * `state.palette` from `opts.palette ?? DEFAULT_PALETTE`). The bull / bear
 * hexes are the invinite reference values; the remaining slots are
 * chartlang-native, matching the canvas2d reference palette so both adapters
 * render the same default look.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { DEFAULT_PALETTE } from "chartlang-example-webgl-adapter";
 *     // DEFAULT_PALETTE.candleBullBody === "#26a69a";
 *     const p = DEFAULT_PALETTE;
 *     void p;
 */
export const DEFAULT_PALETTE: Palette = Object.freeze({
    background: "#0e1218",
    candleBullBody: "#26a69a",
    candleBearBody: "#ef5350",
    candleWick: "#cccccc",
    gridLine: "#2a2f3a",
    paneBorder: "#3a4150",
    plotDefault: "#90caf9",
    alertInfo: "#2196f3",
    alertWarning: "#ff9800",
    alertCritical: "#f44336",
});

// One short hex byte (`#abc`) expands each nibble; a full hex byte (`#aabbcc`)
// is read directly. Returns a 0..255 integer or `null` when the slice is not
// two hex digits, so a malformed color falls back to opaque black rather than
// poisoning the tuple with NaN.
function hexByte(hex: string, start: number, len: number): number | null {
    const slice = hex.slice(start, start + len);
    const expanded = len === 1 ? slice + slice : slice;
    if (!/^[0-9a-fA-F]{2}$/.test(expanded)) return null;
    return Number.parseInt(expanded, 16);
}

/**
 * Parse a `#rgb` / `#rrggbb` / `#rrggbbaa` hex string into a
 * {@link RgbaUnit} (components in `[0, 1]`). `alpha` (default `1`) is the
 * final alpha and overrides any alpha implied by an 8-digit hex. A
 * non-`#`-prefixed or malformed string falls back to opaque black
 * (`[0, 0, 0, alpha]`) — the descriptor builders never emit NaN into a GPU
 * buffer. Ported (adapted) from invinite `webgl/colors.ts`: the
 * `parseColorToRgba` → `/255` step, but driven by a plain hex string instead
 * of invinite's CSS-var cache.
 *
 * @since 0.1
 * @stable
 * @example
 *     const c = hexToRgbaUnit("#26a69a", 1);
 *     // c[0] ≈ 0.149, c[3] === 1
 *     void c;
 */
export function hexToRgbaUnit(hex: string, alpha = 1): RgbaUnit {
    const a = Math.min(Math.max(alpha, 0), 1);
    if (hex.length === 0 || hex[0] !== "#") return [0, 0, 0, a];
    const short = hex.length === 4;
    const r = hexByte(hex, 1, short ? 1 : 2);
    const g = hexByte(hex, short ? 2 : 3, short ? 1 : 2);
    const b = hexByte(hex, short ? 3 : 5, short ? 1 : 2);
    if (r === null || g === null || b === null) return [0, 0, 0, a];
    return [r / 255, g / 255, b / 255, a];
}

/**
 * Candle-direction predicate ported from invinite `webgl/colors.ts`: a bar
 * is bullish when its close is at or above its open (a doji counts as
 * bullish, matching the source). Drives bull / bear body + wick color
 * selection.
 *
 * @since 0.1
 * @stable
 * @example
 *     const up = isBullish({ time: 0, open: 1, high: 2, low: 0, close: 1.5 });
 *     // up === true
 *     void up;
 */
export function isBullish(bar: Bar): boolean {
    return bar.close >= bar.open;
}

/**
 * The 3-state per-bar color precedence shared by the line-family descriptor
 * builders (line / step / area / histogram), mirroring the canvas2d
 * reference's `resolvePaintColor`: **omitted** (`undefined`) ⇒
 * `staticColor ?? fallback`; **present** ⇒ the override string; **`null`** ⇒
 * `null` (an explicit "no color this bar" gap — the builder skips it). This
 * is the {@link import("@invinite-org/chartlang-adapter-kit").PlotEmission}
 * `colorValue` contract.
 *
 * @since 0.1
 * @stable
 * @example
 *     resolvePaintColor(undefined, "#abc", "#def"); // "#abc"
 *     resolvePaintColor("#111", "#abc", "#def"); // "#111"
 *     resolvePaintColor(null, "#abc", "#def"); // null
 */
export function resolvePaintColor(
    colorValue: string | null | undefined,
    staticColor: string | null,
    fallback: string,
): string | null {
    if (colorValue === undefined) return staticColor ?? fallback;
    return colorValue;
}

/**
 * The world-space x-window + y-range a single pane spans this frame. `xMin`/
 * `xMax` are world time, `yMin`/`yMax` are world price — the rectangle Task 5
 * feeds to {@link import("./webgl/projection.js").ortho2d}. Kept ignorant of
 * clip space: `buildFrame` resolves it in world units only.
 *
 * @since 0.1
 * @stable
 * @example
 *     const w: PaneWindow = { xMin: 0, xMax: 100, yMin: 1, yMax: 2 };
 *     void w;
 */
export type PaneWindow = {
    readonly xMin: number;
    readonly xMax: number;
    readonly yMin: number;
    readonly yMax: number;
};

/** Common header on every descriptor: a `${paneKey}:${suffix}` id for
 * correlation + the `kind` tag the renderer dispatches on. */
type DescriptorHeader = {
    readonly id: string;
    readonly kind: LayerKind;
};

/**
 * The descriptor kinds the WebGL pipeline dispatches on. The candle / line
 * kinds land in Tasks 6–7; vertical-bars / filled-band / cursor / marker /
 * drawing / text are typed now and built by Tasks 10–13.
 *
 * @since 0.1
 * @stable
 * @example
 *     const k: LayerKind = "candle-bodies";
 *     void k;
 */
export type LayerKind =
    | "candle-bodies"
    | "candle-wicks"
    | "line-strip"
    | "vertical-bars"
    | "filled-band"
    | "cursor"
    | "marker"
    | "drawing"
    | "text";

/**
 * Candle bodies — one packed row per bar, body fill. `rows` packs
 * `[x, open, high, low, close, isBull]` per bar in **world** units (x is the
 * bar's world time; `isBull` is `1`/`0`), length `6 * rowCount`. The wicks
 * live in {@link CandleWicksDescriptor} (different draw-call shape).
 * `bodyWidthPx` is CSS-px (DPR scaling happens in the program, Task 6).
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const d: CandleBodiesDescriptor;
 *     // d.rows.length === 6 * d.rowCount
 *     void d;
 */
export type CandleBodiesDescriptor = DescriptorHeader & {
    readonly kind: "candle-bodies";
    readonly rows: Float32Array;
    readonly rowCount: number;
    readonly bullColor: RgbaUnit;
    readonly bearColor: RgbaUnit;
    readonly bodyWidthPx: number;
};

/**
 * Candle wicks — one packed row per bar: `[x, low, high, isBull]` in
 * **world** units, length `4 * rowCount`. `isBull` selects bull / bear (or
 * the single wick color) per bar. `wickWidthPx` is CSS-px.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const d: CandleWicksDescriptor;
 *     // d.rows.length === 4 * d.rowCount
 *     void d;
 */
export type CandleWicksDescriptor = DescriptorHeader & {
    readonly kind: "candle-wicks";
    readonly rows: Float32Array;
    readonly rowCount: number;
    readonly wickColor: RgbaUnit;
    readonly wickWidthPx: number;
};

/**
 * Generic poly-line — indicator lines, threshold lines, drawing strokes.
 * `points` packs `[x0, y0, x1, y1, …]` in **world** space (x = world time,
 * y = world price), length `2 * pointCount`. A non-finite y (NaN gap) is
 * preserved so the program (Task 7) skips the segment. `dash` is `null` for a
 * solid line or `[on, off]` CSS-px.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const d: LineStripDescriptor;
 *     // d.points.length === 2 * d.pointCount
 *     void d;
 */
export type LineStripDescriptor = DescriptorHeader & {
    readonly kind: "line-strip";
    readonly points: Float32Array;
    readonly pointCount: number;
    readonly color: RgbaUnit;
    readonly widthPx: number;
    readonly dash: null | readonly [number, number];
    /** `true` ⇒ render a horizontal-then-vertical staircase (`step-line`). */
    readonly step: boolean;
};

/**
 * Vertical bars anchored at a world-`y` baseline, signed heights — volume
 * bars (baseline `0`, always-positive heights) + MACD-style / `histogram`
 * plots (signed heights about `style.baseline`). `rows` packs
 * `[x, height, isPositive]` per bar in **world** units, length `3 * rowCount`,
 * where `height = value - baseline` (the signed offset from the baseline) and
 * `isPositive` is `1` when `value >= baseline` (drives the bull / bear color).
 * `baseline` is the world-`y` the bars grow from (omitted ⇒ `0`); the program
 * anchors the quad's bottom edge there. Built by Task 10.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const d: VerticalBarsDescriptor;
 *     void d;
 */
export type VerticalBarsDescriptor = DescriptorHeader & {
    readonly kind: "vertical-bars";
    readonly rows: Float32Array;
    readonly rowCount: number;
    readonly positiveColor: RgbaUnit;
    readonly negativeColor: RgbaUnit;
    readonly barWidthPx: number;
    /** World-`y` baseline the bars grow from (omitted ⇒ `0`). */
    readonly baseline?: number;
};

/**
 * Translucent polygon fill between two aligned **world**-space edge series
 * sharing an x axis. `upper` / `lower` pack `[x0, y0, x1, y1, …]` (length
 * `2 * pointCount` each); a NaN y marks a per-column gap. Built by Task 11.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const d: FilledBandDescriptor;
 *     void d;
 */
export type FilledBandDescriptor = DescriptorHeader & {
    readonly kind: "filled-band";
    readonly upper: Float32Array;
    readonly lower: Float32Array;
    readonly pointCount: number;
    readonly color: RgbaUnit;
};

/**
 * Cursor / crosshair point sprites. `rows` packs `[x, y, r, g, b, a]` per
 * cursor in **world** position + unit RGBA, length `6 * rowCount`. Built by
 * Task 12.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const d: CursorDescriptor;
 *     void d;
 */
export type CursorDescriptor = DescriptorHeader & {
    readonly kind: "cursor";
    readonly rows: Float32Array;
    readonly rowCount: number;
    readonly radiusPx: number;
};

/**
 * Instanced glyph / shape markers. `rows` packs `[x, y]` per marker in
 * **world** position, length `2 * rowCount`; color + radius are uniform
 * across the descriptor. Built by Task 12.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const d: MarkerDescriptor;
 *     void d;
 */
export type MarkerDescriptor = DescriptorHeader & {
    readonly kind: "marker";
    readonly rows: Float32Array;
    readonly rowCount: number;
    readonly color: RgbaUnit;
    readonly radiusPx: number;
};

/**
 * Drawing — a flat list of **world**-space {@link LineStripDescriptor}
 * strokes the renderer feeds through the line-strip program (Task 13
 * decomposes via the shared `decomposeDrawing`).
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const d: DrawingDescriptor;
 *     void d;
 */
export type DrawingDescriptor = DescriptorHeader & {
    readonly kind: "drawing";
    readonly strokes: ReadonlyArray<LineStripDescriptor>;
};

/**
 * Text label anchored at a **world** `(x, y)` — painted on the 2D-canvas
 * overlay (axis labels, drawing labels, marker / alert text), NOT a GPU
 * program (Tasks 8 / 12 / 13). Plain data only.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const d: TextDescriptor;
 *     void d;
 */
export type TextDescriptor = DescriptorHeader & {
    readonly kind: "text";
    readonly x: number;
    readonly y: number;
    readonly text: string;
    readonly color: string;
};

/**
 * Discriminated union of every renderer-agnostic layer the WebGL pipeline
 * consumes. Each variant carries ONLY plain data (`Float32Array` packs or the
 * inputs to pack) + unit RGBA — no `gl`, no clip space, no library types — so
 * `buildFrame` stays pure and headless-testable.
 *
 * @since 0.1
 * @stable
 * @example
 *     const k: LayerDescriptor["kind"] = "line-strip";
 *     void k;
 */
export type LayerDescriptor =
    | CandleBodiesDescriptor
    | CandleWicksDescriptor
    | LineStripDescriptor
    | VerticalBarsDescriptor
    | FilledBandDescriptor
    | CursorDescriptor
    | MarkerDescriptor
    | DrawingDescriptor
    | TextDescriptor;

/**
 * A pane's CSS-pixel rectangle within the canvas (top-left origin, `y` grows
 * down). Carried on each {@link PaneRenderState} so the renderer scopes that
 * pane's device-px GL viewport (via `paneViewport`) and the 2D overlay
 * projects its axis labels into the right band. Omitted ⇒ the renderer falls
 * back to the whole canvas (the Task-5 single-overlay MVP behaviour).
 *
 * @since 0.1
 * @stable
 * @example
 *     const r: PaneCssRect = { x: 0, y: 320, width: 800, height: 80 };
 *     void r;
 */
export type PaneCssRect = {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
};

/**
 * The per-pane render state {@link import("./buildFrame.js").buildFrame}
 * emits: the resolved world {@link PaneWindow} (fed to `ortho2d` per pane in
 * Task 5), the pane's CSS-px {@link PaneCssRect} (its viewport band within the
 * canvas — the subpane split, Task 10), and the ordered
 * {@link LayerDescriptor}s to draw inside it. `cssRect` is optional: omitted
 * ⇒ the renderer spans the whole canvas (single-overlay MVP).
 *
 * @since 0.1
 * @stable
 * @example
 *     const p: PaneRenderState = {
 *         paneKey: "overlay",
 *         window: { xMin: 0, xMax: 100, yMin: 1, yMax: 2 },
 *         cssRect: { x: 0, y: 0, width: 800, height: 320 },
 *         layers: [],
 *     };
 *     void p;
 */
export type PaneRenderState = {
    readonly paneKey: string;
    readonly window: PaneWindow;
    readonly cssRect?: PaneCssRect;
    readonly layers: ReadonlyArray<LayerDescriptor>;
};
