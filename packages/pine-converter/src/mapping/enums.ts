// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { EnumMapping } from "./types.js";
import { lookup } from "./types.js";

const entry = (
    pine: string,
    chartlang: EnumMapping["chartlang"],
    notes?: string,
): readonly [string, EnumMapping] => [
    pine,
    notes === undefined ? { pine, chartlang } : { pine, chartlang, notes },
];

/**
 * The concrete CSS color a Pine `na` (transparent) color lowers to — fully
 * transparent black (8-digit `#RRGGBBAA` hex, matching the converter's
 * transparency output). Pine's `na` color renders nothing, so the faithful
 * chartlang `Color` (a CSS string) is fully transparent. Used as the
 * `state.color(...)` init for `var color x = na`; the runtime synthesizes no
 * default of its own, so the converter supplies it.
 *
 * @since 1.6
 * @stable
 * @example
 *     import { PINE_NA_COLOR } from "@invinite-org/chartlang-pine-converter";
 *     PINE_NA_COLOR; // "#00000000"
 */
export const PINE_NA_COLOR = "#00000000";

/**
 * Pine enum value → chartlang literal (or partial-state object). The
 * single vocabulary every transform consults when lowering a Pine style
 * constant. Adding a Pine-version enum = one line here.
 *
 * Notable collapses (chartlang TARGET verified against
 * `@invinite-org/chartlang-core`):
 *
 * - `line.style_arrow_*` → `"dashed"` — chartlang `LineStyle` is
 *   `solid|dashed|dotted` only; arrow heads are not modeled (warning).
 * - `label.style_*` shape glyphs → `draw.marker`; `draw.marker` carries
 *   NO shape field, so the glyph is dropped (warning). Callout styles →
 *   `draw.frame`.
 * - `size.auto` → `"normal"`; chartlang `TextOpts.size` has no `auto`.
 * - `text.format_*` / `font.family_*` → unmappable (chartlang `TextOpts`
 *   has no bold/italic/font-family).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { ENUM_VALUE_MAP } from "@invinite-org/chartlang-pine-converter";
 *     const m = ENUM_VALUE_MAP.get("extend.both");
 *     void m?.chartlang; // { extendLeft: true, extendRight: true }
 */
export const ENUM_VALUE_MAP: ReadonlyMap<string, EnumMapping> = new Map<string, EnumMapping>([
    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_line.style_solid
    entry("line.style_solid", "solid"),
    entry("line.style_dotted", "dotted"),
    entry("line.style_dashed", "dashed"),
    entry(
        "line.style_arrow_left",
        "dashed",
        "arrow heads not modeled in chartlang LineStyle; emit warning",
    ),
    entry(
        "line.style_arrow_right",
        "dashed",
        "arrow heads not modeled in chartlang LineStyle; emit warning",
    ),
    entry(
        "line.style_arrow_both",
        "dashed",
        "arrow heads not modeled in chartlang LineStyle; emit warning",
    ),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_extend.none
    entry("extend.none", { extendLeft: false, extendRight: false }),
    entry("extend.left", { extendLeft: true, extendRight: false }),
    entry("extend.right", { extendLeft: false, extendRight: true }),
    entry("extend.both", { extendLeft: true, extendRight: true }),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_label.style_none
    entry("label.style_none", "text"),
    entry(
        "label.style_circle",
        "marker",
        "draw.marker has no shape field; glyph dropped (warning)",
    ),
    entry("label.style_square", "rectangle"),
    entry(
        "label.style_diamond",
        "marker",
        "draw.marker has no shape field; glyph dropped (warning)",
    ),
    entry("label.style_cross", "marker", "draw.marker has no shape field; glyph dropped (warning)"),
    entry(
        "label.style_xcross",
        "marker",
        "draw.marker has no shape field; glyph dropped (warning)",
    ),
    entry("label.style_flag", "marker", "draw.marker has no shape field; glyph dropped (warning)"),
    entry("label.style_arrowup", "arrow-mark-up"),
    entry("label.style_arrowdown", "arrow-mark-down"),
    entry(
        "label.style_triangleup",
        "marker",
        "draw.marker has no shape field; glyph dropped (warning)",
    ),
    entry(
        "label.style_triangledown",
        "marker",
        "draw.marker has no shape field; glyph dropped (warning)",
    ),
    entry("label.style_label_up", "frame", "tinted callout → draw.frame with label + bgColor"),
    entry("label.style_label_down", "frame", "tinted callout → draw.frame with label + bgColor"),
    entry("label.style_label_left", "frame", "tinted callout → draw.frame with label + bgColor"),
    entry("label.style_label_right", "frame", "tinted callout → draw.frame with label + bgColor"),
    entry("label.style_label_center", "frame", "tinted callout → draw.frame with label + bgColor"),
    entry(
        "label.style_label_lower_left",
        "frame",
        "tinted callout → draw.frame with label + bgColor",
    ),
    entry(
        "label.style_label_lower_right",
        "frame",
        "tinted callout → draw.frame with label + bgColor",
    ),
    entry(
        "label.style_label_upper_left",
        "frame",
        "tinted callout → draw.frame with label + bgColor",
    ),
    entry(
        "label.style_label_upper_right",
        "frame",
        "tinted callout → draw.frame with label + bgColor",
    ),
    entry("label.style_text_outline", "text", "outline not modeled; plain text"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_shape.xcross
    // Pine `plotshape` glyphs → chartlang `PlotShapeGlyph`. The arrow/label
    // glyphs have no exact analogue and approximate to the nearest triangle/
    // flag.
    entry("shape.circle", "circle"),
    entry("shape.triangleup", "triangle-up"),
    entry("shape.triangledown", "triangle-down"),
    entry("shape.square", "square"),
    entry("shape.diamond", "diamond"),
    entry("shape.cross", "cross"),
    entry("shape.xcross", "xcross"),
    entry("shape.flag", "flag"),
    entry("shape.arrowup", "triangle-up", "no arrow glyph in PlotShapeGlyph; approximated"),
    entry("shape.arrowdown", "triangle-down", "no arrow glyph in PlotShapeGlyph; approximated"),
    entry("shape.labelup", "flag", "no label glyph in PlotShapeGlyph; approximated"),
    entry("shape.labeldown", "flag", "no label glyph in PlotShapeGlyph; approximated"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_location.abovebar
    entry("location.abovebar", "above"),
    entry("location.belowbar", "below"),
    entry("location.top", "above"),
    entry("location.bottom", "below"),
    entry("location.absolute", "absolute"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_size.tiny
    entry("size.tiny", "tiny"),
    entry("size.small", "small"),
    entry("size.normal", "normal"),
    entry("size.large", "large"),
    entry("size.huge", "huge"),
    entry("size.auto", "normal", "chartlang TextOpts.size has no auto; warning"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_text.align_left
    entry("text.align_left", "left"),
    entry("text.align_center", "center"),
    entry("text.align_right", "right"),
    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_text.align_top
    entry("text.align_top", "top", "vertical when arg is text_valign; converter disambiguates"),
    entry(
        "text.align_bottom",
        "bottom",
        "vertical when arg is text_valign; converter disambiguates",
    ),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_text.format_bold
    entry("text.format_bold", null, "chartlang TextOpts has no bold; emit warning"),
    entry("text.format_italic", null, "chartlang TextOpts has no italic; emit warning"),
    entry("text.format_none", null, "no-op; chartlang default text"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_font.family_default
    entry("font.family_default", null, "chartlang default; omit"),
    entry("font.family_monospace", null, "chartlang TextOpts has no font family; emit warning"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_position.top_left
    entry("position.top_left", "top-left"),
    entry("position.top_center", "top-center"),
    entry("position.top_right", "top-right"),
    entry("position.middle_left", "middle-left"),
    entry("position.middle_center", "middle-center"),
    entry("position.middle_right", "middle-right"),
    entry("position.bottom_left", "bottom-left"),
    entry("position.bottom_center", "bottom-center"),
    entry("position.bottom_right", "bottom-right"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_xloc.bar_index
    entry("xloc.bar_index", null, "consumed by coordinate resolver (Task 7)"),
    entry("xloc.bar_time", null, "consumed by coordinate resolver (Task 7)"),
    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_yloc.price
    entry("yloc.price", "price", "anchor price used verbatim"),
    entry("yloc.abovebar", null, "label-only; non-trivial bar.high math — Task 10"),
    entry("yloc.belowbar", null, "label-only; non-trivial bar.low math — Task 10"),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_alert.freq_all
    // chartlang `AlertOpts` has no frequency contract, so the firing cadence
    // cannot be honored — REJECT rows so the `alert(msg, freq)` lowering
    // RECOGNISES the symbol (via `ENUM_VALUE_MAP.has`, the `linefill.new`
    // precedent) and CONSUMES it instead of leaking it to the generic emitter.
    entry("alert.freq_all", null, "chartlang AlertOpts has no frequency; freq dropped (info)"),
    entry(
        "alert.freq_once_per_bar",
        null,
        "chartlang AlertOpts has no frequency; freq dropped (info)",
    ),
    entry(
        "alert.freq_once_per_bar_close",
        null,
        "chartlang AlertOpts has no frequency; freq dropped (info)",
    ),

    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_color.red
    entry("color.red", "#FF5252"),
    entry("color.green", "#4CAF50"),
    entry("color.blue", "#2196F3"),
    entry("color.orange", "#FF9800"),
    entry("color.yellow", "#FFEB3B"),
    entry("color.purple", "#9C27B0"),
    entry("color.maroon", "#880E4F"),
    entry("color.lime", "#00E676"),
    entry("color.navy", "#311B92"),
    entry("color.teal", "#00897B"),
    entry("color.aqua", "#00BCD4"),
    entry("color.fuchsia", "#E040FB"),
    entry("color.olive", "#808000"),
    entry("color.gray", "#787B86"),
    entry("color.silver", "#B2B5BE"),
    entry("color.white", "#FFFFFF"),
    entry("color.black", "#000000"),
]);

/**
 * Resolve a Pine enum value against {@link ENUM_VALUE_MAP}. Returns
 * `null` for unknown values and for entries with no chartlang analogue
 * (`text.format_bold`, `xloc.*`, …).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { enumLookup } from "@invinite-org/chartlang-pine-converter";
 *     const m = enumLookup("line.style_dashed");
 *     void m?.chartlang; // "dashed"
 */
export const enumLookup = (key: string): EnumMapping | null => lookup(ENUM_VALUE_MAP, key);

/**
 * Pine `display.*` member → the per-plot visibility toggle the converter
 * understands. Only `display.all` / `display.none` have a chartlang analogue
 * (the `plot(value, { visible })` channel): `"all"` means "shown" and `"none"`
 * means "hidden". Every other `display.*` target (`status_line`, `price_scale`,
 * `pane`, `data_window`, or a bitmask combination) is a REJECT row — it has no
 * chartlang analogue, so the transform leaves the plot visible and raises
 * `plot-display-approximated`. Kept separate from {@link ENUM_VALUE_MAP} because
 * the values are visibility verdicts, not style literals.
 *
 * @since 1.5
 * @experimental
 * @example
 *     import { DISPLAY_MAP } from "@invinite-org/chartlang-pine-converter";
 *     DISPLAY_MAP.get("display.none")?.chartlang; // "none"
 */
export const DISPLAY_MAP: ReadonlyMap<string, EnumMapping> = new Map<string, EnumMapping>([
    // docs: https://www.tradingview.com/pine-script-reference/v6/#var_display.all
    entry("display.all", "all"),
    entry("display.none", "none"),
    entry("display.data_window", null, "no chartlang analogue beyond all/none; left visible"),
    entry("display.price_scale", null, "no chartlang analogue beyond all/none; left visible"),
    entry("display.status_line", null, "no chartlang analogue beyond all/none; left visible"),
    entry("display.pane", null, "no chartlang analogue beyond all/none; left visible"),
]);

/**
 * Resolve a Pine `display.*` member against {@link DISPLAY_MAP}. Returns the
 * `display.all` / `display.none` entry (the only toggle-mappable members) and
 * `null` for every unsupported `display.*` target or unknown member.
 *
 * @since 1.5
 * @experimental
 * @example
 *     import { displayLookup } from "@invinite-org/chartlang-pine-converter";
 *     displayLookup("display.all")?.chartlang; // "all"
 */
export const displayLookup = (key: string): EnumMapping | null => lookup(DISPLAY_MAP, key);
