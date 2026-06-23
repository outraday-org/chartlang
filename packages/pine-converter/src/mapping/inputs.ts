// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { InputMapping } from "./types.js";
import { lookup } from "./types.js";

/**
 * Pine `input.*` primitive → chartlang `input.*` builder. chartlang
 * TARGET verified against `@invinite-org/chartlang-core`'s `input`
 * namespace (`int/float/bool/string/enum/color/source/time/price/symbol/
 * interval`).
 *
 * Notable mappings:
 *
 * - `input.timeframe` → `input.interval` (chartlang has no `timeframe`;
 *   Task 9 reformats the `defval` string).
 * - `input.text_area` → `input.string` with `multiline: true`.
 * - `input.enum` → REJECT for v1 (Pine `input.enum` is UDT-backed and
 *   needs full type-system support).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { INPUT_MAP } from "@invinite-org/chartlang-pine-converter";
 *     const m = INPUT_MAP.get("input.timeframe");
 *     void m?.chartlang; // "input.interval"
 */
export const INPUT_MAP: ReadonlyMap<string, InputMapping> = new Map<string, InputMapping>([
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_input.int
    ["input.int", { pine: "input.int", chartlang: "input.int" }],
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_input.float
    ["input.float", { pine: "input.float", chartlang: "input.float" }],
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_input.bool
    ["input.bool", { pine: "input.bool", chartlang: "input.bool" }],
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_input.string
    ["input.string", { pine: "input.string", chartlang: "input.string" }],
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_input.color
    ["input.color", { pine: "input.color", chartlang: "input.color" }],
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_input.source
    [
        "input.source",
        {
            pine: "input.source",
            chartlang: "input.source",
            notes: 'Pine defval=close → chartlang "close" string (SourceField)',
        },
    ],
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_input.symbol
    ["input.symbol", { pine: "input.symbol", chartlang: "input.symbol" }],
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_input.timeframe
    [
        "input.timeframe",
        {
            pine: "input.timeframe",
            chartlang: "input.interval",
            notes: 'Pine defval="60" → chartlang "60m" via Task 9 string-format helper',
        },
    ],
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_input.time
    ["input.time", { pine: "input.time", chartlang: "input.time" }],
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_input.price
    ["input.price", { pine: "input.price", chartlang: "input.price" }],
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_input.session
    ["input.session", { pine: "input.session", chartlang: "input.session" }],
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_input.text_area
    [
        "input.text_area",
        {
            pine: "input.text_area",
            chartlang: "input.string",
            notes: "map with multiline: true",
        },
    ],
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_input.enum
    [
        "input.enum",
        {
            pine: "input.enum",
            chartlang: null,
            notes: "Pine UDT-backed; needs full type-system support — REJECT for v1",
        },
    ],
]);

/**
 * Resolve a Pine `input.*` primitive against {@link INPUT_MAP}. Returns
 * `null` for unknown primitives and for REJECTs (`input.enum`).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { inputLookup } from "@invinite-org/chartlang-pine-converter";
 *     const m = inputLookup("input.int");
 *     void m?.chartlang; // "input.int"
 */
export const inputLookup = (key: string): InputMapping | null => lookup(INPUT_MAP, key);
