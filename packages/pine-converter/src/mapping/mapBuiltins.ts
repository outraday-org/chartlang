// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { lookup } from "./types.js";

/**
 * How the converter shapes a Pine `map.<member>(id, …)` call's trailing
 * arguments (after the map id) onto the chartlang `state.map` handle:
 * - `put` — two trailing args (`map.put(id, k, v)` → `<slot>.set(k, v)`).
 * - `get` — one key arg, na-bridged (`map.get(id, k)` →
 *   `(<slot>.get(k) ?? Number.NaN)`; chartlang returns `undefined`, Pine `na`).
 * - `has` — one key arg (`map.contains(id, k)` → `<slot>.has(k)`).
 * - `remove` — one key arg (`map.remove(id, k)` → `<slot>.delete(k)`).
 * - `size` — no arg, a PROPERTY read (`map.size(id)` → `<slot>.size`).
 * - `clear` — no arg (`map.clear(id)` → `<slot>.clear()`).
 *
 * @since 1.4
 * @stable
 * @example
 *     const f: MapBuiltinForm = "put";
 *     void f;
 */
export type MapBuiltinForm = "put" | "get" | "has" | "remove" | "size" | "clear";

/**
 * A Pine `map.*` member and the chartlang {@link MutableMapSlot} method it maps
 * to. `chartlang` is `null` for REJECTs (`map.keys` / `map.values` — chartlang
 * v1 has no iterators); the `form` then carries the documented reason in
 * `notes`.
 *
 * @since 1.4
 * @stable
 * @example
 *     const m: MapBuiltinMapping = { pine: "map.put", chartlang: "set", form: "put" };
 *     void m;
 */
export type MapBuiltinMapping = Readonly<{
    pine: string;
    chartlang: string | null;
    form: MapBuiltinForm;
    notes?: string;
}>;

const builtin = (
    pine: string,
    chartlang: string | null,
    form: MapBuiltinForm,
    notes?: string,
): readonly [string, MapBuiltinMapping] => [
    pine,
    notes === undefined ? { pine, chartlang, form } : { pine, chartlang, form, notes },
];

/**
 * Pine `map.*` member → chartlang `state.map` handle method. The members
 * delegate onto the slot surface the same way the `array.*` reads do
 * (`transform/emitContext.ts`'s `rewriteMapBuiltin`), so NO `map` import is
 * emitted. `map.keys`/`map.values` are REJECTs (`chartlang: null`) — chartlang
 * v1 exposes `keyAt`/`size` bounded indexing, not iterators — and any unmapped
 * `map.*` over a slot emits a `Number.NaN` placeholder + a
 * `map-builtin-not-mapped` diagnostic rather than broken `map.<x>(...)`.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { MAP_BUILTIN_MAP } from "./mapBuiltins.js";
 *     MAP_BUILTIN_MAP.get("map.put")?.chartlang; // "set"
 */
export const MAP_BUILTIN_MAP: ReadonlyMap<string, MapBuiltinMapping> = new Map<
    string,
    MapBuiltinMapping
>([
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_map.put
    builtin("map.put", "set", "put"),
    // chartlang `get` returns `undefined` for an absent key (Pine `na`); the
    // emitter na-bridges the read with `?? Number.NaN`.
    builtin("map.get", "get", "get"),
    builtin("map.contains", "has", "has"),
    builtin("map.remove", "delete", "remove"),
    builtin("map.size", "size", "size"),
    builtin("map.clear", "clear", "clear"),
    // No v1 iterators — `state.map` exposes `keyAt(i)` + `size` bounded
    // indexing, not `keys()`/`values()`. Deferred to a follow-up.
    builtin(
        "map.keys",
        null,
        "get",
        "map key/value iteration is unsupported — chartlang v1 has no map iterators (keyAt(i) + size only)",
    ),
    builtin(
        "map.values",
        null,
        "get",
        "map key/value iteration is unsupported — chartlang v1 has no map iterators (keyAt(i) + size only)",
    ),
]);

/**
 * Resolve a Pine `map.*` member against {@link MAP_BUILTIN_MAP}. Returns `null`
 * for unknown members and for REJECTs (`map.keys` / `map.values`).
 *
 * @since 1.4
 * @stable
 * @example
 *     import { mapBuiltinLookup } from "./mapBuiltins.js";
 *     mapBuiltinLookup("map.contains")?.chartlang; // "has"
 */
export const mapBuiltinLookup = (key: string): MapBuiltinMapping | null =>
    lookup(MAP_BUILTIN_MAP, key);
