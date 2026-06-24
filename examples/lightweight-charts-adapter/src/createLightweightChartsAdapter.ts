// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// ---------------------------------------------------------------------------
// Plot-kind → native lightweight-charts mapping (Task 5). Candles, plots,
// horizontal lines and panes use lightweight-charts' OWN facilities — they
// are never hand-painted. Drawings (Task 6) buffer here and paint via a
// series-primitive overlay (`DrawingPrimitive` + `decomposeDrawing`).
//
//   line                 → addSeries("Line")
//   step-line            → addSeries("Line", { lineType: WithSteps })  (native)
//   area                 → addSeries("Area", { lineColor, topColor,
//                          bottomColor }) — `fillAlpha` folds into the
//                          top/bottom gradient colours.
//   histogram            → addSeries("Histogram")
//   horizontal-line      → series.createPriceLine() on the pane anchor series
//   filled-band          → two Line series (upper / lower), BOTH carrying
//                          `plot.color`; the FILL between them is a Task-6
//                          drawing (LC has no native band).
//   shape/character/      → SPLIT. Glyphs LC's v5 markers plugin can express
//     arrow/marker/label    (`arrow` up/down, `marker`/`shape` circle/square,
//                          `character`/`label` as text markers) → native
//                          `series.setMarkers([...])` with real shape /
//                          position / text / colour / size. Glyphs it cannot
//                          (triangle / diamond / cross / xcross / flag) → the
//                          canvas overlay via the SHARED adapter-kit glyph
//                          helper (`drawShape` / `drawMarker`), painted by the
//                          same `DrawingPrimitive` that paints drawings.
//   drawings (63 kinds)   → a series-primitive overlay (Task 6) that paints
//                          `decomposeDrawing` through the shared canvas sink;
//                          NOT native (LC has no drawing facility). Anchored on
//                          the overlay candle series via `attachPrimitive`.
//                          The same overlay also paints the overlay-routed
//                          glyphs above.
//   candle-override       → per-bar candle DATA-POINT colour resolved by the
//                          bar's own direction (`close > open ⇒ bull`,
//                          `< ⇒ bear`, else `doji ?? bull`), stamped onto the
//                          candlestick point (body + border + wick) like
//                          `bar-color` — NOT a whole-series tint. A
//                          `bar-color` / `bar-override` on the same bar wins.
//   bar-override/         → per-bar candle colour stamped onto the candlestick
//     bar-color              DATA POINT (`color` + `borderColor` + `wickColor`)
//                          — LC's NATIVE per-point colour API, so body AND
//                          border AND wick recolour for exactly that bar. The
//                          per-bar colour resolves `colorValue ?? style.color`
//                          (the dynamic-colour precedence: `colorValue` present
//                          overrides; `null` clears the override; omitted uses
//                          the static `style.color`). Tracked in
//                          `state.barColors` (keyed by bar time) so a re-emit
//                          re-stamps the same bar.
//   bg-color              → per-bar background BAND painted by the
//                          `DrawingPrimitive` overlay (LC's background is a
//                          single chart-layout option, NOT a per-bar band). The
//                          per-bar colour resolves the 3-state `colorValue`
//                          (omitted ⇒ `style.color`; present ⇒ override; `null`
//                          ⇒ no band that bar) and `transp` (0–100) folds into
//                          the stripe opacity. Buffered in `state.bgBands` keyed
//                          `${pane}|${slotId}|${time}` (one stripe per bar).
//   horizontal-histogram  → NO-OP. No native facility; Task-6 primitive path.
//
//   visible:false         → series.applyOptions({ visible: false }) (hidden,
//                          not removed — the slot stays declared).
//   NaN / null value      → a whitespace point ({ time } with no value) so the
//                          native line does not draw a break artefact.
// ---------------------------------------------------------------------------

import {
    type Adapter,
    type AlertConditionEmission,
    type AlertEmission,
    type CandleEvent,
    type Capabilities,
    type DrawingEmission,
    type LogEmission,
    type PlotEmission,
    type RenderOrderKey,
    type RunnerEmissions,
    RENDER_BAND,
    defineAdapter,
    medianBarSpacing,
    shiftedBarTime,
    validateEmission,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import {
    type ScriptHost,
    type WorkerLike,
    createWorkerHost,
} from "@invinite-org/chartlang-host-worker";
import {
    AreaSeries,
    CandlestickSeries,
    ColorType,
    HistogramSeries,
    type IPriceLine,
    type ISeriesPrimitive,
    LineSeries,
    type SeriesDefinition,
    type SeriesMarker,
    type SeriesType,
    type Time,
    type UTCTimestamp,
    createChart,
    createSeriesMarkers,
} from "lightweight-charts";

import { LWC_CAPABILITIES, LWC_SYM_INFO } from "./capabilities.js";
import {
    type BgBand,
    DrawingPrimitive,
    type GlyphMark,
    type OverlayBuffers,
} from "./drawingPrimitive.js";
import type { LwcChart, LwcMarker, LwcPriceLine, LwcSeries } from "./testing.js";

const DEFAULT_INTERVAL = "1D";
const MAX_RECENT_ALERTS = 256;

/**
 * Constructor options for {@link createLightweightChartsAdapter}. `chartApi`
 * is the test seam (mirrors canvas2d's `opts.ctx`): when supplied the factory
 * drives the supplied {@link LwcChart} directly; otherwise it builds one from
 * `opts.container` via `opts.createChart` (defaulting to the real
 * lightweight-charts `createChart`). The `host` / `workerLike` fields are the
 * worker-host test seams, same as the canvas2d adapter.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { MockLwcApi } from "chartlang-example-lightweight-charts-adapter/testing";
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     const opts: CreateLightweightChartsAdapterOpts = {
 *         chartApi: new MockLwcApi(),
 *         candleSource: mockCandleSource([]),
 *     };
 *     void opts;
 */
export type CreateLightweightChartsAdapterOpts = {
    readonly container?: HTMLElement;
    readonly chartApi?: LwcChart;
    readonly createChart?: (container: HTMLElement) => LwcChart;
    readonly candleSource: AsyncIterable<CandleEvent>;
    readonly capabilities?: Capabilities;
    readonly interval?: string;
    /**
     * Default visible window: when set, the chart opens framed on only the
     * most recent N bars (rest stay scrollable via lightweight-charts' native
     * pan/zoom); omit = fit all data (fitContent), unchanged behavior.
     */
    readonly initialVisibleBars?: number;
    readonly resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    readonly onAlert?: (a: AlertEmission) => void;
    readonly host?: ScriptHost;
    readonly workerLike?: WorkerLike;
};

/**
 * Public handle the consumer drives. `host` is exposed so callers can
 * `await adapter.host.load(compiled)` before driving the candle source.
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const adapter: LwcAdapterHandle;
 *     // await adapter.host.load(compiled);
 *     void adapter;
 */
export type LwcAdapterHandle = Adapter & { readonly host: ScriptHost };

type PaneSeries = {
    readonly series: LwcSeries;
    // The second edge of a `filled-band` slot (upper = `series`, lower here).
    readonly lower?: LwcSeries;
};

// The per-colour-run bookkeeping for a line / step-line / area slot whose
// emissions carry a per-bar `colorValue` (see `applyRunPlot`). LC line/area
// series hold a single creation-time colour, so a colour change splits the
// slot into consecutive same-colour RUNS, each its own native series.
type RunSlotState = {
    // Every run series of the slot, in creation order. `visible:false` hides
    // them all; `dispose` drops the map.
    readonly series: LwcSeries[];
    // The colour of the run currently being extended; `null` when the active
    // run ended on a gap (the next finite bar opens a fresh series).
    activeColor: string | null;
    // The last finite point written, duplicated into the next run as the shared
    // boundary so the segments visually join. `undefined` after a gap (no
    // boundary should bridge a gap) or before the first point.
    lastPoint: { readonly time: number; readonly value: number } | undefined;
};

// The bull / bear / doji palette a `candle-override` emission carries; the
// per-bar colour is picked from it by the bar's own direction.
type CandleOverridePalette = {
    readonly bull: string;
    readonly bear: string;
    readonly doji?: string;
};

type AdapterState = {
    readonly chart: LwcChart;
    readonly bars: Bar[];
    // `"overlay"` is pane 0; `"new"` allocates a fresh pane each sight; a
    // named pane string gets a stable index on first sight.
    readonly paneIndex: Map<string, number>;
    // Keyed by `${paneKey}|${slotId}` so one callsite can land in distinct
    // panes and each gets its own native series.
    readonly series: Map<string, PaneSeries>;
    // Per-colour-run series for line / step-line / area slots carrying a per-bar
    // `colorValue`, keyed `${pane}|${slotId}` (a SEPARATE store from `series` so
    // the single-series and run paths never collide). A slot that never carries
    // `colorValue` never lands here — it stays one native series, byte-identical
    // to the pre-feature wire.
    readonly runSlots: Map<string, RunSlotState>;
    // The native price line a `horizontal-line` slot owns, keyed by the same
    // `${paneKey}|${slotId}`. The runtime re-emits the slot every bar; we
    // re-price the SAME line instead of stacking a new one each frame (LC has
    // no price-line dedup). The series the line is anchored on is held so a
    // hidden / removed slot can `removePriceLine` it.
    readonly priceLines: Map<string, { readonly line: LwcPriceLine; readonly anchor: LwcSeries }>;
    // The candlestick series of the overlay pane, lazily created on the first
    // candle event — the anchor for overlay-pane price lines.
    candleSeries: LwcSeries | undefined;
    // Per-bar candle colour overrides keyed by bar time. A `bar-color` /
    // `bar-override` emission stamps the resolved colour here; `candleData`
    // merges it onto the candlestick point (body + border + wick) so the
    // override is genuinely per-bar (LC's native per-point colour API), not a
    // whole-series tint that flickers to the last bar's colour.
    readonly barColors: Map<number, string>;
    // Per-bar `candle-override` palettes keyed by bar time. Resolved by the
    // bar's own direction in `candleData` (bull / bear / doji) and stamped onto
    // the candlestick point through the SAME per-point colour path `bar-color`
    // uses. A `bar-color` / `bar-override` on the same bar (in `barColors`)
    // wins — the override paints on top of the candle, the candle-override is
    // the candle's own body colour.
    readonly candleOverrides: Map<number, CandleOverridePalette>;
    // Overlay-routed glyphs (the kinds LC's markers plugin can NOT express:
    // triangle / diamond / cross / xcross / flag) keyed by `${pane}|${slotId}`
    // (last-write-wins, mirroring how a glyph slot re-emits each bar). The
    // attached `DrawingPrimitive` paints them via the shared adapter-kit glyph
    // helper each frame; the rest go native through `setMarkers`. The shifted
    // bar time is resolved at ingest so the primitive needs no `state.bars`.
    readonly glyphs: Map<string, GlyphMark>;
    readonly recentAlerts: AlertEmission[];
    readonly currentAlertConditions: AlertConditionEmission[];
    readonly recentLogs: LogEmission[];
    // Live drawing buffer the attached `DrawingPrimitive` overlay paints each
    // frame (last-write-wins; `op: "remove"` drops the key).
    readonly drawings: Map<string, DrawingEmission>;
    // Per-bar `bg-color` background bands the same `DrawingPrimitive` overlay
    // paints (Task 12) — keyed `${pane}|${slotId}|${time}` so a multi-bar
    // bg-color slot keeps one stripe per bar. The 3-state `colorValue` is
    // resolved at ingest, so a buffered band always carries a concrete colour
    // (a `null` gap bar deletes its key rather than buffering).
    readonly bgBands: Map<string, BgBand>;
    // Parallel `(z, band, seq)` ingest keys for the z-sorted overlay marks: the
    // raw `DrawingEmission` carries `z` but no `seq`, and a `GlyphMark` carries
    // neither, so the factory writes the key in lockstep with the buffer it
    // tags (drawings → `drawingKeys`, overlay glyphs → `glyphKeys`). bg-color
    // bands carry their key inline (a `BgBand` is a `RenderOrderKey`).
    readonly drawingKeys: Map<string, RenderOrderKey>;
    readonly glyphKeys: Map<string, RenderOrderKey>;
    // Monotonic declaration sequence (ingest order = script order) stamped onto
    // every overlay mark so the shared `(z, band, seq)` sort is total +
    // deterministic. Bumped once per tagged emission.
    seq: number;
    // Default visible window: frame the time scale onto the most recent N bars
    // on the FIRST frame data is present. Omitted = fit all data (the library's
    // auto-fit, unchanged behaviour).
    readonly initialVisibleBars?: number;
    // Guards the one-shot initial framing so live-bar updates and any user
    // pan/zoom are not overridden after the first time data is present.
    hasFramedInitial: boolean;
};

const HANDLE_STATE: WeakMap<LwcAdapterHandle, AdapterState> = new WeakMap();
const HANDLE_INTERVAL: WeakMap<LwcAdapterHandle, string> = new WeakMap();

function resolveChartApi(opts: CreateLightweightChartsAdapterOpts): LwcChart {
    if (opts.chartApi !== undefined) return opts.chartApi;
    if (opts.container === undefined) {
        throw new Error(
            "createLightweightChartsAdapter: provide opts.chartApi (tests) or opts.container (production)",
        );
    }
    const make = opts.createChart ?? defaultCreateChart;
    return make(opts.container);
}

// The string series-type tags the factory uses map onto the library's series
// definitions here — the one place the real lightweight-charts series consts
// are referenced, so the rest of the factory speaks only the structural
// {@link LwcSeries} shape (which the mock also satisfies).
const SERIES_DEFINITION: Readonly<Record<string, SeriesDefinition<SeriesType>>> = {
    Line: LineSeries,
    Area: AreaSeries,
    Histogram: HistogramSeries,
    Candlestick: CandlestickSeries,
};

// Production default: bridge the real lightweight-charts `IChartApi` into the
// structural {@link LwcChart} the factory speaks. It is the single place that
// resolves a string series-type tag to a library series definition and maps
// `setMarkers` onto the v5 `createSeriesMarkers` plugin. Tests pass
// `opts.chartApi` (a `MockLwcApi`) and never reach this branch — it needs a
// real DOM container, so the DOM-bound lines are coverage-exempt; the pure
// mapping helpers above it are covered.
/* v8 ignore start -- exercised only against a real DOM chart, not in CI */
// lightweight-charts brands its time axis (`UTCTimestamp`); the structural
// `LwcSeries` carries a plain epoch number. This is the single brand-narrowing
// at the library boundary (LC's own docs cast the same way).
function toTime(epoch: number): Time {
    return epoch as UTCTimestamp;
}

// Map the structural {@link LwcMarker} (the factory's vocabulary, which the
// mock also speaks) onto a real lightweight-charts `SeriesMarker`, branding the
// epoch time. The factory builds the full payload (shape / position / text /
// colour / size); this is the single library-boundary narrowing.
function toMarker(marker: LwcMarker): SeriesMarker<Time> {
    return {
        time: toTime(marker.time),
        position: marker.position,
        shape: marker.shape,
        color: marker.color,
        ...(marker.text !== undefined ? { text: marker.text } : {}),
        ...(marker.size !== undefined ? { size: marker.size } : {}),
    };
}

// A dark chart theme so the native chart blends into the surrounding (dark)
// card instead of rendering lightweight-charts' default white-on-light theme,
// matching the dark palette the other reference adapters carry (echarts'
// `#0b0e11`). A TRANSPARENT background lets whatever card sits behind the
// chart-surface show through, so it blends regardless of the exact card
// colour. Colours are rgb / hex (NOT the brand `oklch` tokens): the library's
// own colour parser throws on `oklch(...)`, so feeding it the resolved CSS
// custom properties — which serialise back as `oklch` — would crash the chart.
const DARK_CHART_THEME = {
    background: "transparent",
    text: "#94a3b8",
    grid: "rgba(148, 163, 184, 0.12)",
    border: "rgba(148, 163, 184, 0.2)",
    // The bull / bear candle palette, matching the canvas2d reference adapter
    // (`palette.candleBullBody` / `candleBearBody`) so the two reference
    // adapters render the same green-up / red-down candles. Applied as
    // whole-series options on the Candlestick series (NOT per-point data), so
    // they live in this DOM-only block and never enter the recorded native-call
    // log — the pinned `MockLwcApi` goldens are untouched. A per-bar
    // `bar-color` / `bar-override` still overrides these on its own data point.
    candleBull: "#26a69a",
    candleBear: "#ef5350",
} as const;

function defaultCreateChart(container: HTMLElement): LwcChart {
    const chart = createChart(container, {
        layout: {
            background: { type: ColorType.Solid, color: DARK_CHART_THEME.background },
            textColor: DARK_CHART_THEME.text,
        },
        grid: {
            vertLines: { color: DARK_CHART_THEME.grid },
            horzLines: { color: DARK_CHART_THEME.grid },
        },
        rightPriceScale: { borderColor: DARK_CHART_THEME.border },
        timeScale: { borderColor: DARK_CHART_THEME.border },
    });
    // dblclick resets the time scale to fit all data, matching canvas2d's
    // dblclick-reset. DOM-bound (this whole block is `v8 ignore`d) so the
    // headless tests, which drive `opts.chartApi` directly, never reach it.
    container.addEventListener("dblclick", () => {
        chart.timeScale().resetTimeScale();
    });
    const wrap = (
        seriesType: string,
        options: Readonly<Record<string, unknown>>,
        paneIndex: number,
    ): LwcSeries => {
        const isCandlestick = seriesType === "Candlestick";
        // Default green-up / red-down candle colours (body + border + wick),
        // matching the canvas2d reference. A per-bar `bar-color` data point
        // overrides these for its own bar.
        const candleOptions = isCandlestick
            ? {
                  upColor: DARK_CHART_THEME.candleBull,
                  downColor: DARK_CHART_THEME.candleBear,
                  borderUpColor: DARK_CHART_THEME.candleBull,
                  borderDownColor: DARK_CHART_THEME.candleBear,
                  wickUpColor: DARK_CHART_THEME.candleBull,
                  wickDownColor: DARK_CHART_THEME.candleBear,
              }
            : {};
        // The caller's `options` (e.g. `{ color: plot.color }` from
        // `applyLineLikePlot`, `lineType` for step-lines) MUST flow through to
        // the real series — otherwise every line falls back to LC's default
        // series colour and the script's `plot(..., { color })` is ignored.
        // Caller options win over the candle defaults so an explicit override
        // still applies.
        const seriesOptions = { ...candleOptions, ...options };
        const series = chart.addSeries(SERIES_DEFINITION[seriesType], seriesOptions, paneIndex);
        return {
            setData: (data) =>
                isCandlestick
                    ? series.setData(
                          data.map((p) => ({
                              time: toTime(p.time),
                              open: p.open ?? 0,
                              high: p.high ?? 0,
                              low: p.low ?? 0,
                              close: p.close ?? 0,
                              // Per-bar `bar-color` recolours body + border +
                              // wick; `borderVisible: true` so the border shows.
                              ...(p.color !== undefined
                                  ? {
                                        color: p.color,
                                        borderColor: p.borderColor,
                                        wickColor: p.wickColor,
                                        borderVisible: true,
                                    }
                                  : {}),
                          })),
                      )
                    : series.setData(data.map((p) => ({ time: toTime(p.time), value: p.value }))),
            update: (point) =>
                isCandlestick
                    ? series.update({
                          time: toTime(point.time),
                          open: point.open ?? 0,
                          high: point.high ?? 0,
                          low: point.low ?? 0,
                          close: point.close ?? 0,
                          ...(point.color !== undefined
                              ? {
                                    color: point.color,
                                    borderColor: point.borderColor,
                                    wickColor: point.wickColor,
                                    borderVisible: true,
                                }
                              : {}),
                      })
                    : series.update({ time: toTime(point.time), value: point.value }),
            applyOptions: (options) => series.applyOptions(options),
            createPriceLine: (options) => series.createPriceLine({ price: options.price }),
            removePriceLine: (line) => series.removePriceLine(line as IPriceLine),
            setMarkers: (markers) => createSeriesMarkers(series, markers.map(toMarker)),
            attachPrimitive: (primitive) =>
                series.attachPrimitive(primitive as ISeriesPrimitive<Time>),
        };
    };
    return {
        addSeries: (seriesType, options, paneIndex = 0) => wrap(seriesType, options, paneIndex),
        addPane: () => {
            chart.addPane();
            // The new pane is the last one; its index is the prior count.
            return { paneIndex: chart.panes().length - 1 };
        },
        setVisibleLogicalRange: (range) => chart.timeScale().setVisibleLogicalRange(range),
        remove: () => chart.remove(),
    };
}
/* v8 ignore stop */

function paneSlotKey(paneKey: string, slotId: string): string {
    return `${paneKey}|${slotId}`;
}

// Resolve a `PlotEmission.pane` to a native pane index. `"overlay"` is always
// 0; `"new"` allocates a fresh pane via `chart.addPane()` each time it is
// seen; a named string is allocated a stable pane on first sight and reused.
function resolvePaneIndex(state: AdapterState, pane: string): number {
    if (pane === "overlay") return 0;
    if (pane === "new") return state.chart.addPane().paneIndex;
    const existing = state.paneIndex.get(pane);
    if (existing !== undefined) return existing;
    const index = state.chart.addPane().paneIndex;
    state.paneIndex.set(pane, index);
    return index;
}

const SERIES_TYPE_FOR_KIND: Readonly<Record<string, string>> = {
    line: "Line",
    "step-line": "Line",
    area: "Area",
    histogram: "Histogram",
};

// Convert a `#rgb` / `#rrggbb` hex colour to an `rgba()` string at the given
// alpha (the `area` fill gradient). A non-hex colour (a named colour, an
// existing rgba) is returned unchanged — the alpha can only fold into a
// parseable hex. A few-line convention copied (NOT cross-imported) from the
// uplot adapter's band fill, since cross-importing another example's `src/` is
// forbidden.
function hexToRgba(color: string, alpha: number): string {
    const hex = color.startsWith("#") ? color.slice(1) : "";
    const expand =
        hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;
    if (expand.length !== 6 || /[^0-9a-fA-F]/.test(expand)) return color;
    const r = Number.parseInt(expand.slice(0, 2), 16);
    const g = Number.parseInt(expand.slice(2, 4), 16);
    const b = Number.parseInt(expand.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// One numeric data point for a native line / area / histogram series. A
// non-finite value becomes a whitespace point (`{ time }` only) so the
// native series leaves a gap instead of drawing a break. An optional `color`
// is the per-point colour a `histogram` `colorValue` stamps (LC histogram
// points carry per-point colour, unlike line/area — see `applyHistogramPlot`).
function dataPoint(
    time: number,
    value: number | null,
    color?: string,
): { time: number; value?: number; color?: string } {
    if (value === null || !Number.isFinite(value)) return { time };
    return { time, value, ...(color !== undefined ? { color } : {}) };
}

// The base creation options shared by the single-series line path and the
// per-colour-run path: native step / curve `lineType` and the forwarded
// emission `lineWidth`. Extracted so the two paths build identical options
// (the run path only adds the per-run colour on top).
function baseLineOptions(plot: PlotEmission): Record<string, unknown> {
    const options: Record<string, unknown> = {};
    if (plot.style.kind === "step-line") {
        // Native step rendering: LineType.WithSteps === 1.
        options.lineType = 1;
    } else if (plot.style.kind === "line") {
        // Plain `line` plots render as a smooth curve (LineType.Curved === 2)
        // so an MA line reads as a curve rather than a faceted polyline; area
        // edges keep the default straight LineType.Simple.
        options.lineType = 2;
    }
    // Forward the emission's line width. lightweight-charts' default line width
    // is 3 (too thick vs the other adapters); the compiler default is 1, which
    // renders thin and consistent. Only the line-family styles (line / area /
    // step-line) carry `lineWidth` AND accept it as a series-creation option.
    if ("lineWidth" in plot.style) options.lineWidth = plot.style.lineWidth;
    return options;
}

// Fold a concrete run colour into the creation options for a line/area run
// series. `area` carries its colour as `lineColor` + a `topColor`→`bottomColor`
// `fillAlpha` gradient (reusing `hexToRgba`); line / step-line carry plain
// `color`. The base step/curve `lineType` + `lineWidth` ride along.
function runSeriesOptions(plot: PlotEmission, runColor: string): Record<string, unknown> {
    const options = baseLineOptions(plot);
    if (plot.style.kind === "area") {
        options.lineColor = runColor;
        options.topColor = hexToRgba(runColor, plot.style.fillAlpha);
        options.bottomColor = hexToRgba(runColor, 0);
    } else {
        options.color = runColor;
    }
    return options;
}

// The native time a plot point draws at once its universal `ta` `offset`
// (`plot.xShift`; `+n` right / future, `−n` left / past) is applied. LC is a
// native-time model: a `+5` copy renders five bar-spacings to the right of the
// unshifted point. Routes through the shared `shiftedBarTime` contract so the
// bar-offset math is defined once across every adapter. With `xShift` 0 /
// undefined `shiftedBarTime` returns the bar's own time, so a no-offset plot is
// byte-identical to `plot.time` (today's behaviour, untouched goldens).
function shiftedPlotTime(state: AdapterState, plot: PlotEmission): number {
    return shiftedBarTime({
        bars: state.bars,
        bar: plot.bar,
        xShift: plot.xShift,
        spacing: medianBarSpacing(state.bars),
    });
}

function getOrCreateSeries(
    state: AdapterState,
    plot: PlotEmission,
    seriesType: string,
    options: Readonly<Record<string, unknown>>,
): LwcSeries {
    const key = paneSlotKey(plot.pane, plot.slotId);
    const existing = state.series.get(key);
    if (existing !== undefined) return existing.series;
    const paneIndex = resolvePaneIndex(state, plot.pane);
    const series = state.chart.addSeries(seriesType, options, paneIndex);
    state.series.set(key, { series });
    return series;
}

function applyLineLikePlot(state: AdapterState, plot: PlotEmission, seriesType: string): void {
    // A `histogram` carries a per-point `colorValue` natively (LC histogram
    // points hold their own `color`), so it stays a SINGLE series and stamps
    // the resolved colour onto the data point — no run-splitting (each column
    // is independent). Line / step-line / area have no per-point colour, so a
    // `colorValue`-bearing emission takes the per-colour-run path instead.
    if (plot.colorValue !== undefined) {
        // Narrowed to `string | null` here — the 3-state per-bar dynamic colour.
        const colorValue = plot.colorValue;
        if (plot.style.kind === "histogram") {
            applyHistogramPlot(state, plot, seriesType, colorValue);
            return;
        }
        applyRunPlot(state, plot, seriesType, colorValue);
        return;
    }
    const options = baseLineOptions(plot);
    if (plot.style.kind === "area") {
        // The Area series carries its colour as `lineColor` (NOT `color`) and
        // its fill opacity as a top→bottom gradient: `fillAlpha` folds into
        // `topColor` / `bottomColor` (LC's gradient fill) so a translucent
        // `area` fill arrives instead of being dropped.
        if (plot.color !== null) {
            options.lineColor = plot.color;
            options.topColor = hexToRgba(plot.color, plot.style.fillAlpha);
            options.bottomColor = hexToRgba(plot.color, 0);
        }
    } else if (plot.color !== null) {
        options.color = plot.color;
    }
    const series = getOrCreateSeries(state, plot, seriesType, options);
    if (plot.visible === false) {
        series.applyOptions({ visible: false });
        return;
    }
    series.update(dataPoint(shiftedPlotTime(state, plot), plot.value));
}

// A `histogram` with a per-bar `colorValue`: a SINGLE native Histogram series
// whose data points carry their own `color` (LC's native per-point histogram
// colour, like candlesticks). The 3-state `colorValue` is `string | null` here
// (the caller only routes a `colorValue`-bearing emission in): `null` ⇒ a
// whitespace point (no column — the paint-nothing gap), a string ⇒ the column
// colour. The static `plot.color` rides at creation so the resting / default
// column colour is the script's static colour.
function applyHistogramPlot(
    state: AdapterState,
    plot: PlotEmission,
    seriesType: string,
    colorValue: string | null,
): void {
    const options = baseLineOptions(plot);
    if (plot.color !== null) options.color = plot.color;
    const series = getOrCreateSeries(state, plot, seriesType, options);
    if (plot.visible === false) {
        series.applyOptions({ visible: false });
        return;
    }
    const time = shiftedPlotTime(state, plot);
    if (colorValue === null) {
        series.update(dataPoint(time, null));
        return;
    }
    series.update(dataPoint(time, plot.value, colorValue));
}

// The per-colour-run path for line / step-line / area carrying a per-bar
// `colorValue`. LC line/area series hold a single creation-time colour with no
// per-point field, so a slot whose colour varies bar-to-bar is split into
// maximal same-colour RUNS, each its OWN native series. A run boundary
// duplicates the prior bar's point into the new series so the segments visually
// join (LC needs ≥2 points to draw a segment); a `colorValue:null` bar is a
// whitespace gap (the active run ends, no new series spans it). Strictly-
// increasing unique time per series holds because the boundary duplicate uses
// the PRIOR bar's (smaller) time.
function applyRunPlot(
    state: AdapterState,
    plot: PlotEmission,
    seriesType: string,
    colorValue: string | null,
): void {
    const key = paneSlotKey(plot.pane, plot.slotId);
    let slot = state.runSlots.get(key);
    if (slot === undefined) {
        slot = { series: [], activeColor: null, lastPoint: undefined };
        state.runSlots.set(key, slot);
    }
    if (plot.visible === false) {
        for (const s of slot.series) s.applyOptions({ visible: false });
        return;
    }
    const time = shiftedPlotTime(state, plot);
    if (colorValue === null) {
        // A gap bar: end the active run and span nothing. Clear `lastPoint` so
        // the next run does NOT duplicate a boundary across the gap, and reset
        // `activeColor` so the next finite bar always opens a fresh run series.
        slot.activeColor = null;
        slot.lastPoint = undefined;
        return;
    }
    let active = slot.series[slot.series.length - 1];
    if (active === undefined || colorValue !== slot.activeColor) {
        // Open a new run series at the resolved colour. Duplicate the prior
        // bar's point (if any, and not across a gap) so the segment joins.
        active = state.chart.addSeries(
            seriesType,
            runSeriesOptions(plot, colorValue),
            resolvePaneIndex(state, plot.pane),
        );
        slot.series.push(active);
        slot.activeColor = colorValue;
        if (slot.lastPoint !== undefined) {
            active.update(dataPoint(slot.lastPoint.time, slot.lastPoint.value));
        }
    }
    active.update(dataPoint(time, plot.value));
    // Track the boundary point only when finite — a non-finite value is itself
    // a whitespace gap and must not be duplicated into a later run.
    slot.lastPoint =
        plot.value === null || !Number.isFinite(plot.value)
            ? undefined
            : { time, value: plot.value };
}

// `style` is passed already narrowed by the caller so the upper / lower edge
// values are reachable without re-discriminating here (no dead guard arm).
function applyFilledBand(
    state: AdapterState,
    plot: PlotEmission,
    style: Extract<PlotEmission["style"], { kind: "filled-band" }>,
): void {
    const key = paneSlotKey(plot.pane, plot.slotId);
    let entry = state.series.get(key);
    if (entry === undefined) {
        const paneIndex = resolvePaneIndex(state, plot.pane);
        // Two native line series (upper + lower), BOTH carrying the emission's
        // `plot.color` (mirrors `applyLineLikePlot` — the same colour-drop the
        // line path had). The fill BETWEEN them is a Task-6 drawing carrying
        // the band `alpha` (LC line series have no fill of their own).
        const edgeOptions: Record<string, unknown> = {};
        if (plot.color !== null) edgeOptions.color = plot.color;
        const upper = state.chart.addSeries("Line", edgeOptions, paneIndex);
        const lower = state.chart.addSeries("Line", edgeOptions, paneIndex);
        entry = { series: upper, lower };
        state.series.set(key, entry);
    }
    if (plot.visible === false) {
        entry.series.applyOptions({ visible: false });
        entry.lower?.applyOptions({ visible: false });
        return;
    }
    const shiftedTime = shiftedPlotTime(state, plot);
    entry.series.update(dataPoint(shiftedTime, style.upper));
    entry.lower?.update(dataPoint(shiftedTime, style.lower));
}

function removePriceLine(state: AdapterState, key: string): void {
    const existing = state.priceLines.get(key);
    if (existing === undefined) return;
    existing.anchor.removePriceLine(existing.line);
    state.priceLines.delete(key);
}

function applyHorizontalLine(state: AdapterState, plot: PlotEmission): void {
    // The runtime re-emits a `horizontal-line` slot every bar. LC has no
    // price-line dedup, so creating one per emission would stack N overlapping
    // native lines. Track the line per `${pane}|${slotId}` and re-price the
    // SAME handle on re-sight; remove it when the slot is hidden / gone.
    const key = paneSlotKey(plot.pane, plot.slotId);
    if (plot.visible === false) {
        removePriceLine(state, key);
        return;
    }
    const price = plot.value ?? 0;
    const existing = state.priceLines.get(key);
    if (existing !== undefined) {
        existing.line.applyOptions({ price });
        return;
    }
    // First sight: anchor a native price line on the pane's candle series
    // (overlay) or the pane's first series. If neither exists yet there is
    // nothing to attach to this frame — a no-op (re-tried next bar).
    const anchor =
        plot.pane === "overlay" ? state.candleSeries : firstSeriesInPane(state, plot.pane);
    if (anchor === undefined) return;
    const line = anchor.createPriceLine({ price });
    state.priceLines.set(key, { line, anchor });
}

function firstSeriesInPane(state: AdapterState, pane: string): LwcSeries | undefined {
    const prefix = `${pane}|`;
    for (const [key, entry] of state.series) {
        if (key.startsWith(prefix)) return entry.series;
    }
    return undefined;
}

// The glyph's top-level emission colour (`plot.color`); a `null` falls back to
// the default glyph blue (parity with the canvas-family glyph helper's
// fallback). Native markers require a concrete `string` colour.
const GLYPH_DEFAULT_COLOR = "#3b82f6";

// The five glyph plot styles `applyGlyph` dispatches.
type GlyphStyle = Extract<
    PlotEmission["style"],
    { kind: "shape" | "character" | "arrow" | "marker" | "label" }
>;

// Resolve a glyph's `location` (`shape` / `character`) or `position` (`label`)
// to a native marker position. `above`→`aboveBar`, `below`→`belowBar`, else
// `inBar` (the `absolute` / `anchor` / omitted default). `arrow` / `marker`
// carry no vertical anchor and never reach here.
function glyphPosition(style: GlyphStyle): "aboveBar" | "belowBar" | "inBar" {
    const anchor =
        style.kind === "label"
            ? style.position
            : style.kind === "shape" || style.kind === "character"
              ? style.location
              : undefined;
    if (anchor === "above") return "aboveBar";
    if (anchor === "below") return "belowBar";
    return "inBar";
}

// Build the native {@link LwcMarker} for a glyph LC's plugin CAN express
// (`circle` / `square` shapes carrying the `character` char / `label` text as
// marker text, `arrow` → `arrowUp` / `arrowDown`). Only the native-routed
// glyphs reach here (the caller diverts the overlay shapes first), so the
// `shape` / `marker` arm's shape is always `circle` / `square`.
function buildNativeMarker(style: GlyphStyle, color: string, time: number): LwcMarker {
    switch (style.kind) {
        case "arrow":
            return {
                time,
                shape: style.direction === "up" ? "arrowUp" : "arrowDown",
                position: style.direction === "up" ? "belowBar" : "aboveBar",
                color,
                size: style.size,
            };
        case "marker":
        case "shape":
            return {
                time,
                // The caller only routes circle / square here; any other shape
                // would have taken the overlay path. Fall back to `circle`
                // defensively so the type stays the native vocabulary.
                shape: style.shape === "square" ? "square" : "circle",
                position: glyphPosition(style),
                color,
                size: style.size,
            };
        case "character":
            return {
                time,
                shape: "circle",
                position: glyphPosition(style),
                color,
                text: style.char,
                size: style.size,
            };
        case "label":
            return {
                time,
                shape: "circle",
                position: glyphPosition(style),
                color,
                text: style.text,
            };
    }
}

// A `shape` / `marker` glyph whose shape LC's native plugin cannot express
// (triangle / diamond / cross / xcross / flag) takes the canvas overlay. The
// type guard narrows the style to the overlay-routable `GlyphMark` shape.
function isOverlayGlyph(style: GlyphStyle): style is GlyphMark["style"] {
    return (
        (style.kind === "shape" || style.kind === "marker") &&
        style.shape !== "circle" &&
        style.shape !== "square"
    );
}

// Route a glyph emission (shape / character / arrow / marker / label): the
// canvas overlay via the shared adapter-kit glyph helper where LC's v5 markers
// plugin cannot express the shape, else a native LC marker. With no candle
// series yet (empty stream) there is nothing to anchor a native marker on — a
// no-op for this frame (the overlay buffers regardless). The glyph shifts at
// its `xShift` for parity with the other adapters.
function applyGlyph(state: AdapterState, plot: PlotEmission, style: GlyphStyle): void {
    if (plot.value === null || !Number.isFinite(plot.value)) return;
    const time = shiftedPlotTime(state, plot);
    if (isOverlayGlyph(style)) {
        // Buffer the resolved mark (last-write-wins per slot) for the attached
        // `DrawingPrimitive` to paint via the shared helper next frame, and
        // stamp its z-sort key (glyph band; `z` off the emission; fresh `seq`).
        const slotKey = paneSlotKey(plot.pane, plot.slotId);
        state.glyphs.set(slotKey, {
            time,
            value: plot.value,
            color: plot.color,
            style,
        });
        state.glyphKeys.set(slotKey, {
            z: plot.z ?? 0,
            band: RENDER_BAND.glyph,
            seq: state.seq++,
        });
        return;
    }
    if (state.candleSeries === undefined) return;
    state.candleSeries.setMarkers([
        buildNativeMarker(style, plot.color ?? GLYPH_DEFAULT_COLOR, time),
    ]);
}

// Per-bar `candle-override`: stamp the bull / bear / doji palette keyed by bar
// time, resolved to a single colour by the bar's own direction in `candleData`
// (the SAME per-point colour path `bar-color` uses). No candle series yet →
// nothing to stamp; the candle for `plot.time` was already drawn this frame
// (before the drain), so re-`update` it to apply.
function applyCandleOverride(
    state: AdapterState,
    plot: PlotEmission,
    palette: CandleOverridePalette,
): void {
    if (state.candleSeries === undefined) return;
    state.candleOverrides.set(plot.time, palette);
    const target = state.bars.find((b) => b.time === plot.time);
    if (target === undefined) return;
    state.candleSeries.update(candleData(state, target));
}

// Per-bar `bar-color` / `bar-override`: stamp the resolved colour onto the
// candlestick DATA POINT for this bar (body + border + wick recolour via LC's
// native per-point colour fields). The colour resolves `colorValue ?? color`
// (the dynamic-colour precedence): `colorValue` present overrides the static
// `color`; `colorValue === null` CLEARS the override (no colour this bar);
// `colorValue` omitted uses the static `color`. The candle for `plot.time` was
// already drawn this frame (before the drain), so we re-`update` it to apply.
function applyBarColor(state: AdapterState, plot: PlotEmission, color: string): void {
    if (state.candleSeries === undefined) return;
    const resolved = plot.colorValue === undefined ? color : plot.colorValue;
    if (resolved === null) {
        state.barColors.delete(plot.time);
    } else {
        state.barColors.set(plot.time, resolved);
    }
    const target = state.bars.find((b) => b.time === plot.time);
    if (target === undefined) return;
    state.candleSeries.update(candleData(state, target));
}

function applyPlot(state: AdapterState, plot: PlotEmission): void {
    const seriesType = SERIES_TYPE_FOR_KIND[plot.style.kind];
    if (seriesType !== undefined) {
        applyLineLikePlot(state, plot, seriesType);
        return;
    }
    switch (plot.style.kind) {
        case "filled-band":
            applyFilledBand(state, plot, plot.style);
            return;
        case "horizontal-line":
            applyHorizontalLine(state, plot);
            return;
        case "shape":
        case "character":
        case "arrow":
        case "marker":
        case "label":
            applyGlyph(state, plot, plot.style);
            return;
        case "candle-override":
            applyCandleOverride(state, plot, {
                bull: plot.style.bull,
                bear: plot.style.bear,
                ...(plot.style.doji !== undefined ? { doji: plot.style.doji } : {}),
            });
            return;
        case "bar-override":
        case "bar-color":
            applyBarColor(state, plot, plot.style.color);
            return;
        case "bg-color":
            applyBgColor(state, plot, plot.style.color, plot.style.transp);
            return;
        case "horizontal-histogram":
            // No native facility — deferred to a Task-6 primitive. Declared in
            // the capability surface; a documented no-op here.
            return;
    }
}

// Per-bar `bg-color`: buffer a background band (a full-pane-height stripe the
// `DrawingPrimitive` overlay paints) keyed `${pane}|${slotId}|${time}` so a
// multi-bar bg-color slot keeps one stripe per bar. The 3-state `colorValue`
// resolves the colour: `colorValue` present OVERRIDES the static `style.color`;
// `colorValue === null` is the explicit "no band this bar" gap (delete the
// key); omitted uses the static `style.color`. `transp` (0–100) is carried
// through and folds into the stripe opacity at paint. The band's stripe width
// is the run's median bar spacing (so it scales with the data), resolved here.
function applyBgColor(
    state: AdapterState,
    plot: PlotEmission,
    color: string,
    transp: number | undefined,
): void {
    const key = `${paneSlotKey(plot.pane, plot.slotId)}|${plot.time}`;
    const resolved = plot.colorValue === undefined ? color : plot.colorValue;
    if (resolved === null) {
        state.bgBands.delete(key);
        return;
    }
    state.bgBands.set(key, {
        time: plot.time,
        color: resolved,
        ...(transp === undefined ? {} : { transp }),
        spacing: medianBarSpacing(state.bars),
        z: plot.z ?? 0,
        band: RENDER_BAND.drawing,
        seq: state.seq++,
    });
}

function applyAlert(
    state: AdapterState,
    alert: AlertEmission,
    onAlert?: (a: AlertEmission) => void,
): void {
    state.recentAlerts.push(alert);
    while (state.recentAlerts.length > MAX_RECENT_ALERTS) {
        state.recentAlerts.shift();
    }
    onAlert?.(alert);
}

function applyDrawing(state: AdapterState, drawing: DrawingEmission): void {
    // Buffered into the live drawings map the attached `DrawingPrimitive` reads
    // each frame. `op: "remove"` drops the key so it vanishes next paint.
    if (drawing.op === "remove") {
        state.drawings.delete(drawing.handleId);
        state.drawingKeys.delete(drawing.handleId);
        return;
    }
    state.drawings.set(drawing.handleId, drawing);
    // Stamp the z-sort key (drawing band; `z` off the emission; a fresh `seq`)
    // in lockstep so the overlay z-pass orders this drawing deterministically.
    state.drawingKeys.set(drawing.handleId, {
        z: drawing.z ?? 0,
        band: RENDER_BAND.drawing,
        seq: state.seq++,
    });
}

function applyValidated<T>(items: ReadonlyArray<T>, apply: (item: T) => void): void {
    for (const item of items) {
        if (validateEmission(item).ok) apply(item);
    }
}

function ingest(
    state: AdapterState,
    emissions: RunnerEmissions,
    onAlert?: (a: AlertEmission) => void,
): void {
    applyValidated(emissions.plots, (plot) => applyPlot(state, plot));
    applyValidated(emissions.drawings, (drawing) => applyDrawing(state, drawing));
    applyValidated(emissions.alerts, (alert) => applyAlert(state, alert, onAlert));
    state.currentAlertConditions.length = 0;
    applyValidated(emissions.alertConditions, (condition) =>
        state.currentAlertConditions.push(condition),
    );
    applyValidated(emissions.logs, (log) => applyLog(state, log));
    for (const d of emissions.diagnostics) {
        if (d.severity === "warning" || d.severity === "error") {
            console.warn(`[chartlang ${d.code}]`, d.message);
        }
    }
}

function applyLog(state: AdapterState, log: LogEmission): void {
    state.recentLogs.push(log);
    while (state.recentLogs.length > 5) {
        state.recentLogs.shift();
    }
}

function ensureCandleSeries(state: AdapterState): LwcSeries {
    if (state.candleSeries !== undefined) return state.candleSeries;
    const series = state.chart.addSeries("Candlestick", {}, 0);
    state.candleSeries = series;
    // Anchor the drawing overlay on the overlay candle series the first time it
    // exists. The primitive reads the live overlay buffers each frame — drawings
    // + bg-color bands + overlay glyphs (z-sorted), then the always-on-top alert
    // + log panels — so later emissions need no re-attach. Structurally an
    // `ISeriesPrimitive`.
    const overlay: OverlayBuffers = {
        drawings: state.drawings,
        glyphs: state.glyphs,
        drawingKeys: state.drawingKeys,
        glyphKeys: state.glyphKeys,
        bgBands: state.bgBands,
        alertConditions: state.currentAlertConditions,
        logs: state.recentLogs,
    };
    series.attachPrimitive(new DrawingPrimitive(state.drawings, state.glyphs, overlay));
    return series;
}

type CandlePoint = {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    color?: string;
    borderColor?: string;
    wickColor?: string;
};

function candleData(state: AdapterState, bar: Bar): CandlePoint {
    // A lightweight-charts Candlestick series requires all four OHLC fields.
    // IMPORTANT: passing only `value` (the old behaviour) caused LC to read
    // `open` as undefined and throw "Value is undefined" at runtime.
    const point: CandlePoint = {
        time: bar.time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
    };
    // Resolve the per-bar colour: a `bar-color` / `bar-override` override wins
    // (it paints ON TOP of the candle), else a `candle-override` palette
    // resolved by the bar's own direction. Whichever wins recolours the body
    // AND border AND wick — LC's native per-point colour fields.
    const resolved = resolveCandleColor(state, bar);
    if (resolved !== undefined) {
        point.color = resolved;
        point.borderColor = resolved;
        point.wickColor = resolved;
    }
    return point;
}

// The single per-bar candle colour, with precedence `bar-color` /
// `bar-override` > `candle-override`. A `bar-color` override paints on top of
// the candle, so it wins; a `candle-override` is the candle's own body colour,
// picked from its bull / bear / doji palette by the bar's direction
// (`close > open ⇒ bull`, `< ⇒ bear`, else `doji ?? bull`). `undefined` ⇒ the
// default bull / bear theme (no per-point colour).
function resolveCandleColor(state: AdapterState, bar: Bar): string | undefined {
    const barOverride = state.barColors.get(bar.time);
    if (barOverride !== undefined) return barOverride;
    const palette = state.candleOverrides.get(bar.time);
    if (palette === undefined) return undefined;
    if (bar.close > bar.open) return palette.bull;
    if (bar.close < bar.open) return palette.bear;
    return palette.doji ?? palette.bull;
}

// Frame the time scale onto the most recent `initialVisibleBars` bars the
// FIRST time data is present. Guarded by `state.hasFramedInitial` so it fires
// exactly once — later live-bar updates and any user pan/zoom are never
// re-framed. With `initialVisibleBars` undefined this is a no-op (the library's
// default auto-fit / `fitContent` stands, unchanged behaviour).
function frameInitialWindow(state: AdapterState): void {
    if (state.hasFramedInitial) return;
    const len = state.bars.length;
    if (len === 0) return;
    state.hasFramedInitial = true;
    const visible = state.initialVisibleBars;
    if (visible === undefined) return;
    const from = Math.max(0, len - visible);
    const to = len - 1;
    state.chart.setVisibleLogicalRange({ from, to });
}

function applyCandleEvent(state: AdapterState, event: CandleEvent): void {
    if (event.streamKey !== undefined) return;
    const series = ensureCandleSeries(state);
    if (event.kind === "history") {
        state.bars.push(...event.bars);
        series.setData(event.bars.map((b) => candleData(state, b)));
        frameInitialWindow(state);
        return;
    }
    if (event.kind === "close") {
        state.bars.push(event.bar);
        series.update(candleData(state, event.bar));
        frameInitialWindow(state);
        return;
    }
    if (state.bars.length === 0) {
        state.bars.push(event.bar);
    } else {
        state.bars[state.bars.length - 1] = event.bar;
    }
    series.update(candleData(state, event.bar));
    frameInitialWindow(state);
}

/**
 * Build a frozen lightweight-charts reference adapter. Wires a chart
 * (a real `IChartApi` in a browser, or an injected {@link LwcChart} mock in
 * tests), a candle source, the adapter-kit `defineAdapter` factory, and a
 * worker host into one object. The returned `host` is exposed so the consumer
 * can `await adapter.host.load(compiled)` before driving the candle source.
 *
 * Candles, plots, horizontal lines and panes map onto lightweight-charts'
 * NATIVE series / pane facilities (see the file-header mapping). Drawings paint
 * through an attached {@link DrawingPrimitive} overlay (`decomposeDrawing` +
 * the shared canvas sink).
 *
 * @since 1.4
 * @stable
 * @example
 *     import { createLightweightChartsAdapter } from "chartlang-example-lightweight-charts-adapter";
 *     import { MockLwcApi } from "chartlang-example-lightweight-charts-adapter/testing";
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     const adapter = createLightweightChartsAdapter({
 *         chartApi: new MockLwcApi(),
 *         candleSource: mockCandleSource([]),
 *     });
 *     void adapter;
 */
export function createLightweightChartsAdapter(
    opts: CreateLightweightChartsAdapterOpts,
): LwcAdapterHandle {
    const capabilities = opts.capabilities ?? LWC_CAPABILITIES;
    const chart = resolveChartApi(opts);
    const state: AdapterState = {
        chart,
        bars: [],
        paneIndex: new Map(),
        series: new Map(),
        runSlots: new Map(),
        priceLines: new Map(),
        candleSeries: undefined,
        barColors: new Map(),
        candleOverrides: new Map(),
        glyphs: new Map(),
        recentAlerts: [],
        currentAlertConditions: [],
        recentLogs: [],
        drawings: new Map(),
        bgBands: new Map(),
        drawingKeys: new Map(),
        glyphKeys: new Map(),
        seq: 0,
        ...(opts.initialVisibleBars !== undefined
            ? { initialVisibleBars: opts.initialVisibleBars }
            : {}),
        hasFramedInitial: false,
    };
    const host =
        opts.host ??
        createWorkerHost(
            opts.workerLike !== undefined
                ? {
                      capabilities,
                      symInfo: LWC_SYM_INFO,
                      ...(opts.resolveInputs !== undefined
                          ? { resolveInputs: opts.resolveInputs }
                          : {}),
                      workerLike: opts.workerLike,
                  }
                : {
                      capabilities,
                      symInfo: LWC_SYM_INFO,
                      ...(opts.resolveInputs !== undefined
                          ? { resolveInputs: opts.resolveInputs }
                          : {}),
                  },
        );

    const adapter = defineAdapter({
        id: "lightweight-charts-reference",
        name: "Lightweight Charts Reference Adapter",
        capabilities,
        ...(opts.resolveInputs !== undefined ? { resolveInputs: opts.resolveInputs } : {}),
        symInfo: LWC_SYM_INFO,
        candles: () => opts.candleSource,
        onEmissions: (emissions) => ingest(state, emissions, opts.onAlert),
        dispose: () => {
            state.bars.length = 0;
            state.paneIndex.clear();
            state.series.clear();
            state.runSlots.clear();
            // The chart's `remove()` below tears down its series + price lines;
            // dropping our references is enough (no per-line removePriceLine).
            state.priceLines.clear();
            state.candleSeries = undefined;
            state.barColors.clear();
            state.candleOverrides.clear();
            state.glyphs.clear();
            state.recentAlerts.length = 0;
            state.currentAlertConditions.length = 0;
            state.recentLogs.length = 0;
            state.drawings.clear();
            state.bgBands.clear();
            state.drawingKeys.clear();
            state.glyphKeys.clear();
            state.seq = 0;
            state.hasFramedInitial = false;
            state.chart.remove();
            host.dispose();
        },
    });

    const handle: LwcAdapterHandle = Object.freeze({ ...adapter, host });
    HANDLE_STATE.set(handle, state);
    HANDLE_INTERVAL.set(handle, opts.interval ?? DEFAULT_INTERVAL);
    return handle;
}

/**
 * Optional second argument for {@link runRendererLoop}. Pass a `signal` from
 * an `AbortController` to cancel the loop cleanly: once the signal aborts the
 * loop drops the remaining work and resolves (no throw), matching the
 * canvas2d adapter's cancellation contract.
 *
 * @since 1.4
 * @stable
 * @example
 *     const opts: RunRendererLoopOpts = { signal: new AbortController().signal };
 *     void opts;
 */
export type RunRendererLoopOpts = Readonly<{
    signal?: AbortSignal;
}>;

/**
 * Drive a built adapter through one full pass of its candle source: iterate
 * the events, mirror each into the native chart + bar window, `await
 * host.push(event)`, then `host.drain()` + `adapter.onEmissions(...)` between
 * events. Returns when the source completes; throws whatever the source /
 * host throws. Pass `opts.signal` to cancel cleanly (returns silently on
 * abort).
 *
 * @since 1.4
 * @stable
 * @example
 *     import { createLightweightChartsAdapter, runRendererLoop } from "chartlang-example-lightweight-charts-adapter";
 *     import { MockLwcApi } from "chartlang-example-lightweight-charts-adapter/testing";
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     const adapter = createLightweightChartsAdapter({
 *         chartApi: new MockLwcApi(),
 *         candleSource: mockCandleSource([]),
 *     });
 *     // await adapter.host.load(compiled);
 *     // await runRendererLoop(adapter);
 *     const fn: typeof runRendererLoop = runRendererLoop;
 *     void fn;
 */
export async function runRendererLoop(
    handle: LwcAdapterHandle,
    opts: RunRendererLoopOpts = {},
): Promise<void> {
    const state = HANDLE_STATE.get(handle);
    const interval = HANDLE_INTERVAL.get(handle);
    if (state === undefined || interval === undefined) {
        throw new Error(
            "runRendererLoop: handle was not produced by createLightweightChartsAdapter",
        );
    }
    const signal = opts.signal;
    const aborted = (): boolean => signal?.aborted ?? false;
    if (aborted()) return;
    for await (const event of handle.candles({ interval })) {
        if (aborted()) return;
        applyCandleEvent(state, event);
        await handle.host.push(event);
        if (aborted()) return;
        // Yield once so an async worker host can complete its candle-event
        // dispatch before the drain frame is processed (matches canvas2d).
        await new Promise<void>((r) => setTimeout(r, 0));
        if (aborted()) return;
        const emissions = await handle.host.drain();
        if (aborted()) return;
        handle.onEmissions(emissions);
    }
}
