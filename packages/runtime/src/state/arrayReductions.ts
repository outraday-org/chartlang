// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Float64RingBuffer } from "../ringBuffer.js";

/**
 * Pure numeric reductions over a {@link Float64RingBuffer}'s currently-filled
 * region. They back the `MutableArraySlot<number>` analytic methods
 * (`win.avg()`, `win.stdev()`, …) and the Pine-parity `array.*` namespace that
 * delegates to them. Each walks the ring once via `ring.at(i)` for
 * `i ∈ [0, length)` (0 = newest) — a direct backing-array read, **not** the
 * handle's `get(n)` closure — so a reduction is O(size) with no per-element
 * proxy hop.
 *
 * **NaN policy.** `sum`/`avg`/`min`/`max`/`range`/`variance`/`stdev`/`median`/
 * `percentile` **skip** `NaN` elements (matching the `ta.*` weighted-window
 * convention); an empty or all-`NaN` window returns `NaN`, never `0`.
 * `±Infinity` is **not** skipped — it propagates (pushing it is the author's
 * concern). `sort` is deliberately **not** in the skip set: it copies the whole
 * filled region. `indexOf` / `includes` search every filled element.
 *
 * The math reference is reused, not re-derived: the population/sample stdev
 * denominator follows `ta/lib/rollingStddev.ts`, and `quantile(_, 0.5)` is
 * numerically identical to `ta/median.ts`'s even/odd midpoint rule.
 */

const isSkipped = (v: number): boolean => Number.isNaN(v);

/**
 * Σ of the non-`NaN` elements; `NaN` if the window is empty / all-`NaN`.
 *
 * @since 1.4
 * @stable
 * @example
 *     const r = new Float64RingBuffer(3);
 *     r.append(1);
 *     r.append(2);
 *     reduceSum(r); // 3
 */
export function reduceSum(ring: Float64RingBuffer): number {
    const n = ring.length;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < n; i += 1) {
        const v = ring.at(i);
        if (isSkipped(v)) continue;
        sum += v;
        count += 1;
    }
    return count === 0 ? Number.NaN : sum;
}

/**
 * Arithmetic mean of the non-`NaN` elements; `NaN` if empty / all-`NaN`.
 *
 * @since 1.4
 * @stable
 * @example
 *     const r = new Float64RingBuffer(3);
 *     r.append(1);
 *     r.append(3);
 *     reduceAvg(r); // 2
 */
export function reduceAvg(ring: Float64RingBuffer): number {
    const n = ring.length;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < n; i += 1) {
        const v = ring.at(i);
        if (isSkipped(v)) continue;
        sum += v;
        count += 1;
    }
    return count === 0 ? Number.NaN : sum / count;
}

/**
 * Minimum of the non-`NaN` elements; `NaN` if empty / all-`NaN`.
 *
 * @since 1.4
 * @stable
 * @example
 *     const r = new Float64RingBuffer(3);
 *     r.append(5);
 *     r.append(2);
 *     reduceMin(r); // 2
 */
export function reduceMin(ring: Float64RingBuffer): number {
    const n = ring.length;
    let min = Number.POSITIVE_INFINITY;
    let count = 0;
    for (let i = 0; i < n; i += 1) {
        const v = ring.at(i);
        if (isSkipped(v)) continue;
        if (v < min) min = v;
        count += 1;
    }
    return count === 0 ? Number.NaN : min;
}

/**
 * Maximum of the non-`NaN` elements; `NaN` if empty / all-`NaN`.
 *
 * @since 1.4
 * @stable
 * @example
 *     const r = new Float64RingBuffer(3);
 *     r.append(5);
 *     r.append(2);
 *     reduceMax(r); // 5
 */
export function reduceMax(ring: Float64RingBuffer): number {
    const n = ring.length;
    let max = Number.NEGATIVE_INFINITY;
    let count = 0;
    for (let i = 0; i < n; i += 1) {
        const v = ring.at(i);
        if (isSkipped(v)) continue;
        if (v > max) max = v;
        count += 1;
    }
    return count === 0 ? Number.NaN : max;
}

/**
 * `max − min` over the non-`NaN` elements (single pass); `NaN` if empty /
 * all-`NaN`.
 *
 * @since 1.4
 * @stable
 * @example
 *     const r = new Float64RingBuffer(3);
 *     r.append(5);
 *     r.append(2);
 *     reduceRange(r); // 3
 */
export function reduceRange(ring: Float64RingBuffer): number {
    const n = ring.length;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let count = 0;
    for (let i = 0; i < n; i += 1) {
        const v = ring.at(i);
        if (isSkipped(v)) continue;
        if (v < min) min = v;
        if (v > max) max = v;
        count += 1;
    }
    return count === 0 ? Number.NaN : max - min;
}

/**
 * Variance via the numerically-stable **Welford** single pass (never
 * `Σx² − (Σx)²/n`). Population (denominator `count`) by default; sample
 * (`count − 1`) when `biased === false`. Returns `NaN` when the denominator is
 * `≤ 0` (empty window always; sample with `count < 2`).
 *
 * @since 1.4
 * @stable
 * @example
 *     const r = new Float64RingBuffer(3);
 *     r.append(2);
 *     r.append(4);
 *     reduceVariance(r); // 1 (population)
 */
export function reduceVariance(ring: Float64RingBuffer, biased = true): number {
    const n = ring.length;
    let count = 0;
    let mean = 0;
    let m2 = 0;
    for (let i = 0; i < n; i += 1) {
        const v = ring.at(i);
        if (isSkipped(v)) continue;
        count += 1;
        const delta = v - mean;
        mean += delta / count;
        m2 += delta * (v - mean);
    }
    const denom = biased ? count : count - 1;
    return denom <= 0 ? Number.NaN : m2 / denom;
}

/**
 * Standard deviation — `sqrt` of {@link reduceVariance} (population by default,
 * sample when `biased === false`). `NaN` when the variance is undefined.
 *
 * @since 1.4
 * @stable
 * @example
 *     const r = new Float64RingBuffer(3);
 *     r.append(2);
 *     r.append(4);
 *     reduceStdev(r); // 1 (population)
 */
export function reduceStdev(ring: Float64RingBuffer, biased = true): number {
    return Math.sqrt(reduceVariance(ring, biased));
}

/**
 * Copy the non-`NaN` elements into a fresh scratch array sorted ascending.
 * Backs {@link reduceMedian} / {@link reducePercentile}; allocates one array
 * (the documented exception to the allocation-free hot path).
 */
function collectSortedFinite(ring: Float64RingBuffer): number[] {
    const n = ring.length;
    const out: number[] = [];
    for (let i = 0; i < n; i += 1) {
        const v = ring.at(i);
        if (isSkipped(v)) continue;
        out.push(v);
    }
    out.sort((a, b) => a - b);
    return out;
}

/**
 * Linear-interpolation-between-closest-ranks quantile of an ascending `sorted`
 * array, `q ∈ [0, 1]` (numpy / R-7 default; Pine
 * `array.percentile_linear_interpolation`). `q = 0.5` reproduces `ta.median`'s
 * even/odd midpoint exactly. `NaN` on an empty array.
 */
function quantile(sorted: ReadonlyArray<number>, q: number): number {
    const k = sorted.length;
    if (k === 0) return Number.NaN;
    const pos = q * (k - 1);
    const lo = Math.floor(pos);
    if (lo === k - 1) return sorted[lo];
    const frac = pos - lo;
    return sorted[lo] + (sorted[lo + 1] - sorted[lo]) * frac;
}

/**
 * Median (50th percentile, linear interpolation) of the non-`NaN` elements;
 * `NaN` if empty / all-`NaN`. Identical math to `ta.median`.
 *
 * @since 1.4
 * @stable
 * @example
 *     const r = new Float64RingBuffer(3);
 *     r.append(1);
 *     r.append(2);
 *     r.append(3);
 *     reduceMedian(r); // 2
 */
export function reduceMedian(ring: Float64RingBuffer): number {
    return quantile(collectSortedFinite(ring), 0.5);
}

/**
 * `p`-th percentile (`p ∈ [0, 100]`, clamped) of the non-`NaN` elements, linear
 * interpolation; `NaN` if empty / all-`NaN`.
 *
 * @since 1.4
 * @stable
 * @example
 *     const r = new Float64RingBuffer(4);
 *     r.append(1);
 *     r.append(2);
 *     r.append(3);
 *     r.append(4);
 *     reducePercentile(r, 50); // 2.5
 */
export function reducePercentile(ring: Float64RingBuffer, p: number): number {
    const clamped = Math.min(100, Math.max(0, p));
    return quantile(collectSortedFinite(ring), clamped / 100);
}

/**
 * First index (0 = newest) of `value` by strict equality (mirrors
 * `Array.indexOf`; cannot find `NaN`), or `-1`.
 *
 * @since 1.4
 * @stable
 * @example
 *     const r = new Float64RingBuffer(3);
 *     r.append(7);
 *     r.append(9);
 *     reduceIndexOf(r, 7); // 1
 */
export function reduceIndexOf(ring: Float64RingBuffer, value: number): number {
    const n = ring.length;
    for (let i = 0; i < n; i += 1) {
        if (ring.at(i) === value) return i;
    }
    return -1;
}

/**
 * Whether `value` is present (mirrors `Array.includes` SameValueZero — *does*
 * find `NaN`).
 *
 * @since 1.4
 * @stable
 * @example
 *     const r = new Float64RingBuffer(3);
 *     r.append(7);
 *     reduceIncludes(r, 7); // true
 */
export function reduceIncludes(ring: Float64RingBuffer, value: number): boolean {
    const n = ring.length;
    const targetIsNaN = Number.isNaN(value);
    for (let i = 0; i < n; i += 1) {
        const v = ring.at(i);
        if (v === value || (targetIsNaN && Number.isNaN(v))) return true;
    }
    return false;
}

/**
 * Fresh sorted **copy** of the whole filled region (ascending by default,
 * descending when `order === "desc"`). Never reads the committed ring and never
 * mutates either ring — the FIFO keeps its insertion order for eviction. `NaN`
 * elements are **not** skipped here (unlike the statistical reductions); they
 * are copied as-is. Empty window → `[]`.
 *
 * @since 1.4
 * @stable
 * @example
 *     const r = new Float64RingBuffer(3);
 *     r.append(3);
 *     r.append(1);
 *     r.append(2);
 *     reduceSort(r); // [1, 2, 3]
 */
export function reduceSort(ring: Float64RingBuffer, order?: "asc" | "desc"): number[] {
    const n = ring.length;
    const out: number[] = [];
    for (let i = 0; i < n; i += 1) {
        out.push(ring.at(i));
    }
    out.sort((a, b) => a - b);
    if (order === "desc") out.reverse();
    return out;
}
