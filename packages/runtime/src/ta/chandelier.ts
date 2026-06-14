// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/chandelier.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Chandelier composes Phase-1 `ta.atr` plus
// Task-5 `ta.highest` / `ta.lowest` at sub-slots `${slotId}/atr`,
// `${slotId}/highHigh`, `${slotId}/lowLow` (sources from `bar.high` /
// `bar.low` per Pine `ta.chandelier_exit`; invinite's `source` field
// — defaults to close — is deliberately dropped in favour of the
// Pine-canonical bar-high/low reading).

import type { ChandelierOpts, ChandelierResult } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { atr } from "./atr.js";
import { highest } from "./highest.js";
import { lowest } from "./lowest.js";

const DEFAULT_LENGTH = 22;
const DEFAULT_MULTIPLIER = 3;

type ChandelierSlot = {
    readonly outputs: ChandelierResult;
    readonly longBuffer: Float64RingBuffer;
    readonly shortBuffer: Float64RingBuffer;
    readonly length: number;
    readonly multiplier: number;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.chandelier called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number, length: number, multiplier: number): ChandelierSlot {
    const longBuffer = new Float64RingBuffer(capacity);
    const shortBuffer = new Float64RingBuffer(capacity);
    return {
        outputs: Object.freeze({
            long: makeSeriesView<number>(longBuffer),
            short: makeSeriesView<number>(shortBuffer),
        }),
        longBuffer,
        shortBuffer,
        length,
        multiplier,
    };
}

function compute(
    hi: number,
    lo: number,
    atrValue: number,
    multiplier: number,
): { long: number; short: number } {
    if (!Number.isFinite(hi) || !Number.isFinite(lo) || !Number.isFinite(atrValue)) {
        return { long: Number.NaN, short: Number.NaN };
    }
    return {
        long: hi - multiplier * atrValue,
        short: lo + multiplier * atrValue,
    };
}

/**
 * Chandelier Exit — two ATR-offset trailing stops anchored to the
 * trailing `length`-bar extremes. `long` is the trailing stop for
 * long trades (highest of `bar.high` over the window minus
 * `multiplier · ATR`); `short` is the symmetric stop for short
 * trades (lowest of `bar.low` plus `multiplier · ATR`). Composes
 * `ta.atr` plus `ta.highest` / `ta.lowest` at sub-slots
 * `${slotId}/atr` / `${slotId}/highHigh` / `${slotId}/lowLow`. Returns
 * a cached `{ long, short }` record (same identity every bar).
 *
 * Source field is hard-coded to `bar.high` (for the upper window)
 * and `bar.low` (for the lower window) — matches Pine
 * `ta.chandelier_exit` and the conventional TradingView reading.
 * Invinite's `source` parameter (default `close`) is deliberately
 * omitted; a `source` opt could land in a follow-up.
 *
 * NaN in ATR or the rolling extreme → NaN at both outputs. The
 * composed sub-slots each handle their own tick replay; tick-side
 * just reads `series.current` from each sub-slot and recomputes.
 *
 * @formula  long  = highest(bar.high, length) − multiplier · atr(length) ;
 *           short = lowest(bar.low,   length) + multiplier · atr(length)
 * @warmup   length
 * @anchors  length, multiplier
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const c = ta.chandelier({ length: 22, multiplier: 3 });
 *     // plot(c.long);
 *     // plot(c.short);
 */
export function chandelier(slotId: string, opts?: ChandelierOpts): ChandelierResult {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as ChandelierSlot | undefined;
    if (slot === undefined) {
        const length = opts?.length ?? DEFAULT_LENGTH;
        const multiplier = opts?.multiplier ?? DEFAULT_MULTIPLIER;
        slot = initSlot(ctx.stream.ohlcv.close.capacity, length, multiplier);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const bar = ctx.stream.bar;
    // Compose: ta.atr + ta.highest + ta.lowest at sub-slots. The
    // composed calls route through the registry and respect ctx.isTick
    // automatically (each sub-slot owns its own tick-replay).
    const atrSeries = atr(`${slotId}/atr`, slot.length);
    const highSeries = highest(`${slotId}/highHigh`, bar.high, slot.length);
    const lowSeries = lowest(`${slotId}/lowLow`, bar.low, slot.length);

    const result = compute(
        highSeries.current,
        lowSeries.current,
        atrSeries.current,
        slot.multiplier,
    );
    if (ctx.isTick) {
        slot.longBuffer.replaceHead(result.long);
        slot.shortBuffer.replaceHead(result.short);
    } else {
        slot.longBuffer.append(result.long);
        slot.shortBuffer.append(result.short);
    }
    return slot.outputs;
}
