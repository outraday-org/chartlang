// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { DRAWING_KINDS } from "@invinite-org/chartlang-core";

import type { DrawingCounts, IntervalDescriptor } from "@invinite-org/chartlang-core";

import type { AlertChannel, DrawingKind, PlotKind, SymInfoField } from "../types.js";

/**
 * Canonical Phase-5 plot-kind set. Adapters that can render the full
 * script-facing plot inventory can pass this directly to
 * `Capabilities.plots`.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { PHASE_5_PLOT_KINDS } from "@invinite-org/chartlang-adapter-kit";
 *     const plots = new Set(PHASE_5_PLOT_KINDS);
 *     void plots;
 */
export const PHASE_5_PLOT_KINDS: ReadonlyArray<PlotKind> = Object.freeze([
    "line",
    "step-line",
    "horizontal-line",
    "histogram",
    "area",
    "filled-band",
    "label",
    "marker",
    "shape",
    "character",
    "arrow",
    "candle-override",
    "bar-override",
    "bg-color",
    "bar-color",
    "horizontal-histogram",
]);

/**
 * Helpers that assemble the `ReadonlySet` pieces of a `Capabilities`
 * bag. Phase 1 shipped the three line variants + an alert-channel
 * builder + a generic `union` combinator. Phase 2 adds one builder per
 * new `PlotKind` (`histogram`, `area`, `filledBand`, `label`,
 * `marker`) plus `allPhase2Plots()` — the union of every Phase-1 +
 * Phase-2 kind.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { capabilities } from "@invinite-org/chartlang-adapter-kit";
 *
 *     const plots = capabilities.allPhase2Plots();
 *     const alerts = capabilities.alerts("toast", "log");
 *     const merged = capabilities.union(plots, capabilities.label());
 *     void merged;
 */
export const capabilities = {
    line(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["line"]);
    },
    stepLine(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["step-line"]);
    },
    horizontalLine(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["horizontal-line"]);
    },
    allLines(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["line", "step-line", "horizontal-line"]);
    },
    /** Phase-2 histogram plot kind. @since 0.2 @stable */
    histogram(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["histogram"]);
    },
    /** Phase-2 filled-area plot kind. @since 0.2 @stable */
    area(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["area"]);
    },
    /** Phase-2 filled-band (between two polylines) plot kind.
     *  @since 0.2 @stable */
    filledBand(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["filled-band"]);
    },
    /** Phase-2 text-label plot kind. @since 0.2 @stable */
    label(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["label"]);
    },
    /** Phase-2 discrete-marker plot kind. @since 0.2 @stable */
    marker(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["marker"]);
    },
    /** Union of every plot kind that ships through Phase 2 — `line`,
     *  `step-line`, `horizontal-line`, `histogram`, `area`,
     *  `filled-band`, `label`, `marker`. Phase-5 kinds are deliberately
     *  excluded; the bundled `capabilities.union(...)` combinator
     *  composes additional sets when needed.
     *  @since 0.2 @stable */
    allPhase2Plots(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>([
            "line",
            "step-line",
            "horizontal-line",
            "histogram",
            "area",
            "filled-band",
            "label",
            "marker",
        ]);
    },
    /** Union of every plot kind that ships through Phase 5.
     *  @since 0.5 @stable */
    allPhase5Plots(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(PHASE_5_PLOT_KINDS);
    },
    alerts(...channels: ReadonlyArray<AlertChannel>): ReadonlySet<AlertChannel> {
        return new Set<AlertChannel>(channels);
    },
    union<T>(...sets: ReadonlyArray<ReadonlySet<T>>): ReadonlySet<T> {
        const out = new Set<T>();
        for (const s of sets) {
            for (const v of s) {
                out.add(v);
            }
        }
        return out;
    },
    /**
     * Timeframe descriptors this adapter can deliver, preserving picker order.
     *
     * @since 0.4
     * @stable
     * @example
     *     import { capabilities } from "@invinite-org/chartlang-adapter-kit";
     *
     *     const partial = capabilities.intervals([
     *         { value: "1D", label: "1 day", group: "daily" },
     *     ]);
     *     void partial;
     */
    intervals(list: ReadonlyArray<IntervalDescriptor>): {
        intervals: ReadonlyArray<IntervalDescriptor>;
    } {
        return { intervals: Object.freeze(list.slice()) };
    },
    /**
     * Declares whether the adapter can deliver secondary candle streams.
     *
     * @since 0.4
     * @stable
     * @example
     *     import { capabilities } from "@invinite-org/chartlang-adapter-kit";
     *
     *     const partial = capabilities.multiTimeframe(false);
     *     void partial;
     */
    multiTimeframe(enabled: boolean): { multiTimeframe: boolean } {
        return { multiTimeframe: enabled };
    },
    /**
     * Declares whether the adapter can deliver candle streams for a symbol
     * other than the chart's own. Independent of `multiTimeframe` — setting one
     * does not imply the other.
     *
     * @since 1.6
     * @stable
     * @example
     *     import { capabilities } from "@invinite-org/chartlang-adapter-kit";
     *
     *     const partial = capabilities.multiSymbol(false);
     *     void partial;
     */
    multiSymbol(enabled: boolean): { multiSymbol: boolean } {
        return { multiSymbol: enabled };
    },
    /**
     * Declares the maximum supported sub-pane count for one script.
     *
     * @since 0.4
     * @stable
     * @example
     *     import { capabilities } from "@invinite-org/chartlang-adapter-kit";
     *
     *     const partial = capabilities.subPanes(Number.MAX_SAFE_INTEGER);
     *     void partial;
     */
    subPanes(max: number): { subPanes: number } {
        return { subPanes: max };
    },
    /**
     * Declares which `syminfo.*` fields this adapter populates.
     *
     * @since 0.4
     * @stable
     * @example
     *     import { capabilities } from "@invinite-org/chartlang-adapter-kit";
     *
     *     const partial = capabilities.symInfoFields(["ticker", "mintick"]);
     *     void partial;
     */
    symInfoFields(fields: ReadonlyArray<SymInfoField>): {
        symInfoFields: ReadonlySet<SymInfoField>;
    } {
        return { symInfoFields: new Set(fields) };
    },
    /**
     * Declares the adapter's per-script drawing-emission budget.
     *
     * @since 0.4
     * @stable
     * @example
     *     import { capabilities } from "@invinite-org/chartlang-adapter-kit";
     *
     *     const partial = capabilities.maxDrawingsPerScript({
     *         lines: 50, labels: 50, boxes: 50, polylines: 50, other: 50,
     *     });
     *     void partial;
     */
    maxDrawingsPerScript(counts: DrawingCounts): { maxDrawingsPerScript: DrawingCounts } {
        return { maxDrawingsPerScript: Object.freeze({ ...counts }) };
    },
    /**
     * Declares whether user-wired alert conditions are supported.
     *
     * @since 0.4
     * @stable
     * @example
     *     import { capabilities } from "@invinite-org/chartlang-adapter-kit";
     *
     *     const partial = capabilities.alertConditions(false);
     *     void partial;
     */
    alertConditions(enabled: boolean): { alertConditions: boolean } {
        return { alertConditions: enabled };
    },
    /**
     * Declares whether runtime log messages are rendered by the adapter.
     *
     * @since 0.4
     * @stable
     * @example
     *     import { capabilities } from "@invinite-org/chartlang-adapter-kit";
     *
     *     const partial = capabilities.logs(false);
     *     void partial;
     */
    logs(enabled: boolean): { logs: boolean } {
        return { logs: enabled };
    },

    // ------------------------------------------------------------
    // Phase 3 — per-kind drawing builders (62, incl. the Phase-2
    // `fill-between` ribbon). Each returns a
    // single-element `Set<DrawingKind>` so adapters can compose via
    // `capabilities.union(...)`. The 13 category-group builders +
    // `allPhase3Drawings()` below are the canonical user-facing
    // surface; per-kind builders exist for precision opt-in.
    // @since 0.3 @stable
    // ------------------------------------------------------------

    /** Phase-3 `line` drawing kind. @since 0.3 @stable */
    drawLine(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["line"]);
    },
    /** Phase-3 `horizontal-line` drawing kind. @since 0.3 @stable */
    drawHorizontalLine(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["horizontal-line"]);
    },
    /** Phase-3 `horizontal-ray` drawing kind. @since 0.3 @stable */
    drawHorizontalRay(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["horizontal-ray"]);
    },
    /** Phase-3 `vertical-line` drawing kind. @since 0.3 @stable */
    drawVerticalLine(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["vertical-line"]);
    },
    /** Phase-3 `cross-line` drawing kind. @since 0.3 @stable */
    drawCrossLine(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["cross-line"]);
    },
    /** Phase-3 `trend-angle` drawing kind. @since 0.3 @stable */
    drawTrendAngle(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["trend-angle"]);
    },
    /** Phase-3 `rectangle` drawing kind. @since 0.3 @stable */
    drawRectangle(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["rectangle"]);
    },
    /** Phase-3 `rotated-rectangle` drawing kind. @since 0.3 @stable */
    drawRotatedRectangle(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["rotated-rectangle"]);
    },
    /** Phase-3 `triangle` drawing kind. @since 0.3 @stable */
    drawTriangle(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["triangle"]);
    },
    /** Phase-3 `polyline` drawing kind. @since 0.3 @stable */
    drawPolyline(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["polyline"]);
    },
    /** Phase-3 `circle` drawing kind. @since 0.3 @stable */
    drawCircle(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["circle"]);
    },
    /** Phase-3 `ellipse` drawing kind. @since 0.3 @stable */
    drawEllipse(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["ellipse"]);
    },
    /** Phase-3 `path` drawing kind. @since 0.3 @stable */
    drawPath(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["path"]);
    },
    /** `fill-between` filled-ribbon drawing kind. @since 0.4 @stable */
    drawFillBetween(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["fill-between"]);
    },
    /** Phase-3 `marker` drawing kind. @since 0.3 @stable */
    drawMarker(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["marker"]);
    },
    /** Phase-3 `arc` drawing kind. @since 0.3 @stable */
    drawArc(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["arc"]);
    },
    /** Phase-3 `curve` drawing kind. @since 0.3 @stable */
    drawCurve(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["curve"]);
    },
    /** Phase-3 `double-curve` drawing kind. @since 0.3 @stable */
    drawDoubleCurve(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["double-curve"]);
    },
    /** Phase-3 `pen` drawing kind. @since 0.3 @stable */
    drawPen(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["pen"]);
    },
    /** Phase-3 `highlighter` drawing kind. @since 0.3 @stable */
    drawHighlighter(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["highlighter"]);
    },
    /** Phase-3 `brush` drawing kind. @since 0.3 @stable */
    drawBrush(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["brush"]);
    },
    /** Phase-3 `text` drawing kind. @since 0.3 @stable */
    drawText(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["text"]);
    },
    /** Phase-3 `arrow` drawing kind. @since 0.3 @stable */
    drawArrow(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["arrow"]);
    },
    /** Phase-3 `arrow-marker` drawing kind. @since 0.3 @stable */
    drawArrowMarker(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["arrow-marker"]);
    },
    /** Phase-3 `arrow-mark-up` drawing kind. @since 0.3 @stable */
    drawArrowMarkUp(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["arrow-mark-up"]);
    },
    /** Phase-3 `arrow-mark-down` drawing kind. @since 0.3 @stable */
    drawArrowMarkDown(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["arrow-mark-down"]);
    },
    /** Phase-3 `trend-channel` drawing kind. @since 0.3 @stable */
    drawTrendChannel(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["trend-channel"]);
    },
    /** Phase-3 `flat-top-bottom` drawing kind. @since 0.3 @stable */
    drawFlatTopBottom(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["flat-top-bottom"]);
    },
    /** Phase-3 `disjoint-channel` drawing kind. @since 0.3 @stable */
    drawDisjointChannel(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["disjoint-channel"]);
    },
    /** Phase-3 `regression-trend` drawing kind. @since 0.3 @stable */
    drawRegressionTrend(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["regression-trend"]);
    },
    /** Phase-3 `fib-retracement` drawing kind. @since 0.3 @stable */
    drawFibRetracement(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["fib-retracement"]);
    },
    /** Phase-3 `fib-trend-extension` drawing kind. @since 0.3 @stable */
    drawFibTrendExtension(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["fib-trend-extension"]);
    },
    /** Phase-3 `fib-channel` drawing kind. @since 0.3 @stable */
    drawFibChannel(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["fib-channel"]);
    },
    /** Phase-3 `fib-time-zone` drawing kind. @since 0.3 @stable */
    drawFibTimeZone(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["fib-time-zone"]);
    },
    /** Phase-3 `fib-wedge` drawing kind. @since 0.3 @stable */
    drawFibWedge(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["fib-wedge"]);
    },
    /** Phase-3 `fib-speed-fan` drawing kind. @since 0.3 @stable */
    drawFibSpeedFan(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["fib-speed-fan"]);
    },
    /** Phase-3 `fib-speed-arcs` drawing kind. @since 0.3 @stable */
    drawFibSpeedArcs(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["fib-speed-arcs"]);
    },
    /** Phase-3 `fib-spiral` drawing kind. @since 0.3 @stable */
    drawFibSpiral(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["fib-spiral"]);
    },
    /** Phase-3 `fib-circles` drawing kind. @since 0.3 @stable */
    drawFibCircles(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["fib-circles"]);
    },
    /** Phase-3 `fib-trend-time` drawing kind. @since 0.3 @stable */
    drawFibTrendTime(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["fib-trend-time"]);
    },
    /** Phase-3 `gann-box` drawing kind. @since 0.3 @stable */
    drawGannBox(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["gann-box"]);
    },
    /** Phase-3 `gann-square-fixed` drawing kind. @since 0.3 @stable */
    drawGannSquareFixed(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["gann-square-fixed"]);
    },
    /** Phase-3 `gann-square` drawing kind. @since 0.3 @stable */
    drawGannSquare(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["gann-square"]);
    },
    /** Phase-3 `gann-fan` drawing kind. @since 0.3 @stable */
    drawGannFan(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["gann-fan"]);
    },
    /** Phase-3 `pitchfork` drawing kind. @since 0.3 @stable */
    drawPitchfork(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["pitchfork"]);
    },
    /** Phase-3 `pitchfan` drawing kind. @since 0.3 @stable */
    drawPitchfan(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["pitchfan"]);
    },
    /** Phase-3 `xabcd-pattern` drawing kind. @since 0.3 @stable */
    drawXabcdPattern(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["xabcd-pattern"]);
    },
    /** Phase-3 `cypher-pattern` drawing kind. @since 0.3 @stable */
    drawCypherPattern(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["cypher-pattern"]);
    },
    /** Phase-3 `head-and-shoulders` drawing kind. @since 0.3 @stable */
    drawHeadAndShoulders(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["head-and-shoulders"]);
    },
    /** Phase-3 `abcd-pattern` drawing kind. @since 0.3 @stable */
    drawAbcdPattern(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["abcd-pattern"]);
    },
    /** Phase-3 `triangle-pattern` drawing kind. @since 0.3 @stable */
    drawTrianglePattern(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["triangle-pattern"]);
    },
    /** Phase-3 `three-drives-pattern` drawing kind. @since 0.3 @stable */
    drawThreeDrivesPattern(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["three-drives-pattern"]);
    },
    /** Phase-3 `elliott-impulse-wave` drawing kind. @since 0.3 @stable */
    drawElliottImpulseWave(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["elliott-impulse-wave"]);
    },
    /** Phase-3 `elliott-correction-wave` drawing kind. @since 0.3 @stable */
    drawElliottCorrectionWave(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["elliott-correction-wave"]);
    },
    /** Phase-3 `elliott-triangle-wave` drawing kind. @since 0.3 @stable */
    drawElliottTriangleWave(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["elliott-triangle-wave"]);
    },
    /** Phase-3 `elliott-double-combo` drawing kind. @since 0.3 @stable */
    drawElliottDoubleCombo(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["elliott-double-combo"]);
    },
    /** Phase-3 `elliott-triple-combo` drawing kind. @since 0.3 @stable */
    drawElliottTripleCombo(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["elliott-triple-combo"]);
    },
    /** Phase-3 `cyclic-lines` drawing kind. @since 0.3 @stable */
    drawCyclicLines(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["cyclic-lines"]);
    },
    /** Phase-3 `time-cycles` drawing kind. @since 0.3 @stable */
    drawTimeCycles(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["time-cycles"]);
    },
    /** Phase-3 `sine-line` drawing kind. @since 0.3 @stable */
    drawSineLine(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["sine-line"]);
    },
    /** Phase-3 `group` drawing kind. @since 0.3 @stable */
    drawGroup(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["group"]);
    },
    /** Phase-3 `frame` drawing kind. @since 0.3 @stable */
    drawFrame(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["frame"]);
    },
    /** Phase-5 `table` drawing kind. @since 0.5 @stable */
    drawTable(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["table"]);
    },

    // ------------------------------------------------------------
    // Phase 3 — category-group builders (13). Each covers the kinds
    // of one §10.2 category. Combine via `union(...)` for adapters
    // that support multiple categories.
    // @since 0.3 @stable
    // ------------------------------------------------------------

    /** All 6 line / ray drawing kinds. @since 0.3 @stable */
    allLineDrawings(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>([
            "line",
            "horizontal-line",
            "horizontal-ray",
            "vertical-line",
            "cross-line",
            "trend-angle",
        ]);
    },
    /**
     * All 9 box / shape drawing kinds. @since 0.3 @stable
     *
     * @remarks Capability categories are orthogonal to budget buckets:
     * `polyline`, `path`, and `fill-between` are budgeted under the
     * `polylines` bucket and `marker` under `labels` — not the `boxes`
     * bucket (see `bucketFor` in `@invinite-org/chartlang-core`). An
     * adapter that declares this set must size those buckets accordingly
     * or those four kinds drop with `drawing-budget-exceeded`.
     */
    allBoxDrawings(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>([
            "rectangle",
            "rotated-rectangle",
            "triangle",
            "polyline",
            "circle",
            "ellipse",
            "path",
            "fill-between",
            "marker",
        ]);
    },
    /** All 3 curve drawing kinds. @since 0.3 @stable */
    allCurveDrawings(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["arc", "curve", "double-curve"]);
    },
    /** All 3 freehand drawing kinds. @since 0.3 @stable */
    allFreehandDrawings(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["pen", "highlighter", "brush"]);
    },
    /** All 5 annotation drawing kinds. @since 0.3 @stable */
    allAnnotationDrawings(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>([
            "text",
            "arrow",
            "arrow-marker",
            "arrow-mark-up",
            "arrow-mark-down",
        ]);
    },
    /** All 4 channel drawing kinds. @since 0.3 @stable */
    allChannelDrawings(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>([
            "trend-channel",
            "flat-top-bottom",
            "disjoint-channel",
            "regression-trend",
        ]);
    },
    /** All 10 fibonacci drawing kinds. @since 0.3 @stable */
    allFibDrawings(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>([
            "fib-retracement",
            "fib-trend-extension",
            "fib-channel",
            "fib-time-zone",
            "fib-wedge",
            "fib-speed-fan",
            "fib-speed-arcs",
            "fib-spiral",
            "fib-circles",
            "fib-trend-time",
        ]);
    },
    /** All 4 gann drawing kinds. @since 0.3 @stable */
    allGannDrawings(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["gann-box", "gann-square-fixed", "gann-square", "gann-fan"]);
    },
    /** All 2 pitchfork drawing kinds. @since 0.3 @stable */
    allPitchforkDrawings(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["pitchfork", "pitchfan"]);
    },
    /** All 6 harmonic-pattern drawing kinds. @since 0.3 @stable */
    allPatternDrawings(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>([
            "xabcd-pattern",
            "cypher-pattern",
            "head-and-shoulders",
            "abcd-pattern",
            "triangle-pattern",
            "three-drives-pattern",
        ]);
    },
    /** All 5 elliott-wave drawing kinds. @since 0.3 @stable */
    allElliottDrawings(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>([
            "elliott-impulse-wave",
            "elliott-correction-wave",
            "elliott-triangle-wave",
            "elliott-double-combo",
            "elliott-triple-combo",
        ]);
    },
    /** All 3 cycle drawing kinds. @since 0.3 @stable */
    allCycleDrawings(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["cyclic-lines", "time-cycles", "sine-line"]);
    },
    /** All 2 container drawing kinds. @since 0.3 @stable */
    allContainerDrawings(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(["group", "frame"]);
    },

    /**
     * Every drawing kind that ships in Phase 3 — the union of every
     * category group above. Canvas2d declares this set as its
     * `Capabilities.drawings` (Task 4) so the conformance suite
     * covers all 62 non-table kinds end-to-end.
     *
     * @since 0.3
     * @stable
     */
    allPhase3Drawings(): ReadonlySet<DrawingKind> {
        return new Set<DrawingKind>(DRAWING_KINDS.filter((kind) => kind !== "table"));
    },
};
