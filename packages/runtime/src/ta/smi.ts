// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/smi.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.

import type { SmiOpts, SmiResult } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView, makeShiftedSeriesView } from "../seriesView.js";
import { ema } from "./ema.js";
import { highest } from "./highest.js";
import { lowest } from "./lowest.js";

const DEFAULT_K_LENGTH = 10;
const DEFAULT_FIRST = 3;
const DEFAULT_SECOND = 5;
const DEFAULT_D_LENGTH = 3;

type SmiSlot = {
    readonly result: SmiResult;
    readonly smiBuf: Float64RingBuffer;
    readonly signalBuf: Float64RingBuffer;
    readonly shiftedResults: Map<number, SmiResult>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.smi called outside an active script step");
    }
    return ctx;
}

function resultForOffset(slot: SmiSlot, offset: number): SmiResult {
    if (offset === 0) return slot.result;
    let cached = slot.shiftedResults.get(offset);
    if (cached === undefined) {
        cached = Object.freeze({
            smi: makeShiftedSeriesView<number>(slot.smiBuf, offset),
            signal: makeShiftedSeriesView<number>(slot.signalBuf, offset),
        });
        slot.shiftedResults.set(offset, cached);
    }
    return cached;
}

function smiValue(numSmoothed: number, denSmoothed: number): number {
    if (!Number.isFinite(numSmoothed) || !Number.isFinite(denSmoothed) || denSmoothed === 0) {
        return Number.NaN;
    }
    return (100 * numSmoothed) / denSmoothed;
}

/**
 * Stochastic Momentum Index (William Blau). Composes `ta.highest` /
 * `ta.lowest` over `bar.high` / `bar.low` (`kLength` window) for the
 * rolling midpoint and range, then double-EMA-smooths both numerator
 * (`bar.close − midpoint`) and denominator (`range / 2`) through two
 * EMA layers (`firstSmoothing`, then `secondSmoothing`). The signal
 * line is a standard EMA(`dLength`) over the SMI output.
 *
 * Bounded `[-100, 100]` by construction (when defined). Flat-range
 * windows where the double-smoothed denominator collapses to zero
 * emit NaN at `smi` (and propagate to `signal`).
 *
 * Defaults: `(kLength, firstSmoothing, secondSmoothing, dLength) =
 * (10, 3, 5, 3)` — TradingView-canonical.
 *
 * The registry records `primarySeriesKey: "smi"`, `visibleSeriesKeys:
 * ["smi", "signal"]`, and `yDomain: { kind: "fixed", min: -100, max:
 * 100 }` via `TA_REGISTRY_METADATA`.
 *
 * @formula  hh   = highest(bar.high, kLength) ;
 *           ll   = lowest(bar.low, kLength) ;
 *           cm   = (hh + ll) / 2 ;
 *           range = (hh - ll) / 2 ;
 *           num  = bar.close - cm ;
 *           den  = range ;
 *           numSmoothed = EMA(secondSmoothing)(EMA(firstSmoothing)(num)) ;
 *           denSmoothed = EMA(secondSmoothing)(EMA(firstSmoothing)(den)) ;
 *           smi    = 100 · numSmoothed / denSmoothed ;
 *           signal = EMA(dLength)(smi)
 * @warmup   kLength + firstSmoothing + secondSmoothing + dLength − 4
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const s = ta.smi("slot");
 *     // plot(s.smi); plot(s.signal);
 */
export function smi(slotId: string, opts?: SmiOpts): SmiResult {
    const ctx = getCtx();
    const kLength = opts?.kLength ?? DEFAULT_K_LENGTH;
    const firstSmoothing = opts?.firstSmoothing ?? DEFAULT_FIRST;
    const secondSmoothing = opts?.secondSmoothing ?? DEFAULT_SECOND;
    const dLength = opts?.dLength ?? DEFAULT_D_LENGTH;
    const offset = opts?.offset ?? 0;
    const isTick = ctx.isTick;
    const bar = ctx.stream.bar;

    const hh = highest(`${slotId}/hh`, bar.high, kLength).current;
    const ll = lowest(`${slotId}/ll`, bar.low, kLength).current;
    let num: number;
    let den: number;
    if (!Number.isFinite(hh) || !Number.isFinite(ll)) {
        num = Number.NaN;
        den = Number.NaN;
    } else {
        const cm = (hh + ll) / 2;
        num = bar.close - cm;
        den = (hh - ll) / 2;
    }

    const numFirst = ema(`${slotId}/nFirst`, num, firstSmoothing).current;
    const numSmoothed = ema(`${slotId}/nSecond`, numFirst, secondSmoothing).current;
    const denFirst = ema(`${slotId}/dFirst`, den, firstSmoothing).current;
    const denSmoothed = ema(`${slotId}/dSecond`, denFirst, secondSmoothing).current;
    const smiOut = smiValue(numSmoothed, denSmoothed);

    const signalSlotId = `${slotId}/signal`;
    const signalSeries = ema(signalSlotId, smiOut, dLength);

    let slot = ctx.stream.taSlots.get(slotId) as SmiSlot | undefined;
    if (slot === undefined) {
        const smiBuf = new Float64RingBuffer(ctx.stream.ohlcv.close.capacity);
        const emaSlot = ctx.stream.taSlots.get(signalSlotId) as {
            outBuffer: Float64RingBuffer;
        };
        slot = {
            result: Object.freeze({
                smi: makeSeriesView<number>(smiBuf),
                signal: signalSeries,
            }) as SmiResult,
            smiBuf,
            signalBuf: emaSlot.outBuffer,
            shiftedResults: new Map(),
        };
        ctx.stream.taSlots.set(slotId, slot);
    }

    if (isTick) {
        slot.smiBuf.replaceHead(smiOut);
    } else {
        slot.smiBuf.append(smiOut);
    }

    return resultForOffset(slot, offset);
}
