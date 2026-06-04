// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "@invinite-org/chartlang-core";

/**
 * What every `ta.*` primitive accepts as its `source` argument. Phase-1
 * scripts pass `bar.close` (a `number`) as the source per the seed-
 * example convention; future surfaces (`source: Series<number>`) are
 * structurally compatible because the primitive only ever reads
 * `source.current`. The union is the runtime's accommodation of both
 * shapes without forcing the script author to wrap a scalar.
 *
 * @formula  N/A — type alias
 * @since 0.1
 * @experimental
 * @example
 *     // type S = ScalarOrSeries; // number | Series<number>
 */
export type ScalarOrSeries = number | Series<number>;

/**
 * Read the current value off a `ScalarOrSeries`. Returns the scalar
 * directly; reads `.current` off a Series. `Series` is duck-typed —
 * any object with a `current: number` field passes.
 *
 * @formula  source is number → source ; source is Series → source.current
 * @since 0.1
 * @experimental
 * @example
 *     // import { readSourceValue } from "./sourceValue";
 *     // readSourceValue(12.5); // 12.5
 *     // readSourceValue(series); // series.current
 */
export function readSourceValue(source: ScalarOrSeries): number {
    if (typeof source === "number") return source;
    return source.current;
}
