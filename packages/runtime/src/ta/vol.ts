// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/vol.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.

import type { Series, VolOpts } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { makeSeriesView } from "../seriesView.js";

type VolSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.vol called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): VolSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return { outBuffer, series: makeSeriesView<number>(outBuffer) };
}

/**
 * Volume passthrough — emits `bar.volume` as a `Series<number>` so
 * script authors can compose it like any other primitive (e.g. plot
 * as a histogram). Stateless math; the slot exists purely to back
 * the cached `Series<T>` Proxy + the per-callsite output buffer the
 * compiler-injected slot id keys.
 *
 * Tick-mode reads the live `bar.volume`, replacing the head — volume
 * can change mid-bar in real time.
 *
 * @formula  out[t] = bar.volume[t]
 * @warmup   0
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta, plot } from "@invinite-org/chartlang-runtime";
 *     // const v = ta.vol("slot");
 *     // plot(v, { style: { kind: "histogram", baseline: 0 } });
 */
export function vol(slotId: string, _opts?: VolOpts): Series<number> {
    const ctx = getCtx();
    let slot = ctx.stream.taSlots.get(slotId) as VolSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const value = ctx.stream.bar.volume;
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(value);
    } else {
        slot.outBuffer.append(value);
    }
    return slot.series;
}
