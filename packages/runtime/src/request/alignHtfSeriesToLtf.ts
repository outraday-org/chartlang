// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/align-htf-series-to-ltf.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed -- Series<T> shape, JSDoc, runtime context.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import type { Bar } from "@invinite-org/chartlang-core";

/**
 * Align a secondary series to the main (`ltf`) time grid.
 *
 * `htf` and `ltf` must be sorted ascending by `time`; callers own that
 * precondition. The `htf`/`ltf` names are historical (the kernel was HTF-only);
 * `htf` is the SECONDARY stream — coarser, equal, OR finer than the main `ltf`
 * stream — and `ltf` is always the MAIN stream.
 *
 * **Coarser / equal secondary (`secondaryIsFinerThanMain === false`, default):**
 * each main bar gets the most recent secondary value whose `[open, next-open)`
 * window contains the main bar's open time — i.e. the running, in-progress
 * secondary value at main time `t`. `bar.time` is the bar's open, so a secondary
 * bar becomes active as soon as the main cursor reaches its open time and stays
 * active until the next secondary open. This deliberately exposes the in-progress
 * coarser bar to script land; do not "fix" it to bar-close lookahead-off
 * semantics.
 *
 * **Finer secondary (`secondaryIsFinerThanMain === true`):** each main bar gets
 * the value of the LAST secondary bar that closed at/before the main bar's close
 * (the most recent sub-bar), non-repainting. See {@link alignSecondaryFinerThanMain}.
 *
 * @formula Two-pointer walk over ascending secondary and main bar times; no
 * look-ahead — the coarser cursor advances only while `htf.time <= ltf.time`,
 * the finer cursor only while `secondary.time < next-main-open`.
 * @warmup None; main bars before the first usable secondary bar receive `NaN`.
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
    secondaryIsFinerThanMain = false,
): ReadonlyArray<number> {
    const out = new Array<number>(ltf.length);

    if (htf.length === 0 || ltf.length === 0) {
        out.fill(Number.NaN);
        return out;
    }

    if (secondaryIsFinerThanMain) {
        return alignSecondaryFinerThanMain(htf, htfSeries, ltf, out);
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

/**
 * Finer-secondary alignment (secondary interval < main interval). Each main bar
 * is aligned to the LAST secondary bar that closed at/before the main bar's
 * close — i.e. the most recent sub-bar — read non-repainting.
 *
 * The bound is the **next main open**: a secondary bar belongs to main bar `i`
 * iff `secondary.time < main[i + 1].time`, because the next main bar's open IS
 * this main bar's close. This needs no explicit duration. Because the secondary
 * series value is captured at the secondary bar's CLOSE
 * (`securityExprRunner.ts`), the most recent sub-bar opened strictly before the
 * next main open is exactly the most recent sub-bar that has CLOSED at/before
 * this main bar's close — so the walk never reads a sub-bar that closes after
 * the main bar's close (no look-ahead, no repaint: a closed main bar's bound is
 * fixed, so its value never changes as later sub-bars arrive).
 *
 * The final (in-progress) main bar has no successor, so it takes the most recent
 * secondary bar seen (the running head) — the finer mirror of the coarser
 * branch's in-progress exposure. Main bars before the first sub-bar closes get
 * `NaN`; a main bar with no sub-bars carries the last known value forward.
 *
 * @formula Pure O(n+m) two-pointer pass; `secondary` and `main` ascending.
 * @internal
 */
function alignSecondaryFinerThanMain(
    secondary: ReadonlyArray<Bar>,
    secondarySeries: ReadonlyArray<number>,
    main: ReadonlyArray<Bar>,
    out: number[],
): ReadonlyArray<number> {
    let secCursor = 0;
    let lastIdx = -1;

    for (let i = 0; i < main.length; i += 1) {
        // Next main open = this main bar's close. The final in-progress main bar
        // has no successor, so it absorbs every remaining (running) sub-bar.
        const bound = i + 1 < main.length ? main[i + 1].time : Number.POSITIVE_INFINITY;

        while (secCursor < secondary.length && secondary[secCursor].time < bound) {
            lastIdx = secCursor;
            secCursor += 1;
        }

        out[i] = lastIdx >= 0 ? secondarySeries[lastIdx] : Number.NaN;
    }

    return out;
}
