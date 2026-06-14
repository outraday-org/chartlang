// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/williams-r.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape. Williams %R derives from
// `bar.high` / `bar.low` / `bar.close` directly — no `source` arg
// per Pine. Composes `ta.highest` + `ta.lowest` over the trailing
// `length` bars.

import type { Series, WilliamsROpts } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";
import { highest } from "./highest.js";
import { lowest } from "./lowest.js";

type WilliamsRSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.williamsR called outside an active script step");
    }
    return ctx;
}

function williamsRValue(hh: number, ll: number, close: number): number {
    if (!Number.isFinite(hh) || !Number.isFinite(ll) || !Number.isFinite(close)) {
        return Number.NaN;
    }
    const denom = hh - ll;
    if (denom === 0) return Number.NaN;
    return (-100 * (hh - close)) / denom;
}

/**
 * Williams %R — momentum oscillator bounded in `[-100, 0]`. Sources
 * from `bar.high` / `bar.low` / `bar.close` directly (no `source`
 * arg — matches Pine). Composes `ta.highest` + `ta.lowest` over the
 * trailing `length` bars; `hh === ll` (flat-line window) emits `NaN`.
 *
 * The registry records `yDomain: { kind: "fixed", min: -100, max: 0 }`
 * via `TA_REGISTRY_METADATA`.
 *
 * @formula  hh = highest(bar.high, length) ;
 *           ll = lowest(bar.low, length) ;
 *           wr = -100 · (hh − bar.close) / (hh − ll) ; NaN if hh === ll
 * @warmup   length − 1
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const w = ta.williamsR("slot", 14);
 *     // plot(w);
 */
export function williamsR(slotId: string, length: number, _opts?: WilliamsROpts): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as WilliamsRSlot | undefined;
    if (slot === undefined) {
        const outBuffer = new Float64RingBuffer(ctx.stream.ohlcv.close.capacity);
        slot = { outBuffer, series: makeSeriesView<number>(outBuffer) };
        ctx.stream.taSlots.set(slotId, slot);
    }
    const bar = ctx.stream.bar;
    const hh = highest(`${slotId}/hh`, bar.high, length).current;
    const ll = lowest(`${slotId}/ll`, bar.low, length).current;
    const value = williamsRValue(hh, ll, bar.close);
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(value);
    } else {
        slot.outBuffer.append(value);
    }
    return slot.series;
}
