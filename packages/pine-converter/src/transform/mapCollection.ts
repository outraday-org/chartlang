// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { VariableDeclaration } from "../ast/statements.js";
import type { SourceSpan } from "../index.js";
import type { SemanticResult } from "../semantic/index.js";
import { dottedCallee } from "./callArgs.js";

/**
 * The capacity the converter synthesizes for a Pine `map.new<K, V>()` slot.
 * Pine maps are UNBOUNDED, but chartlang's `state.map<K, V>(capacity)` requires
 * a compile-time literal capacity (so the store is bounded and snapshot-clean).
 * The converter emits this default + a `map-capacity-synthesized` info telling
 * the author to set a real bound; it never rejects a map for missing capacity.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { SYNTHESIZED_MAP_CAPACITY } from "./mapCollection.js";
 *     SYNTHESIZED_MAP_CAPACITY; // 1000
 */
export const SYNTHESIZED_MAP_CAPACITY = 1000;

// Whether a declaration's initializer is a `map.new(...)` constructor — the
// discriminator that separates a keyed-collection `var` from a scalar `var`.
function isMapNew(value: ExpressionNode): value is CallExpression {
    return value.kind === "call-expression" && dottedCallee(value) === "map.new";
}

// Whether a `map.new(...)` map's VALUE type is numeric. The parser collapses a
// `map<K, V>` annotation to a `named-type` whose name is the LAST type arg (the
// VALUE type) — `int`/`float` are numeric; `bool`/`string`/`color` are not. A
// null annotation defaults to numeric (the dominant case, mirroring the scalar
// `var` → `state.series` and `var array<T>` → `state.array` lowerings). The KEY
// type is not preserved by the parser, so the converter always emits a `number`
// key (`state.map<number, number>`); a string-keyed map needs a hand-fix.
function isNumericValue(decl: VariableDeclaration): boolean {
    const annotation = decl.typeAnnotation;
    if (annotation === null || annotation.kind !== "named-type") {
        return true;
    }
    return annotation.name === "int" || annotation.name === "float";
}

// A numeric-value `var map` slot: the source declaration plus the SYNTHESIZED
// capacity (Pine maps carry none).
type MapSlot = Readonly<{ decl: VariableDeclaration; cap: number }>;

/**
 * The map classification of a script's top-level `var`/`varip` `map.new(...)`
 * declarations, partitioned two ways:
 *
 * - `slots` — numeric-value maps; each lowers to
 *   `const <name> = state.map<number, number>(SYNTHESIZED_MAP_CAPACITY)` + a
 *   `map-capacity-synthesized` info (Pine maps are unbounded; chartlang needs a
 *   literal cap).
 * - `nonNumeric` — `map<K, bool|string|color>` (or UDT) value maps; each keeps
 *   its current (non-lowered) behavior + a `map-collection-non-numeric` info.
 *   Maps the Pine name to the decl span the info anchors at.
 *
 * Unlike {@link NumericArrayScan} there is NO `unbounded` partition — a Pine map
 * is ALWAYS unbounded, so the capacity is synthesized rather than rejected.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { scanMaps } from "./mapCollection.js";
 *     declare const analysis: import("../semantic/index.js").SemanticResult;
 *     const scan = scanMaps(analysis, new Set());
 *     scan.slots.size; // number of numeric-value maps
 */
export type MapScan = Readonly<{
    slots: ReadonlyMap<string, MapSlot>;
    nonNumeric: ReadonlyMap<string, SourceSpan>;
}>;

/**
 * Classify a script's top-level `var`/`varip` `map.new(...)` declarations into
 * the {@link MapScan} partitions. Only ROOT-level declarations the drawing
 * transforms do NOT already own are considered (`owned` filters them out); a
 * non-numeric value type routes to `nonNumeric`; everything else routes to
 * `slots` with the synthesized capacity.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { lex } from "../lexer/index.js";
 *     import { parseStatements } from "../parser/index.js";
 *     import { analyze } from "../semantic/index.js";
 *     import { scanMaps } from "./mapCollection.js";
 *     const src =
 *         '//@version=6\nindicator("X")\n' +
 *         "var map<float, float> levels = map.new<float, float>()\n";
 *     const analysis = analyze(parseStatements(lex(src).tokens).script);
 *     const scan = scanMaps(analysis, new Set());
 *     scan.slots.get("levels")?.cap; // 1000
 */
export function scanMaps(analysis: SemanticResult, owned: ReadonlySet<string>): MapScan {
    const slots = new Map<string, MapSlot>();
    const nonNumeric = new Map<string, SourceSpan>();
    for (const stmt of analysis.script.body) {
        if (
            stmt.kind !== "variable-declaration" ||
            (stmt.qualifier !== "var" && stmt.qualifier !== "varip") ||
            owned.has(stmt.name) ||
            !isMapNew(stmt.initializer)
        ) {
            continue;
        }
        if (!isNumericValue(stmt)) {
            nonNumeric.set(stmt.name, stmt.span);
            continue;
        }
        slots.set(stmt.name, { decl: stmt, cap: SYNTHESIZED_MAP_CAPACITY });
    }
    return { slots, nonNumeric };
}
