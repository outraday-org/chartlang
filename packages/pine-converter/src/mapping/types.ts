// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Shared base for every entry in a Pine → chartlang mapping table. `pine`
 * is the fully-qualified Pine v6 identifier (e.g. `"line.new"`,
 * `"line.style_dashed"`). `chartlang` is the chartlang target; `null`
 * marks an entry the converter cannot faithfully translate — a REJECT —
 * which the diagnostics layer surfaces at the use site.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const e: MappingEntry = { pine: "math.random", chartlang: null };
 *     void e;
 */
export type MappingEntry = Readonly<{
    pine: string;
    chartlang: string | Readonly<Record<string, unknown>> | null;
    notes?: string;
}>;

/**
 * One Pine drawing setter (`set_xy1`, `set_color`, …) projected onto a
 * path inside the chartlang `DrawingState` patch the transform feeds to
 * `handle.update({...})`.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const s: ChartlangSetter = { statePath: ["anchors", 0], arity: 2 };
 *     void s;
 */
export type ChartlangSetter = Readonly<{
    /** Path inside the `DrawingState` patch — e.g. `["anchors", 0]` for `set_xy1`. */
    statePath: readonly (string | number)[];
    /** Number of args the Pine setter takes after the handle. */
    arity: number;
    /**
     * Optional pre-transform on the raw argument tuple. Typed as
     * `readonly unknown[]` because the Pine AST (`ExpressionNode`,
     * Task 3/4) is not built yet; transform tasks narrow at the call
     * site. Keeping the mapping module AST-agnostic preserves the data /
     * logic split this table is built to enforce.
     */
    transform?: (args: readonly unknown[]) => unknown;
}>;

/**
 * A Pine drawing constructor (`line.new`, `box.new`, …) and the chartlang
 * `draw.*` kind it lowers to, with the full setter projection. `chartlang`
 * is `null` for constructors with no chartlang analogue (`linefill.new`).
 *
 * @since 0.1
 * @experimental
 * @example
 *     const d: DrawingMapping = {
 *         pine: "line.new",
 *         chartlang: "line",
 *         setterMap: new Map(),
 *     };
 *     void d;
 */
export type DrawingMapping = Readonly<{
    pine: string;
    chartlang: string | null;
    setterMap: ReadonlyMap<string, ChartlangSetter>;
    /** Drawing kinds (e.g. `table.new`) whose body the transform synthesises. */
    requiresBuilder?: boolean;
    notes?: string;
}>;

/**
 * A Pine enum value (`line.style_dashed`, `extend.both`) and the chartlang
 * literal or partial-state object it lowers to.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const e: EnumMapping = { pine: "line.style_solid", chartlang: "solid" };
 *     void e;
 */
export type EnumMapping = MappingEntry;

/**
 * A Pine `input.*` primitive and the chartlang `input.*` builder it maps
 * to, with an optional argument-name remap.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const i: InputMapping = { pine: "input.timeframe", chartlang: "input.interval" };
 *     void i;
 */
export type InputMapping = Readonly<{
    pine: string;
    chartlang: string | null;
    argRemap?: ReadonlyMap<string, string>;
    notes?: string;
}>;

/**
 * A Pine `ta.*` member and the chartlang `ta.*` member it passes through
 * to. `signatureNote` flags shape divergence; `chartlang` is `null` for
 * members with no chartlang analogue.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const t: TaMapping = { pine: "ta.rma", chartlang: "ta.smma" };
 *     void t;
 */
export type TaMapping = Readonly<{
    pine: string;
    chartlang: string | null;
    signatureNote?: string;
}>;

/**
 * A Pine `math.*` member and the JS `Math.*` member or inline-helper note
 * it maps to. `chartlang` is `null` for REJECTs (`math.random`).
 *
 * @since 0.1
 * @experimental
 * @example
 *     const m: MathMapping = { pine: "math.abs", chartlang: "Math.abs" };
 *     void m;
 */
export type MathMapping = Readonly<{
    pine: string;
    chartlang: string | null;
    notes?: string;
}>;

/**
 * Resolve a Pine key against a mapping table. Returns `null` when the key
 * is absent OR when the matched entry is a REJECT (`chartlang === null`),
 * so callers get a single "no usable target" signal. Entries with a
 * non-null `chartlang` are returned verbatim.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { DRAWING_KIND_MAP } from "./drawingKinds.js";
 *     const m = lookup(DRAWING_KIND_MAP, "line.new");
 *     void m;
 */
export function lookup<T extends { readonly chartlang: unknown }>(
    map: ReadonlyMap<string, T>,
    key: string,
): T | null {
    const entry = map.get(key);
    if (entry === undefined || entry.chartlang === null) {
        return null;
    }
    return entry;
}
