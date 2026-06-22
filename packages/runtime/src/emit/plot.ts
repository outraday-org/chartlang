// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotEmission, PlotStyle } from "@invinite-org/chartlang-adapter-kit";
import type { Color, PlotOpts, Series } from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { seriesOffsetOf } from "../seriesView.js";
import { applyPlotOverride } from "./applyPlotOverride.js";
import { pushDiagnostic, pushPlot } from "./emissionsQueue.js";
import { resolvePane } from "./paneResolver.js";

const OUTSIDE_CTX_MESSAGE = "plot called outside an active script step";

function isSeriesNumber(v: unknown): v is Series<number> {
    return typeof v === "object" && v !== null && "current" in v;
}

function isNumberOrSeries(v: unknown): v is number | Series<number> {
    return typeof v === "number" || isSeriesNumber(v);
}

function resolveValue(value: number | Series<number>): number | null {
    const resolved = typeof value === "number" ? value : value.current;
    return Number.isFinite(resolved) ? resolved : null;
}

function buildStyle(opts: PlotOpts): PlotStyle {
    const style = opts.style;
    if (style === undefined) {
        return {
            kind: "line",
            lineWidth: opts.lineWidth ?? 1,
            lineStyle: opts.lineStyle ?? "solid",
        };
    }
    switch (style.kind) {
        case "histogram":
            return { kind: "histogram", baseline: style.baseline ?? 0 };
        case "marker":
            return { kind: "marker", shape: style.shape, size: style.size };
        case "shape":
            return {
                kind: "shape",
                shape: style.shape,
                size: style.size,
                ...(style.location === undefined ? {} : { location: style.location }),
            };
        case "character":
            return {
                kind: "character",
                char: style.char,
                size: style.size,
                ...(style.location === undefined ? {} : { location: style.location }),
            };
        case "arrow":
            return { kind: "arrow", direction: style.direction, size: style.size };
        case "candle-override":
            return {
                kind: "candle-override",
                bull: style.bull,
                bear: style.bear,
                ...(style.doji === undefined ? {} : { doji: style.doji }),
            };
        case "bar-override":
            return { kind: "bar-override", color: style.color };
        case "bg-color":
            return {
                kind: "bg-color",
                color: style.color,
                ...(style.transp === undefined ? {} : { transp: style.transp }),
            };
        case "bar-color":
            return { kind: "bar-color", color: style.color };
        case "horizontal-histogram":
            return { kind: "horizontal-histogram", buckets: style.buckets };
        case "line":
        case "step-line":
        case "horizontal-line":
            return {
                kind: style.kind,
                lineWidth: opts.lineWidth ?? 1,
                lineStyle: opts.lineStyle ?? "solid",
            };
    }
}

/**
 * Shared emission core for `plot` and its Pine-ergonomic aliases
 * (`bgcolor` / `barcolor`). Builds the {@link PlotStyle} from `opts.style`,
 * capability-gates, resolves the pane + `xShift` + `z`, and pushes the
 * deduped, override-applied {@link PlotEmission}.
 *
 * `dynamicColor` is the per-bar dynamic-color channel: when supplied (only
 * the `bgcolor` / `barcolor` aliases do — `plot` never does) it resolves to
 * {@link PlotEmission.colorValue} (a non-empty color string, or `null` for an
 * empty-string gap) and rides the same `(slotId, bar)` last-write-wins dedup
 * as `value`. When omitted, no `colorValue` own-key is emitted, so the
 * static-color `plot` wire stays byte-identical to the pre-Deliverable-2
 * baseline (every pinned plot golden / conformance hash holds).
 *
 * @since 1.4
 * @example
 *     // Internal — `bgcolor` / `barcolor` reuse this; scripts call `plot`.
 *     // const fn: typeof plotImpl = plotImpl;
 *     // void fn;
 */
export function plotImpl(
    ctx: RuntimeContext,
    slotId: string,
    value: number | Series<number>,
    opts: PlotOpts,
    dynamicColor?: Color,
): void {
    const style: PlotStyle = buildStyle(opts);

    if (!ctx.capabilities.plots.has(style.kind)) {
        pushDiagnostic(ctx.emissions, {
            kind: "diagnostic",
            severity: "warning",
            code: "unsupported-plot-kind",
            message: `Adapter cannot render plot kind "${style.kind}".`,
            slotId,
            bar: ctx.barIndex(),
        });
        return;
    }

    const pane = resolvePane(opts.pane, ctx, slotId);

    // A `ta.*` series carries its declared `offset` (ALMA: `barShift`) as a
    // presentation x-shift recorded on the series view; thread it onto the
    // emission. A plain numeric value or an untagged series omits `xShift`,
    // keeping the no-offset wire byte-identical to the pre-feature baseline.
    const xShift = typeof value === "number" ? 0 : seriesOffsetOf(value);

    // `z` is a direct plot-call option (a render-order key), unlike
    // `xShift` (derived from the series view). Normalize undefined → `0`
    // and append it with the same omit-when-`0` conditional spread so a
    // no-`z` plot stays byte-identical to the pre-feature baseline.
    const z = opts.z ?? 0;

    // The per-bar dynamic color (only `bgcolor` / `barcolor` pass it) rides the
    // wire as `colorValue`, appended LAST so an omitted-`colorValue` emission
    // is byte-identical to the pre-Deliverable-2 wire. `plot` passes nothing,
    // so its static-color wire is untouched and its goldens / hashes do not
    // move. The color flows through unchanged: the alias mirrors it onto the
    // static `style.color` too, so a malformed (empty) color trips the style
    // validator and `pushPlot` drops the whole emission — the validator's
    // `colorValue: null` arm is the wire contract for an explicit gap a future
    // producer may emit, not something the aliases manufacture.
    const colorValue = dynamicColor;

    const emission: PlotEmission = {
        kind: "plot",
        slotId,
        title: opts.title ?? "",
        style,
        bar: ctx.barIndex(),
        time: ctx.stream.bar.time,
        value: resolveValue(value),
        color: opts.color ?? null,
        meta: {},
        pane,
        ...(xShift === 0 ? {} : { xShift }),
        ...(z === 0 ? {} : { z }),
        ...(colorValue === undefined ? {} : { colorValue }),
    };

    pushPlot(ctx.emissions, applyPlotOverride(emission, ctx.plotOverrides[slotId]));
}

/**
 * Emit a plot line for the current bar (script-facing overload).
 *
 * The runtime export is dual-signature: scripts call `plot(value, opts?)`
 * (the surface declared on `@invinite-org/chartlang-core`'s
 * `ComputeContext`), and Task 2's compiler transformer rewrites every
 * callsite to inject the compiler-issued slot id as the leading
 * argument — see the sibling `plot(slotId, value, opts?)` overload.
 * A direct invocation without a slot id (i.e. outside a compiled
 * bundle) throws the sentinel error.
 *
 * Plot kind is always `"line"` in Phase 1; `"horizontal-line"` ships
 * via the sibling {@link hline} primitive. Phase 2+ extends the `kind`
 * variants additively.
 *
 * When the plotted value is a `ta.*` series declared with an `offset`
 * (or ALMA's `barShift`), that signed bar count rides the emission as
 * `PlotEmission.xShift` (presentation-only — `+n` renders the series `n`
 * bars right, `−n` `n` bars left); the emitted `value` itself is
 * unshifted, so alerts and `state.*` see the value computed at the
 * current bar.
 *
 * @since 0.1
 * @example
 *     import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "EMA(20)",
 *         apiVersion: 1,
 *         compute({ bar, ta, plot }) {
 *             plot(ta.ema(bar.close, 20), { color: "#26a69a", title: "EMA" });
 *         },
 *     });
 */
export function plot(value: number | Series<number>, opts?: PlotOpts): void;
/**
 * Emit a plot line for the current bar (compiler-injected overload).
 *
 * Task 2's callsite-id transformer rewrites every script-side
 * `plot(value, opts?)` into `plot(slotId, value, opts?)`. The runtime
 * branches on `typeof arg1 === "string"` so the compiler-emitted
 * bundle dispatches here directly.
 *
 * @since 0.1
 * @example
 *     // Internal — the compiler rewrites every script callsite, e.g.
 *     // `plot(close)` becomes `plot("demo.chart.ts:5:13#0", close)`.
 *     // const fn: typeof plot = plot;
 *     // void fn;
 */
export function plot(slotId: string, value: number | Series<number>, opts?: PlotOpts): void;
/**
 * Implementation signature for {@link plot}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 0.1
 * @example
 *     // const fn: typeof plot = plot;
 *     // void fn;
 */
export function plot(
    arg1: string | number | Series<number>,
    arg2?: number | Series<number> | PlotOpts,
    arg3?: PlotOpts,
): void {
    if (typeof arg1 !== "string") {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (!ctx) throw new Error(OUTSIDE_CTX_MESSAGE);
    if (!isNumberOrSeries(arg2)) {
        throw new Error(OUTSIDE_CTX_MESSAGE);
    }
    plotImpl(ctx, arg1, arg2, arg3 ?? {});
}
