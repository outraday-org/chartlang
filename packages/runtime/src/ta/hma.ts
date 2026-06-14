// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/hma.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. The HMA primitive composes three WMA sub-
// slots derived from the parent slot id.

import type { HmaOpts, Series } from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";
import { wma } from "./wma.js";

type HmaSlot = {
    readonly series: Series<number>;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.hma called outside an active script step");
    }
    return ctx;
}

/**
 * Hull moving average — `WMA(2·WMA(src, N/2) − WMA(src, N), sqrt(N))`.
 * Composes three WMA sub-slots derived from the parent slot id
 * (`${slotId}/half`, `${slotId}/full`, `${slotId}/final`). The intermediate
 * `diff = 2·halfWMA − fullWMA` is a scalar passed into the final WMA;
 * no separate primitive owns the diff stream. Warmup is the full chain:
 * `length + ceil(sqrt(length)) − 2`. Tick-mode propagates through every
 * sub-slot's replace-head branch.
 *
 * @formula  halfLen = floor(length / 2) ;
 *           sqrtLen = round(sqrt(length)) ;
 *           half   = WMA(source, halfLen) ;
 *           full   = WMA(source, length) ;
 *           diff   = 2 · half − full ;
 *           out    = WMA(diff, sqrtLen)
 * @warmup   length + ceil(sqrt(length)) − 2
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const h = ta.hma(bar.close, 21);
 *     // plot(h);
 */
export function hma(
    slotId: string,
    source: ScalarOrSeries,
    length: number,
    _opts?: HmaOpts,
): Series<number> {
    const ctx = getCtx();
    const halfLen = Math.max(1, Math.floor(length / 2));
    const sqrtLen = Math.max(1, Math.round(Math.sqrt(length)));
    const src = readSourceValue(source);
    const halfSeries = wma(`${slotId}/half`, src, halfLen);
    const fullSeries = wma(`${slotId}/full`, src, length);
    const ha = halfSeries.current;
    const fa = fullSeries.current;
    const diff = Number.isFinite(ha) && Number.isFinite(fa) ? 2 * ha - fa : Number.NaN;
    const finalSeries = wma(`${slotId}/final`, diff, sqrtLen);

    let slot = ctx.stream.taSlots.get(slotId) as HmaSlot | undefined;
    if (slot === undefined) {
        slot = { series: finalSeries };
        ctx.stream.taSlots.set(slotId, slot);
    }
    return slot.series;
}
