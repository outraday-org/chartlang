// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { MathMapping } from "./types.js";
import { lookup } from "./types.js";

const math = (
    pine: string,
    chartlang: string | null,
    notes?: string,
): readonly [string, MathMapping] => [
    pine,
    notes === undefined ? { pine, chartlang } : { pine, chartlang, notes },
];

/**
 * Pine `math.*` member → JS `Math.*` member (or inline-helper note). The
 * 1:1 numeric functions pass straight through to `Math.*`; aggregates and
 * constants carry a note for the codegen to emit. `chartlang: null` marks
 * REJECTs — `math.random` (chartlang determinism rule) and
 * `math.round_to_mintick` (needs `syminfo.mintick`).
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { MATH_PASSTHROUGH_MAP } from "@invinite-org/chartlang-pine-converter";
 *     const m = MATH_PASSTHROUGH_MAP.get("math.abs");
 *     void m?.chartlang; // "Math.abs"
 */
export const MATH_PASSTHROUGH_MAP: ReadonlyMap<string, MathMapping> = new Map<string, MathMapping>([
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_math.abs
    math("math.abs", "Math.abs"),
    math("math.round", "Math.round"),
    math("math.floor", "Math.floor"),
    math("math.ceil", "Math.ceil"),
    math("math.sqrt", "Math.sqrt"),
    math("math.pow", "Math.pow"),
    math("math.exp", "Math.exp"),
    math("math.log", "Math.log"),
    math("math.log10", "Math.log10"),
    math("math.sin", "Math.sin"),
    math("math.cos", "Math.cos"),
    math("math.tan", "Math.tan"),
    math("math.asin", "Math.asin"),
    math("math.acos", "Math.acos"),
    math("math.atan", "Math.atan"),
    math("math.min", "Math.min"),
    math("math.max", "Math.max"),
    math("math.sign", "Math.sign"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_math.avg
    math("math.avg", "Math.avg", "inline helper emitted by codegen: sum(args)/args.length"),
    math("math.sum", "Math.sum", "inline helper emitted by codegen: reduce(+)"),
    math("math.todegrees", "Math.todegrees", "inline arithmetic: rad * 180 / Math.PI"),
    math("math.toradians", "Math.toradians", "inline arithmetic: deg * Math.PI / 180"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_math.pi
    math("math.pi", "Math.PI", "constant inlined"),
    math("math.e", "Math.E", "constant inlined"),
    math("math.phi", "Math.phi", "constant inlined: (1 + Math.sqrt(5)) / 2"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_math.round_to_mintick
    math("math.round_to_mintick", null, "requires syminfo.mintick; Task 15 fallback — REJECT"),
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_math.random
    math("math.random", null, "chartlang determinism rule — REJECT"),
]);

/**
 * Resolve a Pine `math.*` member against {@link MATH_PASSTHROUGH_MAP}.
 * Returns `null` for unknown members and for REJECTs (`math.random`,
 * `math.round_to_mintick`).
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { mathLookup } from "@invinite-org/chartlang-pine-converter";
 *     const m = mathLookup("math.max");
 *     void m?.chartlang; // "Math.max"
 */
export const mathLookup = (key: string): MathMapping | null => lookup(MATH_PASSTHROUGH_MAP, key);
