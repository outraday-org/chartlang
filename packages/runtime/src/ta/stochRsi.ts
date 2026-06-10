// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/stoch-rsi.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape. Composition: `ta.rsi` +
// `ta.highest` + `ta.lowest` + two chained `ta.sma` layers, all via
// sub-slot ids derived from the parent slot id.
//
// DIVERGENCE: invinite's flat-window (`hh === ll` of the RSI series)
// fallback returns the prior valid kRaw (or 50 on the first slot).
// The task spec (§6) overrides this with NaN — we follow the spec.

import type { Series, StochRsiOpts, StochRsiResult } from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext";
import { highest } from "./highest";
import { lowest } from "./lowest";
import { rsi } from "./rsi";
import { sma } from "./sma";
import { type ScalarOrSeries, readSourceValue } from "./lib/sourceValue";

const DEFAULT_RSI_LENGTH = 14;
const DEFAULT_STOCH_LENGTH = 14;
const DEFAULT_K_SMOOTHING = 3;
const DEFAULT_D_SMOOTHING = 3;

type StochRsiSlot = {
    readonly result: StochRsiResult;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.stochRsi called outside an active script step");
    }
    return ctx;
}

/**
 * Stochastic of the Wilder RSI series (%K + %D). Composes
 * `ta.rsi(source, rsiLength)`, then applies the Stochastic transform
 * (`ta.highest` + `ta.lowest` over `stochLength`), then smooths via
 * `ta.sma(kSmoothing)` for `k` and `ta.sma(dSmoothing)` on `k` for
 * `d`. Output bounded `[0, 100]` (or `NaN`).
 *
 * Defaults `{ rsiLength: 14, stochLength: 14, kSmoothing: 3,
 * dSmoothing: 3 }`. The flat-window (`hh === ll` of the RSI series)
 * edge emits `NaN` at `k` (and propagates to `d`) — diverges from
 * invinite's prev-or-50 fallback per task spec.
 *
 * The registry records `primarySeriesKey: "k"`, `visibleSeriesKeys:
 * ["k", "d"]`, and `yDomain: { kind: "fixed", min: 0, max: 100 }`
 * via `TA_REGISTRY_METADATA`.
 *
 * @formula  rsi  = rsi(source, rsiLength) ;
 *           hh   = highest(rsi, stochLength) ;
 *           ll   = lowest(rsi, stochLength) ;
 *           kRaw = 100 · (rsi − ll) / (hh − ll) ; NaN if hh === ll ;
 *           k    = sma(kRaw, kSmoothing) ;
 *           d    = sma(k, dSmoothing)
 * @warmup   rsiLength + stochLength + kSmoothing + dSmoothing − 4
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const s = ta.stochRsi("slot", bar.close);
 *     // plot(s.k); plot(s.d);
 */
export function stochRsi(
    slotId: string,
    source: ScalarOrSeries,
    opts?: StochRsiOpts,
): StochRsiResult {
    const ctx = getCtx();
    const rsiLength = opts?.rsiLength ?? DEFAULT_RSI_LENGTH;
    const stochLength = opts?.stochLength ?? DEFAULT_STOCH_LENGTH;
    const kSmoothing = opts?.kSmoothing ?? DEFAULT_K_SMOOTHING;
    const dSmoothing = opts?.dSmoothing ?? DEFAULT_D_SMOOTHING;

    const src = readSourceValue(source);
    const rsiSeries = rsi(`${slotId}/rsi`, src, rsiLength);
    const rsiCurrent = rsiSeries.current;
    const hhSeries = highest(`${slotId}/hh`, rsiCurrent, stochLength);
    const llSeries = lowest(`${slotId}/ll`, rsiCurrent, stochLength);
    const hh = hhSeries.current;
    const ll = llSeries.current;
    let kRaw: number;
    if (!Number.isFinite(hh) || !Number.isFinite(ll) || !Number.isFinite(rsiCurrent)) {
        kRaw = Number.NaN;
    } else if (hh === ll) {
        kRaw = Number.NaN;
    } else {
        kRaw = (100 * (rsiCurrent - ll)) / (hh - ll);
    }

    const kSeries = sma(`${slotId}/kSmooth`, kRaw, kSmoothing);
    const dSeries = sma(`${slotId}/d`, kSeries.current, dSmoothing);

    let slot = ctx.stream.taSlots.get(slotId) as StochRsiSlot | undefined;
    if (slot === undefined) {
        slot = {
            result: Object.freeze({ k: kSeries, d: dSeries } as {
                k: Series<number>;
                d: Series<number>;
            }),
        };
        ctx.stream.taSlots.set(slotId, slot);
    }
    return slot.result;
}
