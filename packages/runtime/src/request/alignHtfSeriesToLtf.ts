// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/align-htf-series-to-ltf.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed -- Series<T> shape, JSDoc, runtime context.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import type { Bar } from "@invinite-org/chartlang-core";

/**
 * Align an HTF series to the LTF time grid (PLAN.md §6.8).
 *
 * `htf` and `ltf` must be sorted ascending by `time`; callers own that
 * precondition. The output has one entry per LTF bar where each value is the
 * most recent HTF series value whose `[open, next-open)` window contains the
 * LTF bar's open time — i.e. the running, in-progress HTF value at LTF time
 * `t`. `bar.time` is treated as the bar's open, so an HTF bar becomes the
 * active value as soon as the LTF cursor reaches its open time and stays
 * active until the next HTF open. This deliberately exposes the in-progress
 * secondary bar to script land per PLAN.md §6.8; do not "fix" it to bar-close
 * lookahead-off semantics.
 *
 * @formula Two-pointer walk over ascending HTF and LTF bar times; no
 * look-ahead because the HTF cursor advances only while `htf.time <= ltf.time`.
 * @warmup None; LTF bars before the first HTF bar receive `NaN`.
 * @since 0.5
 * @stable
 * @internal
 * @example
 *     const aligned = alignHtfSeriesToLtf(htfBars, htfCloses, ltfBars);
 *     void aligned;
 */
export function alignHtfSeriesToLtf(
    htf: ReadonlyArray<Bar>,
    htfSeries: ReadonlyArray<number>,
    ltf: ReadonlyArray<Bar>,
): ReadonlyArray<number> {
    const out = new Array<number>(ltf.length);

    if (htf.length === 0 || ltf.length === 0) {
        out.fill(Number.NaN);
        return out;
    }

    let htfCursor = 0;
    let lastIdx = -1;

    for (let i = 0; i < ltf.length; i += 1) {
        const t = ltf[i].time;

        while (htfCursor < htf.length && htf[htfCursor].time <= t) {
            lastIdx = htfCursor;
            htfCursor += 1;
        }

        out[i] = lastIdx >= 0 ? htfSeries[lastIdx] : Number.NaN;
    }

    return out;
}
