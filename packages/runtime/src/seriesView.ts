// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "@invinite-org/chartlang-core";

import type { RingBufferLike } from "./ringBuffer.js";

/**
 * Wrap a `RingBufferLike<T>` in the user-facing `Series<T>` Proxy shape
 *. The Proxy is created **once per backing buffer**
 * at stream/slot construction time and re-used across every bar — its
 * identity is stable so script authors can keep `const ema = ta.ema(...)`
 * at the top of `compute` and reference `ema` the same way every bar.
 *
 * Property reads dispatch as follows:
 * - `series.current` → `buf.at(0)`
 * - `series.length` → `buf.length`
 * - `series.valueOf` / `series[Symbol.toPrimitive]` → a function returning
 *   `buf.at(0)`, so a numeric series coerces to its **current** value in any
 *   value context (`series * 2`, `series > x`, `` `${series}` ``,
 *   `Math.max(series, …)`). This is what lets `bar.close` be used both as a
 *   scalar and indexed as a series. Coercion is harmless for non-numeric
 *   buffers — nothing coerces those. Note `Number.isFinite(series)` is still
 *   `false` (it does not coerce) and `series === 42` is `false` (object vs
 *   number); use `series.current` / `+series` there.
 * - `series[n]` (string coerces to a non-negative integer) → `buf.at(n)`
 * - any other key → `undefined`
 *
 * For numeric buffers (`Float64RingBuffer`) out-of-range reads return
 * `NaN`; for object buffers they return `undefined`. The Proxy passes
 * the underlying sentinel through verbatim.
 *
 * @since 0.1
 * @example
 *     // import { Float64RingBuffer, makeSeriesView }
 *     //     from "@invinite-org/chartlang-runtime";
 *     // const buf = new Float64RingBuffer(8);
 *     // const view = makeSeriesView<number>(buf);
 *     // buf.append(42);
 *     // view.current; // 42
 *     // view[0];      // 42
 *     // view.length;  // 1
 */
export function makeSeriesView<T>(buf: RingBufferLike<T>): Series<T> {
    return new Proxy({} as Series<T>, {
        get(_target, prop) {
            if (prop === "current") return buf.at(0);
            if (prop === "length") return buf.length;
            if (prop === "valueOf") return () => buf.at(0);
            if (prop === Symbol.toPrimitive) return () => buf.at(0);
            if (typeof prop === "string") {
                const n = Number(prop);
                if (Number.isInteger(n) && n >= 0) return buf.at(n);
            }
            return undefined;
        },
        has(_target, prop) {
            if (prop === "current" || prop === "length") return true;
            if (prop === "valueOf" || prop === Symbol.toPrimitive) return true;
            if (typeof prop === "string") {
                const n = Number(prop);
                return Number.isInteger(n) && n >= 0;
            }
            return false;
        },
    });
}

/**
 * Module-level side-table recording the **presentation x-shift** declared
 * for an offset-tagged Series view. `offset` is no longer a value-read
 * transform (Option A, bidirectional-plot-offset): the series value is
 * always the unshifted `buf.at(0)`; the recorded offset rides the plot
 * emission as `PlotEmission.xShift` so the adapter renders the series
 * shifted (`+n` right / future, `−n` left / past) without changing the
 * numbers alerts and `state.*` see. Keyed weakly on the view object so a
 * dropped slot's tag is collected with it.
 */
const seriesOffsets = new WeakMap<Series<unknown>, number>();

/**
 * Offset-tagging variant of {@link makeSeriesView}. It returns the
 * **unshifted** view (delegating to {@link makeSeriesView}) and, for a
 * non-zero `offset`, records `view → offset` in a module-level
 * `WeakMap` side-table read by `plot()` via {@link seriesOffsetOf}. The
 * offset is **presentation-only** — `view.current` is `buf.at(0)`, not a
 * value `offset` bars ago — so both shift directions are expressible and
 * alerts / `state.*` see the unshifted value. `offset === 0` records
 * nothing (byte-identical to a plain {@link makeSeriesView}).
 *
 * Callers cache the returned view per `(slot, offset)` pair so the
 * view's identity — and therefore its recorded offset — stays stable
 * across bars.
 *
 * @since 0.2
 * @stable
 * @example
 *     // import { Float64RingBuffer, makeShiftedSeriesView, seriesOffsetOf }
 *     //     from "@invinite-org/chartlang-runtime";
 *     // const buf = new Float64RingBuffer(8);
 *     // buf.append(10); buf.append(20); buf.append(30);
 *     // const view = makeShiftedSeriesView<number>(buf, 5);
 *     // view.current;          // 30 (unshifted — the offset does NOT lag the read)
 *     // seriesOffsetOf(view);  // 5 (presentation x-shift carried to the emission)
 */
export function makeShiftedSeriesView<T>(buf: RingBufferLike<T>, offset: number): Series<T> {
    const view = makeSeriesView<T>(buf);
    if (offset !== 0) seriesOffsets.set(view, offset);
    return view;
}

/**
 * Read the presentation x-shift recorded for `series` by
 * {@link makeShiftedSeriesView}, or `0` when the series is untagged (a
 * plain {@link makeSeriesView} view, an `offset === 0` view, or any
 * non-runtime Series). `plot()` calls this to populate
 * `PlotEmission.xShift`; a `0` result omits the field so a no-offset
 * plot stays byte-identical to today.
 *
 * @since 0.2
 * @stable
 * @example
 *     // import { Float64RingBuffer, makeShiftedSeriesView, seriesOffsetOf }
 *     //     from "@invinite-org/chartlang-runtime";
 *     // const buf = new Float64RingBuffer(8);
 *     // const shifted = makeShiftedSeriesView<number>(buf, -3);
 *     // seriesOffsetOf(shifted); // -3
 */
export function seriesOffsetOf(series: Series<unknown>): number {
    return seriesOffsets.get(series) ?? 0;
}
