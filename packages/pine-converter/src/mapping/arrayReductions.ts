// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { lookup } from "./types.js";

/**
 * How the converter forwards a Pine `array.<reduction>(id, …)` call's trailing
 * arguments (after the array id) onto the chartlang handle method:
 * - `none` — a no-arg reduction (`array.avg(id)` → `<slot>.avg()`).
 * - `value` — a required trailing value/parameter (`array.percentile_linear_
 *   interpolation(id, p)` → `<slot>.percentile(p)`).
 * - `optional` — an optional trailing flag forwarded only when present
 *   (`array.stdev(id[, biased])` → `<slot>.stdev([biased])`; Pine's `biased`
 *   matches chartlang's `biased` 1:1, population by default).
 * - `sort` — the in-place-vs-copy sort, whose `order` arg lowers via
 *   {@link ARRAY_SORT_ORDER_MAP}.
 *
 * @since 1.4
 * @stable
 * @example
 *     const a: ArrayReductionArity = "none";
 *     void a;
 */
export type ArrayReductionArity = "none" | "value" | "optional" | "sort";

/**
 * A Pine `array.*` reduction member and the chartlang {@link MutableArraySlot}
 * method it maps to. `chartlang` is `null` for REJECTs
 * (`array.percentile_nearest_rank` — nearest-rank is deferred; only linear
 * interpolation ships in v1).
 *
 * @since 1.4
 * @stable
 * @example
 *     const m: ArrayReductionMapping = { pine: "array.avg", chartlang: "avg", arity: "none" };
 *     void m;
 */
export type ArrayReductionMapping = Readonly<{
    pine: string;
    chartlang: string | null;
    arity: ArrayReductionArity;
    notes?: string;
}>;

const reduction = (
    pine: string,
    chartlang: string | null,
    arity: ArrayReductionArity,
    notes?: string,
): readonly [string, ArrayReductionMapping] => [
    pine,
    notes === undefined ? { pine, chartlang, arity } : { pine, chartlang, arity, notes },
];

/**
 * Pine `array.*` reduction member → chartlang `state.array` handle method. The
 * reductions delegate 1:1 onto the handle (`array.avg(win)` → `win.avg()`), so
 * the converter lowers them onto the same slot surface as the existing
 * `array.push`/`array.get`/`array.size` rewrites (`transform/emitContext.ts`).
 * NaN policy, population-vs-sample default, and the linear-interpolation
 * percentile are documented on the core `MutableArraySlot` interface — the
 * mapping owns only the NAME decision. `array.percentile_nearest_rank` is a
 * REJECT (`chartlang: null`); the emitter leaves a `Number.NaN` placeholder +
 * an `array-reduction-not-mapped` diagnostic rather than collapsing it onto the
 * linear-interpolation form.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { ARRAY_REDUCTION_MAP } from "./arrayReductions.js";
 *     const m = ARRAY_REDUCTION_MAP.get("array.stdev");
 *     void m?.chartlang; // "stdev"
 */
export const ARRAY_REDUCTION_MAP: ReadonlyMap<string, ArrayReductionMapping> = new Map<
    string,
    ArrayReductionMapping
>([
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_array.avg
    reduction("array.sum", "sum", "none"),
    reduction("array.avg", "avg", "none"),
    reduction("array.min", "min", "none"),
    reduction("array.max", "max", "none"),
    reduction("array.range", "range", "none"),
    reduction("array.median", "median", "none"),
    // Pine `biased` (default true ⇒ population) matches chartlang's `biased`
    // 1:1, so it forwards directly when present.
    reduction("array.variance", "variance", "optional"),
    reduction("array.stdev", "stdev", "optional"),
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_array.percentile_linear_interpolation
    reduction("array.percentile_linear_interpolation", "percentile", "value"),
    // Nearest-rank is deferred — only linear interpolation ships in v1.
    reduction(
        "array.percentile_nearest_rank",
        null,
        "value",
        "nearest-rank percentile deferred — only linear interpolation ships in v1",
    ),
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_array.indexof
    reduction("array.indexof", "indexOf", "value"),
    reduction("array.includes", "includes", "value"),
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_array.sort
    // Pine sorts IN PLACE; chartlang `sort` returns a fresh COPY — see the
    // `array-sort-returns-copy` caveat raised at the emit site.
    reduction("array.sort", "sort", "sort"),
]);

/**
 * Pine `order.*` sort direction → chartlang `<slot>.sort(order?)` literal.
 * `order.ascending` (and an omitted order) is chartlang's default, so the
 * emitter drops the arg and emits a bare `<slot>.sort()`; only `order.descending`
 * forwards `"desc"`.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { ARRAY_SORT_ORDER_MAP } from "./arrayReductions.js";
 *     ARRAY_SORT_ORDER_MAP.get("order.descending"); // "desc"
 */
export const ARRAY_SORT_ORDER_MAP: ReadonlyMap<string, "asc" | "desc"> = new Map([
    ["order.ascending", "asc"],
    ["order.descending", "desc"],
]);

/**
 * Resolve a Pine `array.*` reduction member against {@link ARRAY_REDUCTION_MAP}.
 * Returns `null` for unknown members and for REJECTs
 * (`array.percentile_nearest_rank`).
 *
 * @since 1.4
 * @stable
 * @example
 *     import { arrayReductionLookup } from "./arrayReductions.js";
 *     arrayReductionLookup("array.median")?.chartlang; // "median"
 */
export const arrayReductionLookup = (key: string): ArrayReductionMapping | null =>
    lookup(ARRAY_REDUCTION_MAP, key);
