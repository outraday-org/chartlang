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
 * Pine `math.*` member → chartlang target. Most numeric functions pass
 * straight through to bare `Math.*` (chartlang allows `Math.*` directly, so
 * re-wrapping them as `math.*` would only double the surface — the no-rewrap
 * decision). The chart-aware extras `Math` cannot express route to the
 * chartlang `math` namespace instead:
 * - `math.round_to_mintick(x)` → `math.roundToMintick(x, syminfo.mintick)`
 *   (the emitter injects the `syminfo.mintick` step — see
 *   `transform/other.ts`'s `emitMath`).
 * - `math.avg(...)` / `math.sum(...)` → the variadic SCALAR `math.avg` /
 *   `math.sum`. Pine's 2-arg ROLLING `math.sum(source, length)` /
 *   `math.avg(source, length)` is a window reduction with NO chartlang scalar
 *   analogue — the emitter detects that arity and emits a diagnostic + a
 *   `/* TODO *\/` placeholder rather than collapsing it onto the scalar form.
 *
 * `chartlang: null` marks REJECTs — `math.random` (chartlang determinism
 * rule). `math.todegrees`/`toradians`/`phi` still resolve to the (non-existent)
 * `Math.todegrees`/`Math.toradians`/`Math.phi`; those are a pre-existing latent
 * gap left as-is — out of scope here (the namespace only owns the chart-aware
 * extras above).
 *
 * @since 0.1
 * @stable
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
    // `math.sign(x)` stays on bare `Math.sign` — the no-rewrap decision keeps
    // anything `Math` already expresses on `Math`, even though `math.sign`
    // exists in the chartlang namespace.
    math("math.sign", "Math.sign"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_math.avg
    // The variadic SCALAR form lands on the chartlang `math` namespace; the
    // emitter routes the 2-arg rolling form to a diagnostic (see `emitMath`).
    math("math.avg", "math.avg"),
    math("math.sum", "math.sum"),
    math("math.todegrees", "Math.todegrees", "inline arithmetic: rad * 180 / Math.PI"),
    math("math.toradians", "Math.toradians", "inline arithmetic: deg * Math.PI / 180"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_math.pi
    math("math.pi", "Math.PI", "constant inlined"),
    math("math.e", "Math.E", "constant inlined"),
    math("math.phi", "Math.phi", "constant inlined: (1 + Math.sqrt(5)) / 2"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_math.round_to_mintick
    // The emitter injects `syminfo.mintick` as the explicit step argument.
    math("math.round_to_mintick", "math.roundToMintick", "step injected: syminfo.mintick"),
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_math.random
    math("math.random", null, "chartlang determinism rule — REJECT"),
]);

/**
 * Resolve a Pine `math.*` member against {@link MATH_PASSTHROUGH_MAP}.
 * Returns `null` for unknown members and for REJECTs (`math.random`).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { mathLookup } from "@invinite-org/chartlang-pine-converter";
 *     const m = mathLookup("math.max");
 *     void m?.chartlang; // "Math.max"
 */
export const mathLookup = (key: string): MathMapping | null => lookup(MATH_PASSTHROUGH_MAP, key);
