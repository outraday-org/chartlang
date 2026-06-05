// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/compute-ma.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.

import { computeMaOfFloat64 } from "./computeMaOfFloat64";
import type { MaType } from "./maTypes";
import { vwmaFloat64 } from "./vwmaFloat64";

/**
 * Error thrown by {@link computeMa} when `kind === "vwma"` is called
 * with `volume === null`. Carries a stable `code` for programmatic
 * dispatch: `"ta-lib-vwma-requires-volume"`.
 */
type VwmaRequiresVolumeError = TypeError & { code: "ta-lib-vwma-requires-volume" };

/**
 * Volume-aware MA dispatcher over a `Float64Array` input. Routes
 * `"vwma"` through {@link vwmaFloat64} (requires a parallel volume
 * array); every other kind routes through {@link computeMaOfFloat64}.
 * Mirrors invinite's `computeMaSeries`, but operates on flat
 * `Float64Array` source + volume instead of `ChartCandle[]` so the
 * helper stays decoupled from the bar-shape.
 *
 * Throws a `TypeError` with `code = "ta-lib-vwma-requires-volume"` if
 * `kind === "vwma"` and `volume === null` — calling VWMA without a
 * volume stream is a programmer error, not a runtime data condition.
 * For non-VWMA kinds, `volume` is ignored.
 *
 * @formula  kind === "vwma" → vwmaFloat64(source, volume, length) ;
 *           otherwise         → computeMaOfFloat64(kind, source, length)
 * @since 0.2
 * @stable
 * @example
 *     // import { computeMa } from "./computeMa";
 *     // const ma = computeMa("vwma", close, volume, 20);
 *     // const sma20 = computeMa("sma", close, null, 20);
 */
export function computeMa(
    kind: MaType,
    source: Float64Array,
    length: number,
    volume: Float64Array | null,
): Float64Array {
    if (kind === "vwma") {
        if (volume === null) {
            const err = new TypeError(
                "computeMa: vwma requires a non-null volume array",
            ) as VwmaRequiresVolumeError;
            err.code = "ta-lib-vwma-requires-volume";
            throw err;
        }
        return vwmaFloat64(source, volume, length);
    }
    return computeMaOfFloat64(kind, source, length);
}
