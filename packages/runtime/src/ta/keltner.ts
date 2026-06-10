// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/keltner.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Keltner composes the registered MA primitive
// (sma / ema / wma / smma) via sub-slot `${slotId}/<maType>` over
// `bar.close` for the middle band, and `ta.atr` via sub-slot
// `${slotId}/atr` for the band offset — so fixes to either flow in
// for free (mirrors maRibbon / donchian composition convention).

import type {
    KeltnerOpts,
    KeltnerResult,
    MaTypeNoVolume,
    Series,
} from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { atr } from "./atr.js";
import { ema } from "./ema.js";
import { sma } from "./sma.js";
import { smma } from "./smma.js";
import { wma } from "./wma.js";

const DEFAULT_LENGTH = 20;
const DEFAULT_MULTIPLIER = 2;
const DEFAULT_MA_TYPE: MaTypeNoVolume = "ema";

type KeltnerSlot = {
    readonly upperBuffer: Float64RingBuffer;
    readonly lowerBuffer: Float64RingBuffer;
    readonly length: number;
    readonly multiplier: number;
    readonly maType: MaTypeNoVolume;
    outputs: KeltnerResult | null;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.keltner called outside an active script step");
    }
    return ctx;
}

function initSlot(
    length: number,
    multiplier: number,
    maType: MaTypeNoVolume,
    capacity: number,
): KeltnerSlot {
    return {
        upperBuffer: new Float64RingBuffer(capacity),
        lowerBuffer: new Float64RingBuffer(capacity),
        length,
        multiplier,
        maType,
        outputs: null,
    };
}

function dispatchMa(
    maType: MaTypeNoVolume,
    subSlotId: string,
    source: number,
    length: number,
): Series<number> {
    switch (maType) {
        case "sma":
            return sma(subSlotId, source, length);
        case "ema":
            return ema(subSlotId, source, length);
        case "wma":
            return wma(subSlotId, source, length);
        case "smma":
            return smma(subSlotId, source, length);
    }
}

/**
 * Keltner Channels — overlay volatility envelope. Middle band is an
 * `maType` MA of `bar.close` over `length`; upper / lower bands sit
 * `multiplier · ATR(length)` above / below the middle. Defaults
 * `length = 20`, `multiplier = 2`, `maType = "ema"` (Linda Raschke /
 * TradingView canonical form — Chester Keltner's original used a
 * different "typical range" formulation; every modern reference
 * defaults to EMA + Wilder ATR). Composes the registered MA primitive
 * via sub-slot `${slotId}/<maType>` and `ta.atr` via sub-slot
 * `${slotId}/atr` — fixes to either flow in for free. Returns a
 * cached `{ upper, middle, lower }` record (same identity every bar).
 * NaN across all outputs while the trailing window is unwarmed.
 *
 * @formula  middle = MA(close, length, maType) ;
 *           upper  = middle + multiplier · atr(length) ;
 *           lower  = middle − multiplier · atr(length)
 * @warmup   length
 * @anchors  maType
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const k = ta.keltner({ length: 20, multiplier: 2 });
 *     // plot(k.upper);
 *     // plot(k.middle);
 *     // plot(k.lower);
 */
export function keltner(slotId: string, opts?: KeltnerOpts): KeltnerResult {
    const ctx = getCtx();
    const length = opts?.length ?? DEFAULT_LENGTH;
    const multiplier = opts?.multiplier ?? DEFAULT_MULTIPLIER;
    const maType = opts?.maType ?? DEFAULT_MA_TYPE;
    let slot = ctx.stream.taSlots.get(slotId) as KeltnerSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, multiplier, maType, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const close = ctx.stream.bar.close;
    const middleSeries = dispatchMa(slot.maType, `${slotId}/${slot.maType}`, close, slot.length);
    const atrSeries = atr(`${slotId}/atr`, slot.length);
    if (slot.outputs === null) {
        slot.outputs = Object.freeze({
            upper: makeSeriesView<number>(slot.upperBuffer),
            middle: middleSeries,
            lower: makeSeriesView<number>(slot.lowerBuffer),
        });
    }
    const mid = middleSeries.current;
    const atrValue = atrSeries.current;
    let upperValue: number;
    let lowerValue: number;
    if (Number.isFinite(mid) && Number.isFinite(atrValue)) {
        upperValue = mid + slot.multiplier * atrValue;
        lowerValue = mid - slot.multiplier * atrValue;
    } else {
        upperValue = Number.NaN;
        lowerValue = Number.NaN;
    }
    if (ctx.isTick) {
        slot.upperBuffer.replaceHead(upperValue);
        slot.lowerBuffer.replaceHead(lowerValue);
    } else {
        slot.upperBuffer.append(upperValue);
        slot.lowerBuffer.append(lowerValue);
    }
    return slot.outputs;
}
