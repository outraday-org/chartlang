// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/williams-fractal.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Williams Fractal is self-contained — no
// composition with `ta.highest` / `ta.lowest` because the centre bar
// must be EXCLUDED from the windowed strict-extreme comparison (and
// the sub-primitives don't expose that semantic). The slot owns a
// `2 · length + 1` ring buffer per side (high / low) and scans it
// per close. Output deviates from the task spec's literal "boolean"
// wording in favour of price levels (matches invinite's
// `upFractals[i] = high`); this gives the `marker` plot a y-anchor.

import type { WilliamsFractalOpts, WilliamsFractalResult } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";

const DEFAULT_LENGTH = 2;

type WilliamsFractalSlot = {
    readonly outputs: WilliamsFractalResult;
    readonly upBuffer: Float64RingBuffer;
    readonly downBuffer: Float64RingBuffer;
    readonly length: number;
    /**
     * Trailing `2 · length + 1` highs. `at(0)` is the most recent
     * close (right-window head); `at(length)` is the centre bar;
     * `at(2 · length)` is the oldest left-window bar.
     */
    readonly highWindow: Float64RingBuffer;
    /** Trailing `2 · length + 1` lows (centred window). */
    readonly lowWindow: Float64RingBuffer;
    /** Number of CLOSED bars folded into the slot so far. */
    barCount: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.williamsFractal called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number, length: number): WilliamsFractalSlot {
    const upBuffer = new Float64RingBuffer(capacity);
    const downBuffer = new Float64RingBuffer(capacity);
    const windowSize = 2 * length + 1;
    return {
        outputs: Object.freeze({
            up: makeSeriesView<number>(upBuffer),
            down: makeSeriesView<number>(downBuffer),
        }),
        upBuffer,
        downBuffer,
        length,
        highWindow: new Float64RingBuffer(windowSize),
        lowWindow: new Float64RingBuffer(windowSize),
        barCount: 0,
    };
}

/**
 * Scan the centred window for an up-fractal at the centre bar (age
 * `length`). Returns `centreHigh` if the centre's high is strictly
 * greater than every other entry in `[0, 2·length]` (NaN entries
 * fail the comparison — any NaN means no fractal). `headHigh` is
 * the substitute value for age 0 (`highWindow.at(0)`); tick replay
 * passes the tick's high there.
 */
function scanUpFractal(highWindow: Float64RingBuffer, headHigh: number, length: number): number {
    const centreHigh = highWindow.at(length);
    if (!Number.isFinite(centreHigh)) return Number.NaN;
    const windowSize = 2 * length + 1;
    for (let k = 0; k < windowSize; k += 1) {
        if (k === length) continue;
        const v = k === 0 ? headHigh : highWindow.at(k);
        if (!Number.isFinite(v)) return Number.NaN;
        if (v >= centreHigh) return Number.NaN;
    }
    return centreHigh;
}

/**
 * Scan the centred window for a down-fractal at the centre bar.
 * Mirrors {@link scanUpFractal} with `<` / `centreLow`.
 */
function scanDownFractal(lowWindow: Float64RingBuffer, headLow: number, length: number): number {
    const centreLow = lowWindow.at(length);
    if (!Number.isFinite(centreLow)) return Number.NaN;
    const windowSize = 2 * length + 1;
    for (let k = 0; k < windowSize; k += 1) {
        if (k === length) continue;
        const v = k === 0 ? headLow : lowWindow.at(k);
        if (!Number.isFinite(v)) return Number.NaN;
        if (v <= centreLow) return Number.NaN;
    }
    return centreLow;
}

/**
 * Williams Fractal — centred-window pivot detector. For each centre
 * bar `c`, marks an **up-fractal** if `bar.high(c)` is strictly
 * greater than every `bar.high` in the symmetric `length`-bar window
 * on either side (`c − length .. c − 1` ∪ `c + 1 .. c + length`).
 * Mirrors for **down-fractal** with `bar.low`.
 *
 * Output is centred — at live bar `t`, the value emitted at
 * `up.current` / `down.current` is the fractal status of bar `t −
 * length` (when bar `t` closes, we now have enough right-window bars
 * to confirm bar `t − length`). The most recent `length` slots of
 * the output Series are intentionally NaN (pending right-window
 * confirmation). Warmup is `2 · length` bars before the first
 * confirmed centre.
 *
 * Outputs encode **price levels**: `up.current` = `bar.high(centre)`
 * when up-fractal, NaN otherwise; `down.current` = `bar.low(centre)`
 * when down-fractal, NaN otherwise. This gives the `marker` plot a
 * y-anchor (matches invinite's `upFractals[i] = high`). The task
 * spec's literal "boolean" wording is intentionally not honoured
 * because (a) the script-facing `plot()` only accepts numeric
 * series, (b) the marker style needs a price to anchor at, and (c)
 * level-series is what every reference implementation actually
 * does. NaN in any window slot → no fractal at the centre.
 *
 * Returns a cached `{ up, down }` record (same identity every bar).
 *
 * @formula  up   = bar.high(centre) when strict argmax over [c−L, c+L] excluding c, NaN otherwise ;
 *           down = bar.low(centre)  when strict argmin over [c−L, c+L] excluding c, NaN otherwise
 * @warmup   2 · length
 * @anchors  length
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const f = ta.williamsFractal();
 *     // plot(f.up,   { style: { kind: "marker", shape: "triangle-up",   size: 6 } });
 *     // plot(f.down, { style: { kind: "marker", shape: "triangle-down", size: 6 } });
 */
export function williamsFractal(slotId: string, opts?: WilliamsFractalOpts): WilliamsFractalResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as WilliamsFractalSlot | undefined;
    if (slot === undefined) {
        const length = opts?.length ?? DEFAULT_LENGTH;
        slot = initSlot(ctx.stream.ohlcv.close.capacity, length);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const bar = ctx.stream.bar;
    const windowSize = 2 * slot.length + 1;

    if (ctx.isTick) {
        // Tick: substitute head (age 0) with the tick's high/low; centre
        // is still at age `length` in the closed window. Warmup
        // requires `barCount >= windowSize`.
        if (slot.barCount < windowSize) {
            slot.upBuffer.replaceHead(Number.NaN);
            slot.downBuffer.replaceHead(Number.NaN);
        } else {
            slot.upBuffer.replaceHead(scanUpFractal(slot.highWindow, bar.high, slot.length));
            slot.downBuffer.replaceHead(scanDownFractal(slot.lowWindow, bar.low, slot.length));
        }
    } else {
        slot.highWindow.append(bar.high);
        slot.lowWindow.append(bar.low);
        slot.barCount += 1;
        if (slot.barCount < windowSize) {
            slot.upBuffer.append(Number.NaN);
            slot.downBuffer.append(Number.NaN);
        } else {
            // Close-side: head (age 0) IS this bar's high/low (we just
            // appended). Scan with `headHigh = highWindow.at(0)` —
            // i.e. no substitution.
            slot.upBuffer.append(
                scanUpFractal(slot.highWindow, slot.highWindow.at(0), slot.length),
            );
            slot.downBuffer.append(
                scanDownFractal(slot.lowWindow, slot.lowWindow.at(0), slot.length),
            );
        }
    }
    return slot.outputs;
}
