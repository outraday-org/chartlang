// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ChartlangSetter, DrawingMapping } from "./types.js";
import { lookup } from "./types.js";

/**
 * The six Pine v6 drawing-object constructors the converter recognises.
 *
 * @since 0.1
 * @stable
 * @example
 *     const c: PineDrawingConstructor = "line.new";
 *     void c;
 */
export type PineDrawingConstructor =
    | "line.new"
    | "label.new"
    | "box.new"
    | "table.new"
    | "polyline.new"
    | "linefill.new";

const setters = (
    entries: ReadonlyArray<readonly [string, ChartlangSetter]>,
): ReadonlyMap<string, ChartlangSetter> => new Map(entries);

// docs: https://www.tradingview.com/pine-script-reference/v6/#type_line
const LINE_SETTERS = setters([
    ["set_xy1", { statePath: ["anchors", 0], arity: 2 }],
    ["set_xy2", { statePath: ["anchors", 1], arity: 2 }],
    ["set_x1", { statePath: ["anchors", 0, "time"], arity: 1 }],
    ["set_y1", { statePath: ["anchors", 0, "price"], arity: 1 }],
    ["set_x2", { statePath: ["anchors", 1, "time"], arity: 1 }],
    ["set_y2", { statePath: ["anchors", 1, "price"], arity: 1 }],
    ["set_first_point", { statePath: ["anchors", 0], arity: 1 }],
    ["set_second_point", { statePath: ["anchors", 1], arity: 1 }],
    ["set_color", { statePath: ["style", "color"], arity: 1 }],
    ["set_width", { statePath: ["style", "lineWidth"], arity: 1 }],
    ["set_style", { statePath: ["style", "lineStyle"], arity: 1 }],
    ["set_extend", { statePath: ["style"], arity: 1 }],
]);

// docs: https://www.tradingview.com/pine-script-reference/v6/#type_box
const BOX_SETTERS = setters([
    ["set_lefttop", { statePath: ["anchors", 0], arity: 2 }],
    ["set_rightbottom", { statePath: ["anchors", 1], arity: 2 }],
    ["set_top_left_point", { statePath: ["anchors", 0], arity: 1 }],
    ["set_bottom_right_point", { statePath: ["anchors", 1], arity: 1 }],
    ["set_left", { statePath: ["anchors", 0, "time"], arity: 1 }],
    ["set_top", { statePath: ["anchors", 0, "price"], arity: 1 }],
    ["set_right", { statePath: ["anchors", 1, "time"], arity: 1 }],
    ["set_bottom", { statePath: ["anchors", 1, "price"], arity: 1 }],
    ["set_border_color", { statePath: ["style", "stroke"], arity: 1 }],
    ["set_border_width", { statePath: ["style", "lineWidth"], arity: 1 }],
    ["set_border_style", { statePath: ["style", "lineStyle"], arity: 1 }],
    ["set_bgcolor", { statePath: ["style", "fill"], arity: 1 }],
]);

// docs: https://www.tradingview.com/pine-script-reference/v6/#type_label
const LABEL_SETTERS = setters([
    ["set_xy", { statePath: ["anchors", 0], arity: 2 }],
    ["set_x", { statePath: ["anchors", 0, "time"], arity: 1 }],
    ["set_y", { statePath: ["anchors", 0, "price"], arity: 1 }],
    ["set_point", { statePath: ["anchors", 0], arity: 1 }],
    ["set_text", { statePath: ["body"], arity: 1 }],
    ["set_color", { statePath: ["style", "bgColor"], arity: 1 }],
    ["set_textcolor", { statePath: ["style", "color"], arity: 1 }],
    ["set_size", { statePath: ["style", "size"], arity: 1 }],
    ["set_textalign", { statePath: ["style", "halign"], arity: 1 }],
]);

/**
 * Pine drawing constructor → chartlang `draw.*` kind, with the full
 * Pine-setter → `DrawingState`-patch projection per constructor. The
 * single source of truth Tasks 10–14 consume; no transform re-derives a
 * setter path.
 *
 * `chartlang: null` marks a constructor with no chartlang analogue
 * (`linefill.new`) — Task 14 emits a diagnostic at the use site.
 * `requiresBuilder` marks constructors whose body the transform
 * synthesises (`table.new` — Task 13).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { DRAWING_KIND_MAP } from "@invinite-org/chartlang-pine-converter";
 *     const m = DRAWING_KIND_MAP.get("line.new");
 *     void m?.chartlang; // "line"
 */
export const DRAWING_KIND_MAP: ReadonlyMap<PineDrawingConstructor, DrawingMapping> = new Map<
    PineDrawingConstructor,
    DrawingMapping
>([
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_line.new
    ["line.new", { pine: "line.new", chartlang: "line", setterMap: LINE_SETTERS }],
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_box.new
    ["box.new", { pine: "box.new", chartlang: "rectangle", setterMap: BOX_SETTERS }],
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_label.new
    [
        "label.new",
        {
            pine: "label.new",
            chartlang: "text",
            setterMap: LABEL_SETTERS,
            notes: "yloc.abovebar/belowbar non-mappable; Task 10 emits diagnostic at use site",
        },
    ],
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_polyline.new
    [
        "polyline.new",
        {
            pine: "polyline.new",
            chartlang: "polyline",
            setterMap: setters([]),
            notes: "Pine polyline is immutable; constructor-only, no setters",
        },
    ],
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_table.new
    [
        "table.new",
        {
            pine: "table.new",
            chartlang: "table",
            setterMap: setters([]),
            requiresBuilder: true,
            notes: "cells array synthesised by Task 13's table builder",
        },
    ],
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_linefill.new
    [
        "linefill.new",
        {
            pine: "linefill.new",
            chartlang: null,
            setterMap: setters([]),
            notes: "lowered to draw.fillBetween by the polyline/linefill transform (static two-line); dynamic forms reject",
        },
    ],
]);

/**
 * Resolve a Pine drawing constructor against {@link DRAWING_KIND_MAP}.
 * Returns `null` for unknown constructors and for REJECTs
 * (`linefill.new`).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { drawingLookup } from "@invinite-org/chartlang-pine-converter";
 *     const m = drawingLookup("line.new");
 *     void m?.setterMap.get("set_xy1"); // { statePath: ["anchors", 0], arity: 2 }
 */
export const drawingLookup = (key: string): DrawingMapping | null => lookup(DRAWING_KIND_MAP, key);
