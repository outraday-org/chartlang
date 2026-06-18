// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { TaMapping } from "./types.js";
import { lookup } from "./types.js";

const ta = (
    pine: string,
    chartlang: string | null,
    signatureNote?: string,
): readonly [string, TaMapping] => [
    pine,
    signatureNote === undefined ? { pine, chartlang } : { pine, chartlang, signatureNote },
];

/**
 * Pine `ta.*` member → chartlang `ta.*` member for the subset that maps
 * cleanly in signature shape. Every non-null chartlang name is a real
 * member of `@invinite-org/chartlang-core`'s `TaNamespace` (cross-checked
 * by `taPassthrough.test.ts`). `chartlang: null` marks members with no
 * chartlang analogue — Task 15 emits a `ta-not-mapped` warning.
 *
 * `signatureNote` flags shape divergence (e.g. `ta.swma` approximated by
 * `ta.wma`, `ta.pivothigh` projecting the `.high` field of
 * `ta.pivotsHighLow`).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { TA_PASSTHROUGH_MAP } from "@invinite-org/chartlang-pine-converter";
 *     const m = TA_PASSTHROUGH_MAP.get("ta.rma");
 *     void m?.chartlang; // "ta.smma"
 */
export const TA_PASSTHROUGH_MAP: ReadonlyMap<string, TaMapping> = new Map<string, TaMapping>([
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_ta.sma
    ta("ta.sma", "ta.sma"),
    ta("ta.ema", "ta.ema"),
    ta("ta.rma", "ta.smma", "Pine RMA is chartlang SMMA (Wilder smoothing)"),
    ta("ta.wma", "ta.wma"),
    ta("ta.hma", "ta.hma"),
    ta("ta.swma", "ta.wma", "no chartlang swma; approximated by ta.wma"),
    ta("ta.vwma", "ta.vwma"),
    ta("ta.alma", "ta.alma"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_ta.rsi
    ta("ta.rsi", "ta.rsi"),
    ta(
        "ta.macd",
        "ta.macd",
        "Pine returns [macd, signal, hist] tuple; chartlang MacdResult object",
    ),
    ta("ta.stoch", "ta.stoch"),
    ta("ta.cci", "ta.cci"),
    ta("ta.cmo", "ta.cmo"),
    ta("ta.mfi", "ta.mfi"),
    ta("ta.tsi", "ta.tsi"),
    ta("ta.wpr", "ta.williamsR"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_ta.bb
    ta("ta.bb", "ta.bb"),
    ta("ta.bbw", "ta.bbw"),
    ta("ta.kc", "ta.keltner"),
    ta("ta.atr", "ta.atr"),
    ta("ta.stdev", "ta.stdev"),
    ta("ta.kcw", null, "no chartlang Keltner-width analogue — REJECT"),
    ta("ta.dev", null, "no chartlang median-absolute-deviation analogue — REJECT"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_ta.supertrend
    ta("ta.supertrend", "ta.supertrend"),
    ta("ta.sar", "ta.psar"),
    ta("ta.dmi", "ta.dmi"),
    ta("ta.vwap", "ta.vwap"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_ta.crossover
    ta("ta.crossover", "ta.crossover"),
    ta("ta.crossunder", "ta.crossunder"),
    ta("ta.cross", "ta.crossover", "synthesise as crossover || crossunder"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_ta.highest
    ta("ta.highest", "ta.highest"),
    ta("ta.lowest", "ta.lowest"),
    ta("ta.highestbars", "ta.highestbars"),
    ta("ta.lowestbars", "ta.lowestbars"),
    ta("ta.barssince", "ta.barssince"),
    ta("ta.valuewhen", "ta.valuewhen"),
    ta("ta.change", "ta.change"),
    ta("ta.cum", null, "rolling cumulative sum; no direct chartlang analogue — REJECT"),
    ta("ta.correlation", null, "no chartlang correlation analogue — REJECT"),
    ta("ta.linreg", "ta.lsma"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_ta.pivothigh
    ta(
        "ta.pivothigh",
        "ta.pivotsHighLow.high",
        "ta.pivotsHighLow({leftLength, rightLength}).high — field is high, NOT pivotHigh",
    ),
    ta(
        "ta.pivotlow",
        "ta.pivotsHighLow.low",
        "ta.pivotsHighLow({leftLength, rightLength}).low — field is low, NOT pivotLow",
    ),
]);

/**
 * Resolve a Pine `ta.*` member against {@link TA_PASSTHROUGH_MAP}.
 * Returns `null` for unknown members and for REJECTs (`ta.kcw`,
 * `ta.dev`, `ta.cum`, `ta.correlation`).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { taLookup } from "@invinite-org/chartlang-pine-converter";
 *     const m = taLookup("ta.ema");
 *     void m?.chartlang; // "ta.ema"
 */
export const taLookup = (key: string): TaMapping | null => lookup(TA_PASSTHROUGH_MAP, key);
