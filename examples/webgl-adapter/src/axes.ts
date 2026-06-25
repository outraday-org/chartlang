// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * The price (y) + time (x) tick values a single pane's axes render this frame,
 * derived from the pane's resolved world {@link import(
 * "./layer-descriptor.js").PaneWindow}. Pure data — the GL grid lines and the
 * 2D-overlay labels are both built from it (the renderer packs the grid
 * line-strip; the overlay projects + paints the labels).
 *
 * @since 0.1
 * @stable
 * @example
 *     const t: AxisTicks = { priceTicks: [10, 20, 30], timeTicks: [0, 1000] };
 *     void t;
 */
export type AxisTicks = {
    readonly priceTicks: ReadonlyArray<number>;
    readonly timeTicks: ReadonlyArray<number>;
};

/**
 * The per-pane axis-render payload the {@link import(
 * "./webgl/Renderer.js").Renderer}'s `onAxes` hook emits once per pane per
 * frame: the pane's CSS-pixel rectangle (top-left origin — the overlay paints
 * in CSS space), its resolved world window, and the computed tick values. The
 * 2D text overlay ({@link import("./overlay.js").TextOverlay}) consumes it to
 * project + paint the labels. The renderer itself only emits geometry (the grid
 * line-strip) + this data; it never touches a `RenderCtx` or the DOM.
 *
 * @since 0.1
 * @stable
 * @example
 *     const info: AxisRenderInfo = {
 *         paneKey: "overlay",
 *         cssRect: { x: 0, y: 0, width: 800, height: 400 },
 *         window: { xMin: 0, xMax: 100, yMin: 1, yMax: 2 },
 *         ticks: { priceTicks: [1, 1.5, 2], timeTicks: [0, 50, 100] },
 *     };
 *     void info;
 */
export type AxisRenderInfo = {
    readonly paneKey: string;
    readonly cssRect: {
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
    };
    readonly window: {
        readonly xMin: number;
        readonly xMax: number;
        readonly yMin: number;
        readonly yMax: number;
    };
    readonly ticks: AxisTicks;
    readonly timeFormatter?: (time: number, span: number) => string;
};

// Default number of axis ticks per axis (≈ TradingView density). The renderer
// may override per-axis via `axisTickCount`.
const DEFAULT_TICK_COUNT = 5;

// The "nice" mantissa ladder a tick step rounds up to: 1, 2, 5 × 10^k. Keeps
// price gridlines on human-readable values (…, 0.5, 1, 2, 5, 10, …).
const NICE_STEPS = [1, 2, 5, 10] as const;

/**
 * Round a raw step up to the nearest "nice" value `{1, 2, 5} × 10^k`. The
 * classic axis-tick rounding (D3 / Graphics-Gems "nice numbers"): factor out
 * the power of ten, snap the mantissa up the {@link NICE_STEPS} ladder, then
 * re-apply the power. A non-positive / non-finite step falls back to `1` so the
 * caller never divides by zero.
 *
 * @since 0.1
 * @stable
 * @example
 *     niceStep(0.0023); // 0.005
 *     niceStep(170);    // 200
 */
export function niceStep(rawStep: number): number {
    if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
    const exponent = Math.floor(Math.log10(rawStep));
    const power = 10 ** exponent;
    const mantissa = rawStep / power;
    const nice = NICE_STEPS.find((s) => mantissa <= s) ?? 10;
    return nice * power;
}

/**
 * Evenly spaced "nice" tick values spanning `[min, max]`, at most ~`count`
 * ticks. The step is `niceStep((max - min) / count)`; ticks are the multiples
 * of that step inside `[min, max]` (inclusive of an aligned edge). A degenerate
 * span (`min === max`, non-finite, or inverted) returns a single `[min]` tick
 * rather than looping. Shared by {@link priceTicks}; the time axis snaps to a
 * coarser ladder via {@link timeTicks}.
 *
 * @since 0.1
 * @stable
 * @example
 *     niceTicks(0, 97, 5); // [0, 20, 40, 60, 80]
 */
export function niceTicks(min: number, max: number, count = DEFAULT_TICK_COUNT): number[] {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || count < 1) {
        return [min];
    }
    const step = niceStep((max - min) / count);
    const first = Math.ceil(min / step) * step;
    const ticks: number[] = [];
    // Guard the loop count: at most `count + 2` ticks fit a span of
    // `count * step`, so an FP wobble cannot run it away.
    for (let v = first, i = 0; v <= max + step * 1e-9 && i < count + 2; v += step, i += 1) {
        // Re-snap to the step grid so accumulated FP error never drifts a tick
        // (e.g. 0.30000000000000004 → 0.3).
        ticks.push(Math.round(v / step) * step);
    }
    return ticks.length > 0 ? ticks : [min];
}

/**
 * Price-axis tick values for a pane's visible y-window. Thin wrapper over
 * {@link niceTicks} — the price axis wants human-readable gridline values.
 *
 * @since 0.1
 * @stable
 * @example
 *     priceTicks(100, 110, 5); // [100, 102, 104, 106, 108, 110]
 */
export function priceTicks(yMin: number, yMax: number, count = DEFAULT_TICK_COUNT): number[] {
    return niceTicks(yMin, yMax, count);
}

// "Nice" time-step ladder in milliseconds: 1s, 5s, 15s, 1m, 5m, 15m, 30m, 1h,
// 4h, 12h, 1d, 1w, then monthly-ish (30d) / yearly-ish (365d). The time axis
// snaps the raw step UP to the first ladder rung ≥ it so vertical gridlines
// land on round clock / calendar boundaries instead of arbitrary epochs.
const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TIME_STEPS_MS = [
    SECOND,
    5 * SECOND,
    15 * SECOND,
    MINUTE,
    5 * MINUTE,
    15 * MINUTE,
    30 * MINUTE,
    HOUR,
    4 * HOUR,
    12 * HOUR,
    DAY,
    7 * DAY,
    30 * DAY,
    365 * DAY,
] as const;

/**
 * Time-axis tick values (epoch-ms) for a pane's visible x-window. Snaps the raw
 * step (`span / count`) UP to the {@link TIME_STEPS_MS} ladder so vertical
 * gridlines land on round clock / calendar boundaries, then emits the multiples
 * of that step inside `[xMin, xMax]`. A degenerate span returns `[xMin]`.
 *
 * @since 0.1
 * @stable
 * @example
 *     timeTicks(0, 3 * 60 * 60 * 1000, 3); // hourly-ish ticks across 3h
 */
export function timeTicks(xMin: number, xMax: number, count = DEFAULT_TICK_COUNT): number[] {
    if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= xMin || count < 1) {
        return [xMin];
    }
    const raw = (xMax - xMin) / count;
    const step = TIME_STEPS_MS.find((s) => s >= raw) ?? niceStep(raw);
    const first = Math.ceil(xMin / step) * step;
    const ticks: number[] = [];
    for (let v = first, i = 0; v <= xMax && i < count + 2; v += step, i += 1) {
        ticks.push(v);
    }
    return ticks.length > 0 ? ticks : [xMin];
}

/**
 * Format a price-axis label, scaling decimal places to the visible price span
 * (mirrors the canvas2d reference's `formatTick`): a wide range (RSI 0–100)
 * reads as integers while a tight one keeps precision. A non-finite price
 * renders as an empty string so a NaN gridline never paints a `"NaN"` label.
 *
 * @since 0.1
 * @stable
 * @example
 *     formatPrice(72.345, 4);  // "72.35"
 *     formatPrice(72.345, 60); // "72"
 */
export function formatPrice(price: number, span: number): string {
    if (!Number.isFinite(price)) return "";
    if (span >= 50) return price.toFixed(0);
    if (span >= 5) return price.toFixed(1);
    return price.toFixed(2);
}

// UTC date / time field helpers — labels are formatted in UTC so a golden /
// snapshot never shifts with the test machine's timezone (the canvas2d
// reference labels are timezone-free; bars carry epoch-ms).
function pad2(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
}

const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
] as const;

/**
 * Format a time-axis label (epoch-ms) at a resolution chosen from the visible
 * x-span (`spanMs`): an intraday span (< ~3 days) shows `HH:MM`, a multi-day /
 * month span shows `Mon DD`, and a multi-year span shows `Mon YYYY`. UTC so the
 * label is timezone-stable. A non-finite time renders empty.
 *
 * @since 0.1
 * @stable
 * @example
 *     formatTime(0, 60 * 60 * 1000);     // "00:00"
 *     formatTime(0, 30 * 24 * 3600_000); // "Jan 01"
 */
export function formatTime(timeMs: number, spanMs: number): string {
    if (!Number.isFinite(timeMs)) return "";
    const d = new Date(timeMs);
    const month = MONTHS[d.getUTCMonth()];
    if (spanMs < 3 * DAY) {
        return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
    }
    if (spanMs < 2 * 365 * DAY) {
        return `${month} ${pad2(d.getUTCDate())}`;
    }
    return `${month} ${d.getUTCFullYear()}`;
}

/**
 * Pack a pane's grid lines into a single world-space `[x0, y0, x1, y1, …]`
 * point buffer for the GL line-strip program — one horizontal line per price
 * tick (spanning `[xMin, xMax]`) + one vertical line per time tick (spanning
 * `[yMin, yMax]`), each line separated from the next by a single `NaN` point so
 * the line-strip program (Task 7) skips the bridging segment. Returns the
 * packed buffer + its point count (`points.length / 2`). An empty tick set
 * yields a zero-length buffer (the renderer skips the grid descriptor).
 *
 * Building the grid as ONE line-strip (rather than a GL program per line) reuses
 * the existing miter-joined line arm — no new GPU program; the grid is just
 * thin solid strokes in world space.
 *
 * @since 0.1
 * @stable
 * @example
 *     const g = packGridLines(0, 100, 0, 10, { priceTicks: [5], timeTicks: [50] });
 *     // g.pointCount > 0
 *     void g;
 */
export function packGridLines(
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number,
    ticks: AxisTicks,
): { points: Float32Array; pointCount: number } {
    const out: number[] = [];
    let first = true;
    const gap = (): void => {
        // A single NaN point between lines opens a line-strip gap.
        if (!first) out.push(Number.NaN, Number.NaN);
        first = false;
    };
    for (const price of ticks.priceTicks) {
        gap();
        out.push(xMin, price, xMax, price);
    }
    for (const time of ticks.timeTicks) {
        gap();
        out.push(time, yMin, time, yMax);
    }
    return { points: new Float32Array(out), pointCount: out.length / 2 };
}

/**
 * Compute both axes' tick values for a pane's visible world window in one call
 * — the renderer's per-pane entry point. Price ticks come from
 * {@link priceTicks}, time ticks from {@link timeTicks}.
 *
 * @since 0.1
 * @stable
 * @example
 *     const ticks = computeAxisTicks(0, 100, 10, 110, 5);
 *     // ticks.priceTicks / ticks.timeTicks
 *     void ticks;
 */
export function computeAxisTicks(
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number,
    count = DEFAULT_TICK_COUNT,
): AxisTicks {
    return {
        priceTicks: priceTicks(yMin, yMax, count),
        timeTicks: timeTicks(xMin, xMax, count),
    };
}
