// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/ma-ribbon.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape — NOT invinite's
// IndicatorPlugin shape. maRibbon dispatches per-bar through
// `TA_REGISTRY`'s registered MA primitives (sma / ema / wma / smma)
// via sub-slot ids derived from the parent slot id; no private MA copy.

import type {
    MaRibbonOpts,
    MaRibbonResult,
    MaTypeNoVolume,
    Series,
} from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { ema } from "./ema.js";
import { sma } from "./sma.js";
import { smma } from "./smma.js";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue.js";
import { wma } from "./wma.js";

const DEFAULT_LENGTHS: ReadonlyArray<number> = Object.freeze([10, 20, 30, 40, 50]);
const DEFAULT_MA_TYPE: MaTypeNoVolume = "sma";

type MaRibbonSlot = {
    readonly outputs: MaRibbonResult;
    readonly lengths: ReadonlyArray<number>;
    readonly maType: MaTypeNoVolume;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.maRibbon called outside an active script step");
    }
    return ctx;
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
 * Resolve the ordered `ma_<length>` keys for an `opts` value. Defaults
 * mirror `ta.maRibbon`'s defaults (`lengths = [10, 20, 30, 40, 50]`)
 * so a no-opts call yields `["ma_10", "ma_20", "ma_30", "ma_40",
 * "ma_50"]`. Iteration order matches the resolved `lengths` array;
 * consumers (legend chips, sub-pane axes, the conformance harness) use
 * this helper to enumerate the `MaRibbonResult` record without
 * hard-coding key names.
 *
 * @formula  keys = (opts.lengths ?? DEFAULT_LENGTHS).map(n => `ma_${n}`)
 * @since 0.2
 * @stable
 * @example
 *     // import { maRibbonOutputKeys } from "@invinite-org/chartlang-runtime";
 *     // const keys = maRibbonOutputKeys({ lengths: [10, 20, 30] });
 *     // // keys === ["ma_10", "ma_20", "ma_30"]
 */
export function maRibbonOutputKeys(opts?: MaRibbonOpts): ReadonlyArray<string> {
    const lengths = opts?.lengths ?? DEFAULT_LENGTHS;
    const out: string[] = [];
    for (const length of lengths) out.push(`ma_${length}`);
    return out;
}

/**
 * MA Ribbon — a fan of K moving averages of the same kind at different
 * lengths. Returns a dynamic-key record `{ ma_<length>: Series<number> }`
 * keyed by the resolved `lengths` array. Each output is composed through
 * `TA_REGISTRY`'s registered MA primitive (`sma` / `ema` / `wma` /
 * `smma`) via the sub-slot id `${slotId}/ma_<length>` — no private MA
 * copy, so a fix to any MA primitive flows in for free (matches the
 * `donchian` / `bb` / `macd` composition convention). Defaults:
 * `lengths = [10, 20, 30, 40, 50]`, `maType = "sma"`. Per-output warmup
 * matches the source MA's warmup at that length.
 *
 * The sibling helper {@link maRibbonOutputKeys} returns the ordered
 * `ma_<length>` keys for stable iteration over the result record.
 * `TA_REGISTRY_METADATA.maRibbon` records the default primary key +
 * visible keys + `{ kind: "auto" }` y-domain for legend / pane sizing.
 *
 * @formula  out.ma_<length> = MA(source, length)  for length ∈ lengths
 * @warmup   per-output : matches the source MA's warmup at `length` ;
 *           ribbon as a whole : `max(lengths) − 1`
 * @anchors  lengths, maType
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-core";
 *     // const r = ta.maRibbon(bar.close, { lengths: [10, 20, 30], maType: "ema" });
 *     // plot(r.ma_10);
 *     // plot(r.ma_20);
 *     // plot(r.ma_30);
 */
export function maRibbon(
    slotId: string,
    source: ScalarOrSeries,
    opts?: MaRibbonOpts,
): MaRibbonResult {
    const ctx = getCtx();
    const lengths = opts?.lengths ?? DEFAULT_LENGTHS;
    const maType = opts?.maType ?? DEFAULT_MA_TYPE;
    const src = readSourceValue(source);

    let slot = ctx.stream.taSlots.get(slotId) as MaRibbonSlot | undefined;
    if (slot === undefined) {
        // First call: drive every sub-slot to allocate its `Series<number>`,
        // then freeze the result record (identity-stable per parent slot).
        const outputs: Record<string, Series<number>> = {};
        for (const length of lengths) {
            const subSlotId = `${slotId}/ma_${length}`;
            outputs[`ma_${length}`] = dispatchMa(maType, subSlotId, src, length);
        }
        slot = {
            outputs: Object.freeze(outputs),
            lengths,
            maType,
        };
        ctx.stream.taSlots.set(slotId, slot);
        return slot.outputs;
    }

    // Subsequent calls: drive every sub-slot through its registered MA
    // primitive — the sub-slots own per-bar advancement (close-side
    // append / tick-side replaceHead via `ctx.isTick`).
    for (const length of slot.lengths) {
        const subSlotId = `${slotId}/ma_${length}`;
        dispatchMa(slot.maType, subSlotId, src, length);
    }
    return slot.outputs;
}
