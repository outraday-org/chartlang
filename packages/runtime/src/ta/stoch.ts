// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/stoch.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.
// Structural choices (callsite-id slot, Series<T> proxy, replaceHead
// mode) follow chartlang's primitive shape. Composition: `ta.highest`
// + `ta.lowest` + two chained `ta.sma` layers (k-smoothing, then d).
//
// DIVERGENCE: invinite's flat-window (`hh === ll`) fallback returns
// the prior valid kRaw (or 50 on the first slot). The task spec
// (§7) overrides this with NaN — we follow the spec, not invinite.
// The plot-hash assertion for the conformance scenario reflects this
// divergence.

import type { StochOpts, StochResult } from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { highest } from "./highest.js";
import { lowest } from "./lowest.js";
import { sma } from "./sma.js";

const DEFAULT_K_LENGTH = 14;
const DEFAULT_K_SMOOTHING = 3;
const DEFAULT_D_LENGTH = 3;

type StochSlot = {
    readonly result: StochResult;
};

function getCtx(): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error("ta.stoch called outside an active script step");
    }
    return ctx;
}

/**
 * Stochastic Oscillator (%K + %D). Sources from `bar.high` / `bar.low`
 * / `bar.close` directly (no `source` arg — matches Pine). Composes
 * `ta.highest` + `ta.lowest` over `kLength`, two chained `ta.sma`
 * layers (`kSmoothing`, then `dLength`). Output bounded `[0, 100]`
 * (or `NaN`).
 *
 * Defaults `{ kLength: 14, kSmoothing: 3, dLength: 3 }`. The flat-
 * window (`hh === ll`) edge emits `NaN` at `k` (and propagates to
 * `d`) — diverges from invinite's prev-or-50 fallback per task spec.
 *
 * The registry records `primarySeriesKey: "k"`, `visibleSeriesKeys:
 * ["k", "d"]`, and `yDomain: { kind: "fixed", min: 0, max: 100 }`
 * via `TA_REGISTRY_METADATA`.
 *
 * @formula  hh    = highest(bar.high, kLength) ;
 *           ll    = lowest(bar.low, kLength) ;
 *           kRaw  = 100 · (bar.close − ll) / (hh − ll) ; NaN if hh === ll ;
 *           k     = sma(kRaw, kSmoothing) ;
 *           d     = sma(k, dLength)
 * @warmup   kLength + kSmoothing + dLength − 3
 * @since 0.2
 * @stable
 *
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const s = ta.stoch("slot", { kLength: 14, kSmoothing: 3, dLength: 3 });
 *     // plot(s.k); plot(s.d);
 */
export function stoch(slotId: string, opts?: StochOpts): StochResult {
    const ctx = getCtx();
    const kLength = opts?.kLength ?? DEFAULT_K_LENGTH;
    const kSmoothing = opts?.kSmoothing ?? DEFAULT_K_SMOOTHING;
    const dLength = opts?.dLength ?? DEFAULT_D_LENGTH;
    const bar = ctx.stream.bar;

    const hhSeries = highest(`${slotId}/hh`, bar.high, kLength);
    const llSeries = lowest(`${slotId}/ll`, bar.low, kLength);
    const hh = hhSeries.current;
    const ll = llSeries.current;
    let kRaw: number;
    if (!Number.isFinite(hh) || !Number.isFinite(ll)) {
        kRaw = Number.NaN;
    } else if (hh === ll) {
        kRaw = Number.NaN;
    } else {
        kRaw = (100 * (bar.close - ll)) / (hh - ll);
    }

    const kSeries = sma(`${slotId}/kSmooth`, kRaw, kSmoothing);
    const dSeries = sma(`${slotId}/d`, kSeries.current, dLength);

    let slot = ctx.stream.taSlots.get(slotId) as StochSlot | undefined;
    if (slot === undefined) {
        slot = {
            result: Object.freeze({ k: kSeries, d: dSeries }),
        };
        ctx.stream.taSlots.set(slotId, slot);
    }
    return slot.result;
}
