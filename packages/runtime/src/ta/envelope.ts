// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/envelope.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. Envelope composes the registered MA primitive
// (sma / ema / wma / smma) via sub-slot `${slotId}/<maType>` over the
// script-provided source — so a fix to any MA flows in for free.

import type {
    EnvelopeOpts,
    EnvelopeResult,
    MaTypeNoVolume,
    Series,
} from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";
import { ema } from "./ema";
import { sma } from "./sma";
import { smma } from "./smma";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue";
import { wma } from "./wma";

const DEFAULT_LENGTH = 20;
const DEFAULT_PERCENT = 10;
const DEFAULT_MA_TYPE: MaTypeNoVolume = "sma";

type EnvelopeSlot = {
    readonly upperBuffer: Float64RingBuffer;
    readonly lowerBuffer: Float64RingBuffer;
    readonly length: number;
    readonly percent: number;
    readonly maType: MaTypeNoVolume;
    outputs: EnvelopeResult | null;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.envelope called outside an active script step");
    }
    return ctx;
}

function initSlot(
    length: number,
    percent: number,
    maType: MaTypeNoVolume,
    capacity: number,
): EnvelopeSlot {
    return {
        upperBuffer: new Float64RingBuffer(capacity),
        lowerBuffer: new Float64RingBuffer(capacity),
        length,
        percent,
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
 * Envelope — overlay percent-band envelope around an MA of the
 * script-provided source. Defaults `length = 20`, `percent = 10`,
 * `maType = "sma"` (matches Pine `ta.envelope` defaults). The upper /
 * lower bands are a pure multiplicative offset of the middle MA.
 * Composes the registered MA primitive via sub-slot
 * `${slotId}/<maType>` — fixes to any MA flow in for free. Returns a
 * cached `{ upper, middle, lower }` record (same identity every bar).
 * NaN across all outputs while the MA is unwarmed.
 *
 * @formula  middle = MA(source, length, maType) ;
 *           upper  = middle · (1 + percent / 100) ;
 *           lower  = middle · (1 − percent / 100)
 * @warmup   length − 1
 * @anchors  maType
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const e = ta.envelope(bar.close);
 *     // plot(e.upper);
 *     // plot(e.middle);
 *     // plot(e.lower);
 */
export function envelope(
    slotId: string,
    source: ScalarOrSeries,
    opts?: EnvelopeOpts,
): EnvelopeResult {
    const ctx = getCtx();
    const length = opts?.length ?? DEFAULT_LENGTH;
    const percent = opts?.percent ?? DEFAULT_PERCENT;
    const maType = opts?.maType ?? DEFAULT_MA_TYPE;
    let slot = ctx.stream.taSlots.get(slotId) as EnvelopeSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(length, percent, maType, ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const src = readSourceValue(source);
    const middleSeries = dispatchMa(slot.maType, `${slotId}/${slot.maType}`, src, slot.length);
    if (slot.outputs === null) {
        slot.outputs = Object.freeze({
            upper: makeSeriesView<number>(slot.upperBuffer),
            middle: middleSeries,
            lower: makeSeriesView<number>(slot.lowerBuffer),
        });
    }
    const mid = middleSeries.current;
    const factor = slot.percent / 100;
    let upperValue: number;
    let lowerValue: number;
    if (Number.isFinite(mid)) {
        upperValue = mid * (1 + factor);
        lowerValue = mid * (1 - factor);
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
