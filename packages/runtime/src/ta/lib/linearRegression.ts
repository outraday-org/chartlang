// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/linear-regression.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.

/**
 * Per-slot OLS rolling regression result over a `Float64Array`
 * window. Each of the three Float64Array fields has the same length
 * as the input source; warmup slots are NaN.
 *
 * @formula  N/A — return-bundle type for {@link linearRegression}
 * @since 0.2
 * @stable
 * @example
 *     // const r: LinearRegressionFrame = linearRegression(close, 20);
 */
export type LinearRegressionFrame = Readonly<{
    slope: Float64Array;
    intercept: Float64Array;
    value: Float64Array;
}>;

/**
 * Rolling ordinary-least-squares fit of `y = a + b·x` over each
 * trailing `length`-bar window, with `x = 0 .. length - 1` (bar
 * index inside the window). Returns three same-length arrays:
 *
 * - `slope[i]`     — the `b` coefficient at slot `i`.
 * - `intercept[i]` — the `a` coefficient.
 * - `value[i]`     — the regression line evaluated at the last bar
 *                    of the window (`intercept + slope * (length - 1)`).
 *                    This is the LSMA value at `i`.
 *
 * Closed-form formula:
 *   `slope = (N·Σxy − Σx·Σy) / (N·Σx² − (Σx)²)` —
 * since `x` is `0..N-1`, `Σx² − (Σx)²/N` is a constant of `length`
 * and is precomputed once outside the slot loop.
 *
 * Warmup `[0, length - 2]` is `NaN` on all three outputs. Any NaN
 * inside the window propagates `NaN` at that slot only.
 *
 * @formula  xMean   = (length - 1) / 2 ;
 *           xDev[j] = j - xMean ;
 *           sumXX   = Σ xDev² ;
 *           slope   = Σ(xDev * (y - yMean)) / sumXX ;
 *           intercept = yMean - slope * xMean ;
 *           value   = intercept + slope * (length - 1)
 * @warmup   length - 1
 * @since 0.2
 * @stable
 * @example
 *     // import { linearRegression } from "./linearRegression";
 *     // const { slope, intercept, value } = linearRegression(close, 20);
 */
export function linearRegression(source: Float64Array, length: number): LinearRegressionFrame {
    const n = source.length;
    const slope = new Float64Array(n);
    const intercept = new Float64Array(n);
    const value = new Float64Array(n);
    slope.fill(Number.NaN);
    intercept.fill(Number.NaN);
    value.fill(Number.NaN);
    if (length < 2 || n === 0 || n < length) {
        return { intercept, slope, value };
    }

    const xMean = (length - 1) / 2;
    const xDev = new Float64Array(length);
    let sumXX = 0;
    for (let j = 0; j < length; j += 1) {
        const dev = j - xMean;
        xDev[j] = dev;
        sumXX += dev * dev;
    }

    for (let i = length - 1; i < n; i += 1) {
        const startIdx = i - length + 1;
        let sumY = 0;
        let windowFinite = true;
        for (let j = 0; j < length; j += 1) {
            const v = source[startIdx + j];
            if (!Number.isFinite(v)) {
                windowFinite = false;
                break;
            }
            sumY += v;
        }
        if (!windowFinite) continue;

        const yMean = sumY / length;
        let num = 0;
        for (let j = 0; j < length; j += 1) {
            num += xDev[j] * (source[startIdx + j] - yMean);
        }
        const m = num / sumXX;
        const b = yMean - m * xMean;
        slope[i] = m;
        intercept[i] = b;
        value[i] = b + m * (length - 1);
    }

    return { intercept, slope, value };
}
