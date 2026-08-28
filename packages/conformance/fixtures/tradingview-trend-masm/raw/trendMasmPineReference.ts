// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * JSON-safe number emitted by the independent Pine reference; `null` represents `na`.
 * @since 1.7
 * @example
 *     const value: ReferenceNumber = null;
 *     void value;
 */
export type ReferenceNumber = number | null;

/**
 * One adjusted daily OHLCV input bar consumed by the standalone reference.
 * @since 1.7
 * @example
 *     const bar: ReferenceBar = { time: 0, open: 1, high: 2, low: 0, close: 1, volume: 10 };
 *     void bar;
 */
export type ReferenceBar = {
    readonly time: number;
    readonly open: number;
    readonly high: number;
    readonly low: number;
    readonly close: number;
    readonly volume: number;
};

/**
 * Independently computed value, semantic color, and plot kind for one bar.
 * @since 1.7
 * @example
 *     const point: ReferencePlotPoint = { value: 1, semanticColor: null, kind: "line" };
 *     void point;
 */
export type ReferencePlotPoint = {
    readonly value: ReferenceNumber;
    readonly semanticColor: string | null;
    readonly kind: string;
};

/**
 * Independently computed MASM label descriptor.
 * @since 1.7
 * @example
 *     declare const label: ReferenceLabel;
 *     void label;
 */
export type ReferenceLabel = {
    readonly id: string;
    readonly text: string;
    /** Pine bar-index coordinate; may be fractional in the canonical source. */
    readonly barAnchor: number;
    readonly valueAnchor: ReferenceNumber;
    readonly kind: string;
    readonly semanticColor: string;
    readonly pane: "script";
};

/**
 * All independently evaluated Trend and MASM outputs for one source bar.
 * @since 1.7
 * @example
 *     declare const row: ReferenceExpectedRow;
 *     void row;
 */
export type ReferenceExpectedRow = {
    readonly time: number;
    readonly trend: {
        readonly short: ReferenceNumber;
        readonly medium: ReferenceNumber;
        readonly long: ReferenceNumber;
        readonly plots: Readonly<Record<string, ReferencePlotPoint>>;
    };
    readonly masm: {
        readonly source: ReferenceNumber;
        readonly histogram: ReferencePlotPoint;
        readonly direction: "flat" | "long" | "short";
        readonly entries: ReadonlyArray<"long" | "short">;
        readonly exits: ReadonlyArray<"long" | "short">;
        readonly background: {
            readonly active: boolean;
            readonly semanticColor: string | null;
        };
        readonly labels: ReadonlyArray<ReferenceLabel>;
        readonly plots: Readonly<Record<string, ReferencePlotPoint>>;
    };
};

/**
 * Presentation descriptor translated directly from one canonical Pine plot call.
 * @since 1.7
 * @example
 *     declare const definition: ReferencePlotDefinition;
 *     void definition;
 */
export type ReferencePlotDefinition = {
    readonly name: string;
    readonly title: string;
    readonly kind: string;
    readonly style: string;
    readonly order: number;
    readonly visible: boolean;
    readonly lineWidth: number | null;
    readonly glyph: string | null;
    readonly textColor: string | null;
    readonly semanticColor: string | null;
};

/**
 * Complete output of the import-free Trend/MASM Pine reference evaluator.
 * @since 1.7
 * @example
 *     declare const evaluation: ReferenceEvaluation;
 *     void evaluation;
 */
export type ReferenceEvaluation = {
    readonly expected: ReadonlyArray<ReferenceExpectedRow>;
    readonly presentation: {
        readonly trend: ReadonlyArray<ReferencePlotDefinition>;
        readonly masm: ReadonlyArray<ReferencePlotDefinition>;
    };
    readonly thresholdDistances: Readonly<Record<string, number>>;
    readonly minimumDecisionDistance: number;
};

const NA = Number.NaN;

const COLOR = Object.freeze({
    orange: "#FF9800FF",
    yellow: "#FFEB3BFF",
    lime: "#00E676FF",
    blue: "#2196F3FF",
    purple: "#9C27B0FF",
    red: "#FF5252FF",
    white: "#FFFFFFFF",
    transparentWhite: "#FFFFFF00",
    trendShort: "#CFB066FF",
    trendMedium: "#26CE9BFF",
    trendLong: "#4197DDFF",
    transparentGray: "#86868600",
    masmGreen: "#0DDA74FF",
    masmGreenBackground: "#0DDA741F",
    masmRed: "#FF5278FF",
    masmPurple: "#D071FCFF",
    gray: "#707070FF",
    marker: "#7C6F6FFF",
    markerTransparent: "#7C6F6F00",
    markerTextTransparent: "#7C6F6F66",
    guideline: "#FFFFFF50",
});

function finite(value: number): boolean {
    return Number.isFinite(value);
}

function serialized(value: number): ReferenceNumber {
    return finite(value) ? value : null;
}

function valueAt(values: ReadonlyArray<number>, index: number): number {
    return index >= 0 ? (values[index] ?? NA) : NA;
}

function add(left: number, right: number): number {
    return finite(left) && finite(right) ? left + right : NA;
}

function subtract(left: number, right: number): number {
    return finite(left) && finite(right) ? left - right : NA;
}

function multiply(left: number, right: number): number {
    return finite(left) && finite(right) ? left * right : NA;
}

function divide(left: number, right: number): number {
    return finite(left) && finite(right) && right !== 0 ? left / right : NA;
}

function mapUnary(values: ReadonlyArray<number>, operation: (value: number) => number): number[] {
    return values.map((value) => (finite(value) ? operation(value) : NA));
}

function mapBinary(
    left: ReadonlyArray<number>,
    right: ReadonlyArray<number>,
    operation: (leftValue: number, rightValue: number) => number,
): number[] {
    return left.map((leftValue, index) => {
        const rightValue = valueAt(right, index);
        return finite(leftValue) && finite(rightValue) ? operation(leftValue, rightValue) : NA;
    });
}

function change(values: ReadonlyArray<number>): number[] {
    return values.map((value, index) => subtract(value, valueAt(values, index - 1)));
}

/**
 * Evaluate Pine `ta.sma`, consuming `length` non-`na` observations.
 * @since 1.7
 * @example
 *     const values = pineSma([1, 2, 3], 2);
 *     void values;
 */
export function pineSma(values: ReadonlyArray<number>, length: number): number[] {
    const window: number[] = [];
    return values.map((value) => {
        if (finite(value)) {
            window.push(value);
            if (window.length > length) window.shift();
        }
        if (window.length < length) return NA;
        return window.reduce((sum, current) => sum + current, 0) / length;
    });
}

/**
 * Evaluate Pine `ta.ema`, seeded by the first finite source observation.
 * @since 1.7
 * @example
 *     const values = pineEma([1, 2, 3], 2);
 *     void values;
 */
export function pineEma(values: ReadonlyArray<number>, length: number): number[] {
    const alpha = 2 / (length + 1);
    let previous = NA;
    return values.map((value) => {
        if (!finite(value)) return NA;
        previous = finite(previous) ? alpha * value + (1 - alpha) * previous : value;
        return previous;
    });
}

/**
 * Evaluate Pine `ta.rma` with an SMA seed and `alpha = 1 / length`.
 * @since 1.7
 * @example
 *     const values = pineRma([1, 2, 3], 2);
 *     void values;
 */
export function pineRma(values: ReadonlyArray<number>, length: number): number[] {
    const seed: number[] = [];
    let previous = NA;
    return values.map((value) => {
        if (!finite(value)) return NA;
        if (!finite(previous)) {
            seed.push(value);
            if (seed.length < length) return NA;
            previous = seed.reduce((sum, current) => sum + current, 0) / length;
            return previous;
        }
        previous = (value + (length - 1) * previous) / length;
        return previous;
    });
}

/**
 * Evaluate Pine `ta.wma` with linearly increasing weights.
 * @since 1.7
 * @example
 *     const values = pineWma([1, 2, 3], 2);
 *     void values;
 */
export function pineWma(values: ReadonlyArray<number>, length: number): number[] {
    const window: number[] = [];
    const denominator = (length * (length + 1)) / 2;
    return values.map((value) => {
        if (finite(value)) {
            window.push(value);
            if (window.length > length) window.shift();
        }
        if (window.length < length) return NA;
        return window.reduce((sum, current, index) => sum + current * (index + 1), 0) / denominator;
    });
}

function pineHma(values: ReadonlyArray<number>, length: number): number[] {
    const half = pineWma(values, Math.max(1, Math.floor(length / 2)));
    const full = pineWma(values, length);
    const combined = mapBinary(half, full, (halfValue, fullValue) => 2 * halfValue - fullValue);
    return pineWma(combined, Math.max(1, Math.round(Math.sqrt(length))));
}

function pineTrueRange(bars: ReadonlyArray<ReferenceBar>): number[] {
    return bars.map((bar, index) => {
        const previousClose = bars[index - 1]?.close;
        if (previousClose === undefined) return bar.high - bar.low;
        return Math.max(
            bar.high - bar.low,
            Math.abs(bar.high - previousClose),
            Math.abs(bar.low - previousClose),
        );
    });
}

function pineAtr(bars: ReadonlyArray<ReferenceBar>, length: number): number[] {
    return pineRma(pineTrueRange(bars), length);
}

function pineRsi(values: ReadonlyArray<number>, length: number): number[] {
    const delta = change(values);
    const gains = delta.map((value) => (finite(value) ? Math.max(value, 0) : NA));
    const losses = delta.map((value) => (finite(value) ? Math.max(-value, 0) : NA));
    const averageGain = pineRma(gains, length);
    const averageLoss = pineRma(losses, length);
    return averageGain.map((gain, index) => {
        const loss = valueAt(averageLoss, index);
        if (!finite(gain) || !finite(loss)) return NA;
        if (loss === 0) return 100;
        if (gain === 0) return 0;
        return 100 - 100 / (1 + gain / loss);
    });
}

function pineCross(left: ReadonlyArray<number>, right: ReadonlyArray<number>): boolean[] {
    return left.map((leftValue, index) => {
        const rightValue = valueAt(right, index);
        const previousLeft = valueAt(left, index - 1);
        const previousRight = valueAt(right, index - 1);
        if (![leftValue, rightValue, previousLeft, previousRight].every(finite)) return false;
        return (
            (leftValue > rightValue && previousLeft <= previousRight) ||
            (leftValue < rightValue && previousLeft >= previousRight)
        );
    });
}

function constant(length: number, value: number): number[] {
    return Array.from({ length }, () => value);
}

function limit(value: number, upper: number, lower: number): number {
    return finite(value) ? Math.max(Math.min(value, upper), lower) : NA;
}

function percentSlope(values: ReadonlyArray<number>, smoothing: number): number[] {
    const raw = values.map((value, index) => {
        const previous = valueAt(values, index - 1);
        return multiply(divide(subtract(value, previous), previous), 100);
    });
    return pineEma(raw, smoothing);
}

function percentDistance(
    source: ReadonlyArray<number>,
    movingAverage: ReadonlyArray<number>,
    smoothing: number,
): number[] {
    const raw = mapBinary(
        source,
        movingAverage,
        (sourceValue, averageValue) => ((sourceValue - averageValue) / averageValue) * 100,
    );
    return pineSma(raw, smoothing);
}

function macross(
    first: ReadonlyArray<number>,
    second: ReadonlyArray<number>,
    exclusion: 0 | 1 | 2,
    smoothing: number,
): number[] {
    const crossed = pineCross(first, second);
    const fresh = crossed.map((current, index) => {
        const excluded =
            exclusion === 1
                ? (crossed[index - 1] ?? false)
                : exclusion === 2
                  ? (crossed[index - 1] ?? false) || (crossed[index - 2] ?? false)
                  : false;
        return current && !excluded ? 1 : 0;
    });
    return pineSma(fresh, smoothing);
}

function plot(value: number, semanticColor: string | null, kind: string): ReferencePlotPoint {
    return { value: serialized(value), semanticColor, kind };
}

function definition(
    name: string,
    kind: string,
    style: string,
    order: number,
    visible: boolean,
    lineWidth: number | null = null,
    glyph: string | null = null,
    semanticColor: string | null = null,
    title = name,
    textColor: string | null = null,
): ReferencePlotDefinition {
    return {
        name,
        title,
        kind,
        style,
        order,
        visible,
        lineWidth,
        glyph,
        textColor,
        semanticColor,
    };
}

const TREND_PRESENTATION: ReadonlyArray<ReferencePlotDefinition> = Object.freeze([
    definition("MA 1 Slope", "line", "line", 0, false),
    definition("MA 2 Slope", "line", "line", 1, false),
    definition("MA 3 Slope", "line", "line", 2, false),
    definition("MA 4 Slope", "line", "line", 3, false),
    definition("MA 5 Slope", "line", "line", 4, false),
    definition("MA Slope Comp", "columns", "columns", 5, false),
    definition("MA 1 Derivative", "columns", "columns", 6, false),
    definition("MA 2 Derivative", "columns", "columns", 7, false),
    definition("MA 3 Derivative", "columns", "columns", 8, false),
    definition("MA 4 Derivative", "columns", "columns", 9, false),
    definition("MA 5 Derivative", "columns", "columns", 10, false),
    definition("MA Derivative Comp", "columns", "columns", 11, false),
    definition("MA 1 Turnover", "line", "line", 12, false),
    definition("MA 2 Turnover", "line", "line", 13, false),
    definition("MA 3 Turnover", "line", "line", 14, false),
    definition("MA 4 Turnover", "line", "line", 15, false),
    definition("MA 5 Turnover", "line", "line", 16, false),
    definition("MA Turnover Comp", "line", "line", 17, false),
    definition("MA 1 Distance", "line", "line", 18, false),
    definition("MA 2 Distance", "line", "line", 19, false),
    definition("MA 3 Distance", "line", "line", 20, false),
    definition("MA 4 Distance", "line", "line", 21, false),
    definition("MA 5 Distance", "line", "line", 22, false),
    definition("MA Distances Comp", "line", "line", 23, false),
    definition("1-2 Cross", "line", "line", 24, false),
    definition("2-3 Cross", "line", "line", 25, false),
    definition("3-4 Cross", "line", "line", 26, false),
    definition("4-5 Cross", "line", "line", 27, false),
    definition("MA Crossing Comp", "line", "line", 28, false),
    definition("RSI", "line", "line", 29, false),
    definition("RSI MA", "line", "line", 30, false),
    definition("RSI MA Slope", "line", "line", 31, false),
    definition("ATR Short", "line", "line", 32, false),
    definition("ATR Medium", "line", "line", 33, false),
    definition("ATR Long", "line", "line", 34, false),
    definition("Zero Line", "hline", "dashed", 35, true, null, null, COLOR.white),
    definition("Max", "hline", "line", 36, true, null, null, "#787B86FF"),
    definition("Min", "hline", "line", 37, true, null, null, "#787B86FF"),
    definition("Mid 50%", "hline", "dashed", 38, true, null, null, "#787B86FF"),
    definition("Mid -50%", "hline", "dashed", 39, true, null, null, "#787B86FF"),
    definition("Consol Upper", "hline", "line", 40, true, null, null, COLOR.transparentWhite),
    definition("Consol Lower", "hline", "line", 41, true, null, null, COLOR.transparentWhite),
    definition("Consolidation Band", "fill", "fill", 42, true, null, null, "#CD79DB1F", ""),
    definition("Tab Trend Short", "line", "line", 43, true),
    definition("Tab Trend Medium", "line", "line", 44, true),
    definition("Tab Trend Long", "line", "line", 45, true),
]);

const MASM_PRESENTATION: ReadonlyArray<ReferencePlotDefinition> = Object.freeze([
    definition("Background Color", "background", "background", 0, true, null, null, null, ""),
    definition("MA Slope", "columns", "columns", 1, true),
    definition("Consolidation Overlay Bars", "columns", "columns", 2, true),
    definition("MA Slope derivative", "columns", "columns", 3, false, 1),
    definition("RSI MA Slope", "line", "line", 4, false, 1),
    definition("RSI Deriv", "line", "line", 5, false),
    definition("ATR", "line", "line", 6, false),
    definition("Consol Range Upper Band", "line", "line", 7, false),
    definition("Consol Range Lower Band", "line", "line", 8, false),
    definition("Consol Range Top LT adjusted", "line", "line", 9, false),
    definition("Consol Range Bottom LT adjusted", "line", "line", 10, false),
    definition("30 WSMA slope", "line", "line", 11, false),
    definition(
        "Never Long C1 Cancel",
        "shape",
        "xcross",
        12,
        true,
        null,
        "1",
        null,
        "Never Long C1 Cancel",
        COLOR.marker,
    ),
    definition(
        "Never Long C1 All",
        "shape",
        "xcross",
        13,
        true,
        null,
        "1",
        null,
        "Never Long C1 Cancel",
        COLOR.markerTextTransparent,
    ),
    definition(
        "Never Long C2 Cancel",
        "shape",
        "xcross",
        14,
        true,
        null,
        "2",
        null,
        "Never Long C2 Cancel",
        COLOR.marker,
    ),
    definition(
        "Never Long C2 All",
        "shape",
        "xcross",
        15,
        true,
        null,
        "2",
        null,
        "Never Long C2 Cancel",
        COLOR.markerTextTransparent,
    ),
    definition(
        "Stay Long C Cancel",
        "shape",
        "xcross",
        16,
        true,
        null,
        "sl1",
        null,
        "Stay Long C Cancel",
        COLOR.marker,
    ),
    definition("Guideline Top", "step-line", "step-line", 17, true, 1),
    definition("Guideline Bottom", "line", "line", 18, true, 1),
    definition("Trade Signals Long", "circles", "circles", 19, false),
    definition("Trade Signals Short", "circles", "circles", 20, false),
    definition("Compmode Zero Line", "hline", "dashed", 21, false, null, null, COLOR.white),
    definition("Compmode Strat Profit", "line", "line", 22, false),
    definition("Compmode Strat Profit Absolute", "line", "line", 23, false),
    definition("Compmode Hold Profit", "line", "line", 24, false),
    definition("Compmode request.security Profit", "line", "line", 25, false),
    definition("Compmode Strat/Comp_sec", "line", "line", 26, false),
]);

type TrendSeries = {
    readonly short: number[];
    readonly medium: number[];
    readonly long: number[];
    readonly plots: Readonly<Record<string, ReadonlyArray<number>>>;
    readonly colors: Readonly<Record<string, string | null | ((index: number) => string | null)>>;
    readonly thresholdDistances: Readonly<Record<string, number>>;
};

function evaluateTrend(bars: ReadonlyArray<ReferenceBar>): TrendSeries {
    const length = bars.length;
    const thresholdBuckets: Record<string, number> = {};
    const noteDistance = (name: string, value: number): void => {
        // An exact equality is governed by the exact semantic/event comparison,
        // not the numeric-series tolerance. Record the nearest non-equal input
        // on both sides of every decision boundary.
        if (!finite(value) || value === 0) return;
        const distance = Math.abs(value);
        thresholdBuckets[name] = Math.min(
            thresholdBuckets[name] ?? Number.POSITIVE_INFINITY,
            distance,
        );
    };
    const close = bars.map((bar) => bar.close);
    const high = bars.map((bar) => bar.high);
    const low = bars.map((bar) => bar.low);

    // Saved TradingView settings: custom symbol OFF; chart TQQQ is the source.
    const ma1 = pineEma(close, 8);
    const ma2 = pineEma(close, 21);
    const ma3 = pineSma(close, 50);
    const ma4 = pineSma(close, 145);
    const ma5 = pineSma(close, 241);

    const atrShortLength = Math.round(((8 + 21) / 2) * 4.5);
    const atrMediumLength = Math.round(((21 + 50) / 2) * 4);
    const atrLongLength = Math.round(((145 + 241) / 2) * 1.4);
    const trueRange = pineTrueRange(bars);
    const atrPercent = (period: number): number[] =>
        mapBinary(
            pineRma(trueRange, period),
            close,
            (atrValue, closeValue) => (atrValue / closeValue) * 100,
        );
    const hiloPercent = high.map((highValue, index) =>
        multiply(divide(highValue - low[index], low[index]), 100),
    );
    const atrShort = atrPercent(atrShortLength);
    const atrMedium = atrPercent(atrMediumLength);
    const atrLong = atrPercent(atrLongLength);
    const atrShortOwn = pineSma(hiloPercent, atrShortLength);
    const atrMediumOwn = pineSma(hiloPercent, atrMediumLength);
    const atrLongOwn = pineSma(hiloPercent, atrLongLength);
    const averagePair = (left: ReadonlyArray<number>, right: ReadonlyArray<number>): number[] =>
        mapBinary(left, right, (leftValue, rightValue) => (leftValue + rightValue) / 2);
    const atrShortAverage = pineWma(
        averagePair(atrShort, atrShortOwn),
        Math.round(atrShortLength * 0.6),
    );
    const atrMediumAverage = pineWma(
        averagePair(atrMedium, atrMediumOwn),
        Math.round(atrMediumLength * 0.5),
    );
    const atrLongAverage = pineWma(
        averagePair(atrLong, atrLongOwn),
        Math.round(atrLongLength * 0.2),
    );
    const atrShortAverageDistance = pineWma(atrShortAverage, Math.round(atrShortLength * 8));
    const atrMediumAverageDistance = pineWma(atrMediumAverage, Math.round(atrMediumLength * 3.5));
    const atrLongAverageDistance = pineWma(atrLongAverage, Math.round(atrLongLength));
    const movingAverageDistanceFactor = (
        shorter: ReadonlyArray<number>,
        longer: ReadonlyArray<number>,
        averageDistance: ReadonlyArray<number>,
        scale: number,
        translation: number,
        smoothing: number,
    ): number[] => {
        const raw = shorter.map((shorterValue, index) => {
            const longerValue = valueAt(longer, index);
            const averageValue = valueAt(averageDistance, index);
            if (![shorterValue, longerValue, averageValue].every(finite)) return NA;
            return (
                ((Math.abs((longerValue - shorterValue) / shorterValue) * 30) / averageValue) *
                    scale +
                translation
            );
        });
        return pineWma(raw, smoothing);
    };
    const atrShortDistance = movingAverageDistanceFactor(
        ma1,
        ma2,
        atrShortAverageDistance,
        2,
        1,
        Math.round(atrShortLength * 1.5),
    );
    const atrMediumDistance = movingAverageDistanceFactor(
        ma2,
        ma3,
        atrMediumAverageDistance,
        0.85,
        1,
        Math.round(atrMediumLength * 1.2),
    );
    const atrLongDistance = movingAverageDistanceFactor(
        ma4,
        ma5,
        atrLongAverageDistance,
        0.3,
        1,
        Math.round(atrLongLength),
    );
    const atrShortAdjusted = mapBinary(
        atrShortAverage,
        atrShortDistance,
        (value, divisor) => value / divisor,
    );
    const atrMediumAdjusted = mapBinary(
        atrMediumAverage,
        atrMediumDistance,
        (value, divisor) => value / divisor,
    );
    const atrLongAdjusted = mapBinary(
        atrLongAverage,
        atrLongDistance,
        (value, divisor) => value / divisor,
    );

    // Saved slope smoothings are 3/1/3/3/3 (not all source defaults).
    const slope1 = percentSlope(ma1, 3);
    const slope2 = percentSlope(ma2, 1);
    const slope3 = percentSlope(ma3, 3);
    const slope4 = percentSlope(ma4, 3);
    const slope5 = percentSlope(ma5, 3);
    const slopeCompositePre = slope1.map((value, index) =>
        [value, slope2[index], slope3[index], slope4[index], slope5[index]].every(finite)
            ? value + slope2[index] + slope3[index] + slope4[index] + slope5[index]
            : NA,
    );
    const slopeComposite = pineSma(slopeCompositePre, 1);
    const derivative1 = pineSma(change(slope1), 3);
    const derivative2 = pineSma(change(slope2), 3);
    const derivative3 = pineSma(change(slope3), 3);
    const derivative4 = pineSma(change(slope4), 3);
    const derivative5 = pineSma(change(slope5), 3);
    const derivativeComposite = pineSma(change(slopeComposite), 21);
    const zero = constant(length, 0);
    const turnover = (slope: ReadonlyArray<number>): number[] =>
        pineSma(
            pineCross(slope, zero).map((crossed) => (crossed ? 1 : 0)),
            8,
        );
    const turnover1 = turnover(slope1);
    const turnover2 = turnover(slope2);
    const turnover3 = turnover(slope3);
    const turnover4 = turnover(slope4);
    const turnover5 = turnover(slope5);
    const turnoverComposite = turnover1.map((value, index) =>
        [value, turnover2[index], turnover3[index], turnover4[index], turnover5[index]].every(
            finite,
        )
            ? (value + turnover2[index] + turnover3[index] + turnover4[index] + turnover5[index]) /
              3
            : NA,
    );
    // Saved distance smoothings are 10/4/5/8/10.
    const distance1 = percentDistance(close, ma1, 10);
    const distance2 = percentDistance(close, ma2, 4);
    const distance3 = percentDistance(close, ma3, 5);
    const distance4 = percentDistance(close, ma4, 8);
    const distance5 = percentDistance(close, ma5, 10);
    const distanceComposite = distance1.map((value, index) =>
        [value, distance2[index], distance3[index], distance4[index], distance5[index]].every(
            finite,
        )
            ? (value + distance2[index] + distance3[index] + distance4[index] + distance5[index]) /
              5
            : NA,
    );
    const cross12 = macross(ma1, ma2, 2, 1);
    const cross23 = macross(ma2, ma3, 2, 1);
    const cross34 = macross(ma3, ma4, 2, 1);
    const cross45 = macross(ma4, ma5, 2, 1);
    for (let index = 0; index < length; index += 1) {
        noteDistance("trend-cross-ma1-ma2", subtract(ma1[index], ma2[index]));
        noteDistance("trend-cross-ma2-ma3", subtract(ma2[index], ma3[index]));
        noteDistance("trend-cross-ma3-ma4", subtract(ma3[index], ma4[index]));
        noteDistance("trend-cross-ma4-ma5", subtract(ma4[index], ma5[index]));
        noteDistance("trend-cross-slope1-zero", slope1[index]);
        noteDistance("trend-cross-slope2-zero", slope2[index]);
        noteDistance("trend-cross-slope3-zero", slope3[index]);
        noteDistance("trend-cross-slope4-zero", slope4[index]);
        noteDistance("trend-cross-slope5-zero", slope5[index]);
        noteDistance("trend-slope-composite-color-zero", slopeComposite[index]);
    }
    const crossComposite = pineSma(
        cross12.map((value, index) =>
            [value, cross23[index], cross34[index], cross45[index]].every(finite)
                ? value + cross23[index] + cross34[index] + cross45[index]
                : NA,
        ),
        1,
    );
    const rsi = mapUnary(pineRsi(close, 14), (value) => value * 0.1);
    const rsiAverage = pineSma(rsi, 14);
    const rsiAverageSlope = mapUnary(percentSlope(rsiAverage, 4), (value) => value * 2.5 * 0.1);

    const tabTurnover = (
        first: ReadonlyArray<number>,
        second: ReadonlyArray<number>,
        firstWeight: number,
        secondWeight: number,
        preScale: number,
        translation: number,
        postScale: number,
        smoothLength: number,
    ): number[] => {
        const raw = first.map((value, index) => {
            const secondValue = valueAt(second, index);
            if (!finite(value) || !finite(secondValue)) return NA;
            const preLimit =
                (value * firstWeight + secondValue * secondWeight) * preScale + translation;
            noteDistance(`trend-turnover-limit-${String(translation)}-zero`, preLimit);
            noteDistance(`trend-turnover-limit-${String(translation)}-one`, preLimit - 1);
            const limited = limit(preLimit, 1, 0);
            return Math.abs(limited * postScale - 1);
        });
        return pineWma(raw, Math.round(smoothLength));
    };
    const tabCross = (
        crossings: ReadonlyArray<number>,
        preSmoothLength: number,
        smoothType: "EMA" | "HMA",
        translation: number,
        preScale: number,
        postScale: number,
        finalSmoothLength: number,
    ): number[] => {
        const preSmoothed =
            smoothType === "HMA"
                ? pineHma(crossings, Math.round(preSmoothLength))
                : pineEma(crossings, Math.round(preSmoothLength));
        const raw = mapUnary(preSmoothed, (value) => {
            const preLimit = (value + translation) * preScale;
            noteDistance(`trend-cross-limit-${String(translation)}-zero`, preLimit);
            noteDistance(`trend-cross-limit-${String(translation)}-one`, preLimit - 1);
            return Math.abs(limit(preLimit, 1, 0) * postScale - 1);
        });
        return pineSma(raw, finalSmoothLength);
    };
    const tabDistance = (
        shorter: ReadonlyArray<number>,
        longer: ReadonlyArray<number>,
        preScale: number,
        atrValues: ReadonlyArray<number>,
        translation: number,
        upper: number,
        postScale: number,
    ): number[] =>
        shorter.map((shorterValue, index) => {
            const longerValue = valueAt(longer, index);
            const atrValue = valueAt(atrValues, index);
            if (![shorterValue, longerValue, atrValue].every(finite)) return NA;
            const adjusted =
                (Math.abs((longerValue - shorterValue) / shorterValue) * preScale) / atrValue +
                translation;
            noteDistance(
                `trend-distance-limit-${String(preScale)}-${String(translation)}-zero`,
                adjusted,
            );
            noteDistance(
                `trend-distance-limit-${String(preScale)}-${String(translation)}-upper`,
                adjusted - upper,
            );
            return limit(adjusted, upper, 0) * postScale + 1;
        });
    const shortTurnover = tabTurnover(turnover1, turnover2, 1, 1, 0.8, -0.1, 0.9, (8 + 21) / 9);
    const mediumTurnover = tabTurnover(turnover3, turnover4, 3, 1, 1.1, -0.4, 1, 50 / 2);
    const longTurnover = tabTurnover(turnover4, turnover5, 1, 1, 1, -0.05, 1.8, (145 + 241) / 15.4);
    const shortCross = tabCross(cross12, atrShortLength, "HMA", -0.08, 5, 0.6, 1);
    const mediumCross = tabCross(cross23, 50, "EMA", -0.042, 40, 0.8, 10);
    const longCross = tabCross(cross45, atrLongLength, "EMA", -0.0075, 95, 0.8, 20);
    const shortDistance = tabDistance(ma1, ma2, 30, atrShortAdjusted, -0.4, 2, 0.33);
    const mediumDistance = tabDistance(ma2, ma3, 25, atrMediumAdjusted, -0.4, 2, 0.2);
    const longDistance = tabDistance(ma4, ma5, 25, atrLongAdjusted, -0.35, 1.8, 0.28);
    const shortPre = pineWma(
        slope1.map((value, index) => {
            const second = slope2[index];
            const adjustedAtr = atrShortAdjusted[index];
            return [value, second, adjustedAtr].every(finite)
                ? (((value + second * 2) * 0.66666) / adjustedAtr) * 1.1
                : NA;
        }),
        5,
    ).map((value, index) => multiply(value, shortDistance[index]));
    const mediumPre = pineWma(
        slope2.map((value, index) => {
            const third = slope3[index];
            const fourth = slope4[index];
            const adjustedAtr = atrMediumAdjusted[index];
            return [value, third, fourth, adjustedAtr].every(finite)
                ? (((value + third * 2 + fourth) * 0.5) / adjustedAtr) * 1.35
                : NA;
        }),
        5,
    ).map((value, index) => multiply(value, mediumDistance[index]));
    const longPre = pineWma(
        slope4.map((value, index) => {
            const fifth = slope5[index];
            const adjustedAtr = atrLongAdjusted[index];
            return [value, fifth, adjustedAtr].every(finite)
                ? (((value * 2 + fifth) * 0.66666) / adjustedAtr) * 1.9
                : NA;
        }),
        5,
    ).map((value, index) => {
        const withDistance = multiply(value, longDistance[index]);
        noteDistance("trend-long-negative-scale-zero", withDistance);
        return finite(withDistance) && withDistance < 0 ? withDistance * 1.15 : withDistance;
    });
    for (const [name, values] of [
        ["short", shortPre],
        ["medium", mediumPre],
        ["long", longPre],
    ] as const) {
        for (const value of values) {
            noteDistance(`trend-${name}-output-limit-lower`, add(value, 1));
            noteDistance(`trend-${name}-output-limit-upper`, subtract(value, 1));
        }
    }
    const short = shortPre.map((value, index) =>
        multiply(multiply(limit(value, 1, -1), shortTurnover[index]), shortCross[index]),
    );
    const medium = mediumPre.map((value, index) =>
        multiply(multiply(limit(value, 1, -1), mediumTurnover[index]), mediumCross[index]),
    );
    const long = longPre.map((value, index) =>
        multiply(multiply(limit(value, 1, -1), longTurnover[index]), longCross[index]),
    );

    return {
        short,
        medium,
        long,
        thresholdDistances: thresholdBuckets,
        plots: {
            "MA 1 Slope": slope1,
            "MA 2 Slope": slope2,
            "MA 3 Slope": slope3,
            "MA 4 Slope": slope4,
            "MA 5 Slope": slope5,
            "MA Slope Comp": slopeComposite,
            "MA 1 Derivative": mapUnary(derivative1, (value) => value * 2),
            "MA 2 Derivative": mapUnary(derivative2, (value) => value * 2),
            "MA 3 Derivative": mapUnary(derivative3, (value) => value * 2),
            "MA 4 Derivative": mapUnary(derivative4, (value) => value * 2),
            "MA 5 Derivative": mapUnary(derivative5, (value) => value * 2),
            "MA Derivative Comp": mapUnary(derivativeComposite, (value) => value * 5),
            "MA 1 Turnover": turnover1,
            "MA 2 Turnover": turnover2,
            "MA 3 Turnover": turnover3,
            "MA 4 Turnover": turnover4,
            "MA 5 Turnover": turnover5,
            "MA Turnover Comp": turnoverComposite,
            "MA 1 Distance": mapUnary(distance1, (value) => value * 0.1),
            "MA 2 Distance": mapUnary(distance2, (value) => value * 0.1),
            "MA 3 Distance": mapUnary(distance3, (value) => value * 0.1),
            "MA 4 Distance": mapUnary(distance4, (value) => value * 0.1),
            "MA 5 Distance": mapUnary(distance5, (value) => value * 0.1),
            "MA Distances Comp": mapUnary(distanceComposite, (value) => value * 0.1),
            "1-2 Cross": cross12,
            "2-3 Cross": cross23,
            "3-4 Cross": cross34,
            "4-5 Cross": cross45,
            "MA Crossing Comp": crossComposite,
            RSI: mapUnary(rsi, (value) => value - 5),
            "RSI MA": mapUnary(rsiAverage, (value) => value - 5),
            "RSI MA Slope": rsiAverageSlope,
            "ATR Short": atrShortAdjusted,
            "ATR Medium": atrMediumAdjusted,
            "ATR Long": atrLongAdjusted,
            "Tab Trend Short": short,
            "Tab Trend Medium": medium,
            "Tab Trend Long": long,
        },
        colors: {
            "MA 1 Slope": COLOR.orange,
            "MA 2 Slope": COLOR.yellow,
            "MA 3 Slope": COLOR.lime,
            "MA 4 Slope": COLOR.blue,
            "MA 5 Slope": COLOR.purple,
            "MA Slope Comp": (index) =>
                valueAt(slopeComposite, index) >= 0 ? COLOR.blue : COLOR.red,
            "MA 1 Derivative": "#FF990066",
            "MA 2 Derivative": "#FFEB3B66",
            "MA 3 Derivative": "#00E67766",
            "MA 4 Derivative": "#68B7F866",
            "MA 5 Derivative": "#A147B166",
            "MA Derivative Comp": "#FFFFFF66",
            "MA 1 Turnover": "#FF9900E6",
            "MA 2 Turnover": "#FFEB3BE6",
            "MA 3 Turnover": "#00E677E6",
            "MA 4 Turnover": "#68B7F8E6",
            "MA 5 Turnover": "#A147B1E6",
            "MA Turnover Comp": COLOR.white,
            "MA 1 Distance": "#FF9900E6",
            "MA 2 Distance": "#FFEB3BE6",
            "MA 3 Distance": "#00E677E6",
            "MA 4 Distance": "#68B7F8E6",
            "MA 5 Distance": "#A147B1E6",
            "MA Distances Comp": COLOR.white,
            "1-2 Cross": COLOR.orange,
            "2-3 Cross": COLOR.yellow,
            "3-4 Cross": COLOR.lime,
            "4-5 Cross": COLOR.purple,
            "MA Crossing Comp": COLOR.white,
            RSI: "#FFFFFF66",
            "RSI MA": COLOR.white,
            "RSI MA Slope": "#FFEB3B99",
            "ATR Short": COLOR.white,
            "ATR Medium": COLOR.white,
            "ATR Long": COLOR.white,
            "Tab Trend Short": COLOR.trendShort,
            "Tab Trend Medium": COLOR.transparentGray,
            "Tab Trend Long": COLOR.transparentGray,
        },
    };
}

type MasmEvaluation = {
    readonly rows: ReadonlyArray<ReferenceExpectedRow["masm"]>;
    readonly thresholdDistances: Readonly<Record<string, number>>;
};

function evaluateMasm(
    bars: ReadonlyArray<ReferenceBar>,
    trendLong: ReadonlyArray<number>,
): MasmEvaluation {
    const close = bars.map((bar) => bar.close);
    const low = bars.map((bar) => bar.low);
    const high = bars.map((bar) => bar.high);
    const atrShort = pineAtr(bars, 14);
    const atrShortPercent = mapBinary(
        atrShort,
        close,
        (atrValue, closeValue) => (atrValue / closeValue) * 100,
    );
    const atr = pineAtr(bars, 100);
    const atrPercent = pineSma(
        mapBinary(atr, close, (atrValue, closeValue) => (atrValue / closeValue) * 100),
        50,
    );
    const ma = pineEma(close, 21);
    const maSlope = percentSlope(ma, 3);
    const maDerivative = mapBinary(
        pineEma(change(maSlope), 6),
        atrPercent,
        (derivative, atrValue) => (derivative / atrValue) * 10,
    );
    const ma8 = pineEma(close, 8);
    const ma50 = pineSma(close, 50);
    const ma50Slope = percentSlope(ma50, 3);
    const maW30 = pineSma(close, 145);
    const maW30Slope = percentSlope(maW30, 4);
    const rsi = pineRsi(close, 14);
    const rsiAverage = pineSma(rsi, 14);
    const rsiAverageSlope = pineEma(change(rsiAverage), 3);
    const rsiAverageDerivative = mapUnary(
        pineEma(change(rsiAverageSlope), 6),
        (value) => value * 10,
    );
    const trendFactorSlope = pineEma(
        mapUnary(change(trendLong), (value) => value * 10),
        5,
    );
    const consolidationRange = mapUnary(atrPercent, (value) => value / 11);
    const consolidationTop = consolidationRange.map((value, index) => {
        const longTrend = valueAt(trendLong, index);
        if (!finite(value) || !finite(longTrend)) return NA;
        // Captured Entry C1 LT adjustment factors are 0.5 / 0.5.
        return longTrend >= 0 ? value / (longTrend * 0.5 + 1) : value * -(longTrend * 0.5 - 1);
    });
    const consolidationBottom = consolidationRange.map((value, index) => {
        const longTrend = valueAt(trendLong, index);
        if (!finite(value) || !finite(longTrend)) return NA;
        return longTrend >= 0 ? -value - longTrend * 0.5 : -value / -(longTrend * 0.5 - 1);
    });
    const consolidationTotal = maSlope.map((value, index) =>
        finite(value) && value >= 0 ? consolidationTop[index] : consolidationBottom[index],
    );
    const consolidationCount = maSlope.map((_value, index) => {
        const currentRange = consolidationRange[index];
        let count = 0;
        for (let offset = 0; offset <= 4; offset += 1) {
            const slope = valueAt(maSlope, index - offset);
            if (slope > currentRange || slope < -currentRange) {
                count = 0;
                break;
            }
            count += 1;
        }
        return count;
    });
    const changePercent = close.map((closeValue, index) => {
        const previousClose = valueAt(close, index - 1);
        return finite(previousClose) ? ((closeValue - previousClose) / previousClose) * 100 : NA;
    });

    const thresholdBuckets: Record<string, number> = {};
    const noteDistance = (name: string, value: number): void => {
        if (!finite(value) || value === 0) return;
        const distance = Math.abs(value);
        thresholdBuckets[name] = Math.min(
            thresholdBuckets[name] ?? Number.POSITIVE_INFINITY,
            distance,
        );
    };

    let longActive = false;
    let longDuration = 0;
    let longEntryPrice = 0;
    let longProfit = 0;
    let longExitSuffix = "-";
    let neverLongVolatilityClose = 0;
    let neverLongVolatilityPreviousClose = 0;
    let neverLongVolatilityCount = 0;
    const volatilityPretrigger: boolean[] = [];
    const rows: Array<ReferenceExpectedRow["masm"]> = [];

    for (let index = 0; index < bars.length; index += 1) {
        const bar = bars[index];
        const oldDurationForAnchor = longDuration;
        longDuration = longActive ? longDuration + 1 : 0;
        if (longActive && longDuration === 0) {
            longEntryPrice = bar.close;
        }
        if (!longActive) {
            longEntryPrice = bar.close;
        }

        const previousClose = close[index - 1] ?? NA;
        const currentChangePercent = changePercent[index];
        // Never-long toggles are captured OFF. Preserve the source state machine
        // with a permanently-false trigger so its output remains auditable.
        const volatilityPre =
            finite(currentChangePercent) && finite(atrShortPercent[index])
                ? currentChangePercent > atrShortPercent[index] * 1.16 && false
                : false;
        volatilityPretrigger.push(volatilityPre);
        const volatilityTrigger =
            volatilityPre &&
            !(
                (volatilityPretrigger[index - 1] ?? false) &&
                currentChangePercent <= valueAt(changePercent, index - 1)
            ) &&
            !(
                (volatilityPretrigger[index - 2] ?? false) &&
                currentChangePercent <= valueAt(changePercent, index - 2)
            );
        if (volatilityTrigger) {
            neverLongVolatilityClose = bar.close;
            neverLongVolatilityPreviousClose = previousClose;
            neverLongVolatilityCount = 1;
        }
        if (neverLongVolatilityCount >= 1 && !volatilityTrigger) neverLongVolatilityCount += 1;
        if (
            neverLongVolatilityCount >= 3 &&
            (bar.close > neverLongVolatilityClose ||
                bar.close < ma[index] ||
                bar.close < neverLongVolatilityPreviousClose)
        ) {
            neverLongVolatilityCount = 0;
        }
        const neverLong1 = false;
        const neverLong2 = neverLongVolatilityCount >= 1;
        const neverLong = neverLong1 || neverLong2;
        const inTimeframe = bar.time >= Date.UTC(2019, 0, 1) && bar.time < Date.UTC(2027, 0, 1);
        const slope = maSlope[index];
        const rsiSlope = rsiAverageSlope[index];
        const rsiDerivative = rsiAverageDerivative[index];
        const range = consolidationRange[index];
        const top = consolidationTop[index];
        const bottom = consolidationBottom[index];
        const consolidationBoundary = consolidationTotal[index];
        noteDistance("masm-consolidation-long-trend-zero", trendLong[index]);
        noteDistance("masm-consolidation-slope-zero", slope);
        noteDistance("masm-consolidation-slope-upper", subtract(slope, range));
        noteDistance("masm-consolidation-slope-lower", add(slope, range));
        noteDistance("masm-consolidation-overlay-boundary", subtract(slope, consolidationBoundary));
        for (let offset = 0; offset <= 4; offset += 1) {
            const historicalSlope = valueAt(maSlope, index - offset);
            noteDistance("masm-consolidation-window-upper", subtract(historicalSlope, range));
            noteDistance("masm-consolidation-window-lower", add(historicalSlope, range));
        }
        noteDistance("entry-c1-ma-slope", subtract(slope, top));
        noteDistance("entry-c1-rsi-slope", rsiSlope);
        noteDistance("entry-c2-rsi-derivative", subtract(rsiDerivative, 2.5));
        noteDistance("entry-c2-rsi-slope-zero", rsiSlope);
        noteDistance("entry-c2-ma-slope-zero", slope);
        noteDistance("entry-c2-negative-ma-guard", add(slope, range));
        noteDistance("entry-c2-negative-branch", slope);
        noteDistance("entry-c2-rsi-negative-branch-cutoff", subtract(rsiSlope, 0.3));
        noteDistance(
            "entry-c2-prior-rsi-derivative-1",
            subtract(valueAt(rsiAverageDerivative, index - 1), 2.5),
        );
        noteDistance(
            "entry-c2-prior-rsi-derivative-2",
            subtract(valueAt(rsiAverageDerivative, index - 2), 2.5),
        );
        noteDistance(
            "entry-c2-prior-rsi-derivative-3",
            subtract(valueAt(rsiAverageDerivative, index - 3), 2.5),
        );
        noteDistance("exit-c1-ma-slope", subtract(slope, bottom));
        noteDistance("masm-ma-derivative-color", add(maDerivative[index], 0.4));
        noteDistance("masm-rsi-slope-color", add(rsiSlope, 1.5));
        noteDistance("masm-rsi-derivative-color", subtract(rsiDerivative, 2.5));

        const entry1 = slope > top && rsiSlope > 0 && !longActive && !neverLong && inTimeframe;
        const entry1Dummy = slope > range && rsiSlope > 0 && !longActive && inTimeframe;
        const entry2 =
            rsiDerivative >= 2.5 &&
            (rsiSlope > 0 || slope > 0) &&
            !(slope < -range) &&
            (slope < 0 ? rsiSlope >= 0.3 : true) &&
            !(
                valueAt(rsiAverageDerivative, index - 1) >= 2.5 &&
                valueAt(rsiAverageDerivative, index - 2) >= 2.5 &&
                valueAt(rsiAverageDerivative, index - 3) >= 2.5
            ) &&
            !longActive &&
            !neverLong &&
            inTimeframe;
        const entry = entry1 || entry2;
        if (entry) longActive = true;

        const stayLong = false;
        const exit1 = slope < bottom && longActive && !stayLong;
        const exit2 = false; // Captured earnings exit OFF; pseudo-feed is not evaluated.
        const exit3 =
            bar.close < longEntryPrice &&
            longDuration > 11 &&
            !(bar.close >= ma8[index]) &&
            longActive &&
            !stayLong;
        const exit4 = false;
        const exit5 = false;
        noteDistance("exit-c3-close-entry", bar.close - longEntryPrice);
        noteDistance("exit-c3-close-ma8", subtract(bar.close, ma8[index]));
        const exit = exit1 || exit2 || exit3 || exit4 || exit5;
        if (exit) {
            longActive = false;
            longProfit = (bar.close - longEntryPrice) / longEntryPrice;
        }

        const histogramColor =
            slope < range && slope > -range && consolidationCount[index] > 4
                ? COLOR.masmPurple
                : slope >= 0
                  ? COLOR.masmGreen
                  : COLOR.masmRed;
        const consolidationBars =
            slope < 0
                ? slope > consolidationTotal[index]
                    ? slope
                    : consolidationTotal[index]
                : slope > consolidationTotal[index]
                  ? consolidationTotal[index]
                  : slope;
        const labels: ReferenceLabel[] = [];
        if (entry2 && !entry1) {
            labels.push({
                id: "long-entry-c2",
                text: "↑",
                barAnchor: index,
                valueAnchor: -1.9,
                kind: "label.style_none/small",
                semanticColor: COLOR.masmGreen,
                pane: "script",
            });
        }
        if (exit) {
            if (exit1) longExitSuffix = " ma";
            if (exit2) longExitSuffix = " ea";
            if (exit3) longExitSuffix = " sl";
            if (exit4) longExitSuffix = " deriv";
            if (exit5) longExitSuffix = " rsi";
            const roundedProfitPercent = (Math.ceil(longProfit * 1000) / 1000) * 100;
            labels.push({
                id: "long-exit",
                text: `${String(roundedProfitPercent)}${longExitSuffix}`,
                barAnchor: index - oldDurationForAnchor / 2,
                valueAnchor: -1.6,
                kind: "label.style_none/small",
                semanticColor:
                    longProfit >= 0.02
                        ? COLOR.masmGreen
                        : longProfit > -0.02
                          ? COLOR.yellow
                          : COLOR.masmRed,
                pane: "script",
            });
        }

        const neverLong1Cancel = neverLong1 && entry1Dummy;
        const neverLong1All = neverLong1 && !entry1Dummy;
        const neverLong2Cancel = neverLong2 && entry1Dummy;
        const neverLong2All = neverLong2 && !entry1Dummy;
        const stayLongCancel = stayLong && exit;
        const plots: Record<string, ReferencePlotPoint> = {
            "MA Slope": plot(slope, histogramColor, "columns"),
            "Consolidation Overlay Bars": plot(
                consolidationBars,
                slope < range && slope > -range && consolidationCount[index] > 4
                    ? COLOR.masmPurple
                    : COLOR.white,
                "columns",
            ),
            "MA Slope derivative": plot(
                maDerivative[index],
                maDerivative[index] < -0.4 ? "#B9B9B9A6" : "#525252A6",
                "columns",
            ),
            "RSI MA Slope": plot(rsiSlope, rsiSlope <= -1.5 ? COLOR.masmRed : COLOR.white, "line"),
            "RSI Deriv": plot(
                rsiDerivative,
                rsiDerivative >= 2.5 ? COLOR.masmGreen : "#FFFFFF80",
                "line",
            ),
            ATR: plot(atrPercent[index], COLOR.yellow, "line"),
            "Consol Range Upper Band": plot(range, COLOR.gray, "line"),
            "Consol Range Lower Band": plot(finite(range) ? -range : NA, COLOR.gray, "line"),
            "Consol Range Top LT adjusted": plot(bottom, COLOR.red, "line"),
            "Consol Range Bottom LT adjusted": plot(top, COLOR.red, "line"),
            "30 WSMA slope": plot(maW30Slope[index], COLOR.white, "line"),
            "Never Long C1 Cancel": plot(neverLong1Cancel ? 1 : NA, COLOR.marker, "shape"),
            "Never Long C1 All": plot(neverLong1All ? 1 : NA, COLOR.markerTransparent, "shape"),
            "Never Long C2 Cancel": plot(neverLong2Cancel ? 1 : NA, COLOR.marker, "shape"),
            "Never Long C2 All": plot(neverLong2All ? 1 : NA, COLOR.markerTransparent, "shape"),
            "Stay Long C Cancel": plot(stayLongCancel ? 1 : NA, COLOR.marker, "shape"),
            "Guideline Top": plot(NA, COLOR.guideline, "step-line"),
            "Guideline Bottom": plot(NA, COLOR.guideline, "line"),
            "Trade Signals Long": plot(NA, COLOR.lime, "circles"),
            "Trade Signals Short": plot(NA, COLOR.red, "circles"),
            "Compmode Strat Profit": plot(NA, COLOR.white, "line"),
            "Compmode Strat Profit Absolute": plot(NA, "#FFFFFF80", "line"),
            "Compmode Hold Profit": plot(NA, "#FFFFFF80", "line"),
            "Compmode request.security Profit": plot(NA, COLOR.blue, "line"),
            "Compmode Strat/Comp_sec": plot(NA, longActive ? COLOR.yellow : COLOR.red, "line"),
        };
        rows.push({
            source: serialized(trendLong[index]),
            histogram: plots["MA Slope"],
            direction: longActive ? "long" : "flat",
            entries: entry ? ["long"] : [],
            exits: exit ? ["long"] : [],
            background: {
                active: longActive,
                semanticColor: longActive ? COLOR.masmGreenBackground : null,
            },
            labels,
            plots,
        });

        // Keep references live to make the translated-but-disabled conditions
        // explicit in the evaluator and source audit.
        void high[index];
        void low[index];
        void ma50Slope[index];
        void trendFactorSlope[index];
    }

    return { rows, thresholdDistances: thresholdBuckets };
}

function materializeTrendPlots(
    trend: TrendSeries,
    index: number,
): Record<string, ReferencePlotPoint> {
    const plots: Record<string, ReferencePlotPoint> = {};
    for (const [name, values] of Object.entries(trend.plots)) {
        const color = trend.colors[name];
        plots[name] = plot(
            valueAt(values, index),
            typeof color === "function" ? color(index) : (color ?? null),
            TREND_PRESENTATION.find((entry) => entry.name === name)?.kind ?? "line",
        );
    }
    return plots;
}

/**
 * Evaluate the canonical Trend Wizard and MASM Pine logic without Chartlang dependencies.
 * @since 1.7
 * @example
 *     const evaluation = evaluateTrendMasmPineReference([]);
 *     void evaluation;
 */
export function evaluateTrendMasmPineReference(
    bars: ReadonlyArray<ReferenceBar>,
): ReferenceEvaluation {
    const trend = evaluateTrend(bars);
    const masm = evaluateMasm(bars, trend.long);
    const expected = bars.map(
        (bar, index): ReferenceExpectedRow => ({
            time: bar.time,
            trend: {
                short: serialized(trend.short[index]),
                medium: serialized(trend.medium[index]),
                long: serialized(trend.long[index]),
                plots: materializeTrendPlots(trend, index),
            },
            masm: masm.rows[index],
        }),
    );
    const thresholdDistances = {
        ...trend.thresholdDistances,
        ...masm.thresholdDistances,
    };
    const distances = Object.values(thresholdDistances).filter(
        (distance) => finite(distance) && distance > 0,
    );
    const minimumDecisionDistance = Math.min(...distances);
    return {
        expected,
        presentation: { trend: TREND_PRESENTATION, masm: MASM_PRESENTATION },
        thresholdDistances,
        minimumDecisionDistance,
    };
}
