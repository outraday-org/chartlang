// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/aroon-osc.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. AroonOsc composes `ta.aroon` via a sub-slot
// id `${slotId}/aroon`, so a fix to Aroon flows in for free.

import type { AroonOscOpts, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { makeSeriesView } from "../seriesView";
import { aroon } from "./aroon";

type AroonOscSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.aroonOsc called outside an active script step");
    }
    return ctx;
}

function initSlot(capacity: number): AroonOscSlot {
    const outBuffer = new Float64RingBuffer(capacity);
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
    };
}

/**
 * Aroon Oscillator — `aroon.up − aroon.down`. Bounded in `[-100, 100]`
 * when defined; NaN through the `length` warmup window. Composes
 * `ta.aroon` at sub-slot `${slotId}/aroon`, so the math is fed by
 * the same per-bar window scan and a fix to Aroon flows in for free.
 *
 * @formula  osc = aroon.up − aroon.down
 * @warmup   length
 * @since 0.2
 * @experimental
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const osc = ta.aroonOsc(14);
 *     // plot(osc);
 */
export function aroonOsc(slotId: string, length: number, _opts?: AroonOscOpts): Series<number> {
    const ctx = getCtx();
    // Compose: aroon(subSlotId, length) — no opts pass-through; aroon's
    // opts surface differs (it carries `outputs`) and the AroonOsc
    // surface concerns (`lineStyle`) don't pipe into the math.
    const r = aroon(`${slotId}/aroon`, length);

    let slot = ctx.stream.taSlots.get(slotId) as AroonOscSlot | undefined;
    if (slot === undefined) {
        slot = initSlot(ctx.stream.ohlcv.close.capacity);
        ctx.stream.taSlots.set(slotId, slot);
    }
    const up = r.up.current;
    const down = r.down.current;
    const value = Number.isFinite(up) && Number.isFinite(down) ? up - down : Number.NaN;
    if (ctx.isTick) {
        slot.outBuffer.replaceHead(value);
    } else {
        slot.outBuffer.append(value);
    }
    return slot.series;
}
