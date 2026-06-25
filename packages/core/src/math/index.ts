// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { avg, clamp, fixnan, na, nz, roundTo, roundToMintick, sign, sum } from "./mathHelpers.js";

export { avg, clamp, fixnan, na, nz, roundTo, roundToMintick, sign, sum } from "./mathHelpers.js";

/**
 * Pure, chart-aware scalar math. Bare `Math.*` (except `Math.random`) is
 * already available in `compute`; this namespace adds only the helpers `Math`
 * lacks — tick-size rounding, scalar `na`/`nz`/`fixnan` (the plain-number
 * twins of the series-aware `ta.nz`), `sign`/`clamp`, and the variadic
 * skip-NaN reducers `avg`/`sum`. Same shape as `color`/`str`: frozen,
 * deterministic, compute-time.
 *
 * @since 1.4
 * @stable
 * @example
 *     const price = math.roundToMintick(rawPrice, syminfo.mintick);
 *     void price;
 */
export const math = Object.freeze({
    roundToMintick,
    roundTo,
    na,
    nz,
    fixnan,
    sign,
    clamp,
    avg,
    sum,
});

/**
 * Type of the frozen {@link math} namespace.
 *
 * @since 1.4
 * @stable
 * @example
 *     const ns: MathNamespace = math;
 *     void ns;
 */
export type MathNamespace = typeof math;
