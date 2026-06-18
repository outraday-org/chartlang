// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { WithSpan } from "./spans.js";

/**
 * A named, non-generic Pine v6 type keyword.
 *
 * Source: TradingView Pine Script v6 reference — Types
 * (https://www.tradingview.com/pine-script-docs/language/type-system/).
 *
 * @since 0.1
 * @stable
 * @example
 *     const name: NamedTypeName = "float";
 *     void name;
 */
export type NamedTypeName =
    | "int"
    | "float"
    | "bool"
    | "color"
    | "string"
    | "line"
    | "label"
    | "box"
    | "table"
    | "polyline"
    | "linefill";

/**
 * A non-generic type annotation (`int`, `float`, `line`, …).
 *
 * @since 0.1
 * @stable
 * @example
 *     const t: NamedType = {
 *         kind: "named-type",
 *         name: "float",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 6 },
 *     };
 *     void t;
 */
export type NamedType = WithSpan &
    Readonly<{
        kind: "named-type";
        name: NamedTypeName;
    }>;

/**
 * A single-parameter generic type constructor name (`array<T>`,
 * `series<T>`, `simple<T>`, `const<T>`, `input<T>`, `matrix<T>`).
 *
 * @since 0.1
 * @stable
 * @example
 *     const ctor: GenericTypeName = "array";
 *     void ctor;
 */
export type GenericTypeName = "array" | "matrix" | "series" | "simple" | "const" | "input";

/**
 * A single-type-parameter generic annotation (`array<float>`,
 * `series<line>`, …).
 *
 * @since 0.1
 * @stable
 * @example
 *     const t: GenericType = {
 *         kind: "generic-type",
 *         name: "array",
 *         element: {
 *             kind: "named-type",
 *             name: "float",
 *             span: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 12 },
 *         },
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 13 },
 *     };
 *     void t;
 */
export type GenericType = WithSpan &
    Readonly<{
        kind: "generic-type";
        name: GenericTypeName;
        element: TypeAnnotation;
    }>;

/**
 * A `map<K, V>` annotation with two type parameters.
 *
 * @since 0.1
 * @stable
 * @example
 *     const t: MapType = {
 *         kind: "map-type",
 *         key: {
 *             kind: "named-type",
 *             name: "string",
 *             span: { startLine: 1, startColumn: 5, endLine: 1, endColumn: 11 },
 *         },
 *         value: {
 *             kind: "named-type",
 *             name: "float",
 *             span: { startLine: 1, startColumn: 13, endLine: 1, endColumn: 18 },
 *         },
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 19 },
 *     };
 *     void t;
 */
export type MapType = WithSpan &
    Readonly<{
        kind: "map-type";
        key: TypeAnnotation;
        value: TypeAnnotation;
    }>;

/**
 * Any Pine v6 type annotation: a named type, a single-parameter generic,
 * or a `map<K, V>`.
 *
 * @since 0.1
 * @stable
 * @example
 *     const t: TypeAnnotation = {
 *         kind: "named-type",
 *         name: "int",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 4 },
 *     };
 *     void t;
 */
export type TypeAnnotation = NamedType | GenericType | MapType;
