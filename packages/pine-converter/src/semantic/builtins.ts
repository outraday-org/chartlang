// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { HandleType, SymbolInfo, TypeQualifier } from "./types.js";

// Build a built-in symbol row. Built-ins have no declaration span and no
// type annotation; their qualifier is fixed by the lattice class they
// belong to (series OHLCV, const enums, input-settable namespaces, …).
function builtin(
    name: string,
    qualifier: TypeQualifier,
    handleType: HandleType | null = null,
): readonly [string, SymbolInfo] {
    return [
        name,
        {
            name,
            kind: "builtin",
            declarationSpan: null,
            typeAnnotation: null,
            qualifier,
            handleType,
        },
    ];
}

// Series-typed built-ins: the live bar stream Pine recomputes each bar.
const SERIES_NAMES: readonly string[] = [
    "open",
    "high",
    "low",
    "close",
    "volume",
    "hl2",
    "hlc3",
    "ohlc4",
    "hlcc4",
    "time",
    "time_close",
    "timenow",
    "bar_index",
];

// `const`-qualified enum constants and location/style/size vocabularies.
const CONST_NAMES: readonly string[] = [
    "barstate.isfirst",
    "barstate.islast",
    "barstate.isnew",
    "barstate.ishistory",
    "barstate.isrealtime",
    "barstate.isconfirmed",
    "xloc.bar_index",
    "xloc.bar_time",
    "yloc.price",
    "yloc.abovebar",
    "yloc.belowbar",
    "extend.none",
    "extend.left",
    "extend.right",
    "extend.both",
    "order.ascending",
    "order.descending",
    "line.style_solid",
    "line.style_dashed",
    "line.style_dotted",
    "line.style_arrow_left",
    "line.style_arrow_right",
    "line.style_arrow_both",
    "hline.style_solid",
    "hline.style_dashed",
    "hline.style_dotted",
    "label.style_none",
    "label.style_label_up",
    "label.style_label_down",
    "label.style_label_left",
    "label.style_label_right",
    "label.style_circle",
    "label.style_square",
    "label.style_diamond",
    "size.auto",
    "size.tiny",
    "size.small",
    "size.normal",
    "size.large",
    "size.huge",
    "text.align_left",
    "text.align_center",
    "text.align_right",
    "text.align_top",
    "text.align_bottom",
    "text.format_none",
    "text.format_bold",
    "text.format_italic",
    "font.family_default",
    "font.family_monospace",
    "position.top_left",
    "position.top_center",
    "position.top_right",
    "position.middle_left",
    "position.middle_center",
    "position.middle_right",
    "position.bottom_left",
    "position.bottom_center",
    "position.bottom_right",
    "color.red",
    "color.green",
    "color.blue",
    "color.white",
    "color.black",
    "color.orange",
    "color.yellow",
    "color.purple",
    "color.gray",
    "color.lime",
    "color.maroon",
    "color.navy",
    "color.olive",
    "color.silver",
    "color.teal",
    "color.aqua",
    "color.fuchsia",
];

// Object-namespace identifiers and library roots — `simple`-qualified
// handles to a module of functions/constants.
const NAMESPACE_NAMES: readonly string[] = [
    "line",
    "label",
    "box",
    "table",
    "polyline",
    "linefill",
    "chart",
    "ta",
    "math",
    "input",
    "request",
    "array",
    "map",
    "color",
    "str",
    "barstate",
    "xloc",
    "yloc",
    "extend",
    "order",
    "size",
    "text",
    "font",
    "position",
    "shape",
    "location",
    "display",
    "format",
    "scale",
    "barmerge",
    "alert",
    "timeframe",
    "dayofweek",
    "session",
    "currency",
    "syminfo",
];

// Plot family + na: na is `const` (the no-value literal); plot builtins are
// `simple` callables.
const PLOT_NAMES: readonly string[] = [
    "plot",
    "plotshape",
    "plotchar",
    "plotcandle",
    "plotbar",
    "plotarrow",
    "hline",
    "fill",
    "bgcolor",
    "barcolor",
];

/**
 * The Pine v6 built-in symbol table seeded into the root scope's resolution
 * chain. OHLCV and bar refs are `series`; enum constants and `na` are
 * `const`; object namespaces, library roots, and the plot family are
 * `simple` callables. Drawing object roots (`line`/`label`/…) carry their
 * `handleType` so a `chart.point.new`-style constructor recognises the
 * family. Data-driven — add a Pine name by adding a row.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { BUILTIN_SYMBOLS } from "./builtins.js";
 *     BUILTIN_SYMBOLS.get("close")?.qualifier; // "series"
 */
export const BUILTIN_SYMBOLS: ReadonlyMap<string, SymbolInfo> = new Map<string, SymbolInfo>([
    ...SERIES_NAMES.map((name) => builtin(name, "series")),
    ...CONST_NAMES.map((name) => builtin(name, "const")),
    ...NAMESPACE_NAMES.map((name) => builtin(name, "simple")),
    ...PLOT_NAMES.map((name) => builtin(name, "simple")),
    builtin("timestamp", "simple"),
    builtin("na", "const"),
    builtin("chart.point", "simple"),
]);
