// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Diagnostic, DiagnosticSeverity, SourceSpan } from "../index.js";

/**
 * A single entry in the converter's diagnostic-code registry: the stable
 * `code`, its default `severity`, the advisory `defaultMessage`, and an
 * optional `defaultSuggestion` describing the manual rewrite.
 *
 * @since 0.1
 * @stable
 * @example
 *     const entry: DiagnosticCodeEntry = {
 *         code: "pine-converter/parse/unexpected-token",
 *         severity: "error",
 *         defaultMessage: "Unexpected token.",
 *     };
 *     void entry;
 */
export type DiagnosticCodeEntry = Readonly<{
    code: string;
    severity: DiagnosticSeverity;
    defaultMessage: string;
    defaultSuggestion?: string;
}>;

/**
 * Single-source registry of every converter diagnostic, keyed by its short
 * registry KEY (the kebab-case slug). Every entry's `code` is namespaced by
 * stage (`pine-converter/parse/...`, `pine-converter/semantic/...`,
 * `pine-converter/transform/...`, `pine-converter/codegen/...`) so it never
 * collides with a lexer code (`pine-converter/lex/...`). Add a code here,
 * never inline a literal at the call site. This object drives
 * {@link ParserDiagnosticCode}, {@link makeDiagnostic}, and the by-full-code
 * {@link DIAGNOSTIC_CODES} map — the code STRINGS are the converter's stable
 * public contract and never change.
 *
 * @since 0.1
 * @stable
 * @example
 *     DIAGNOSTIC_CODE_ENTRIES["unsupported-strategy"].severity; // "error"
 */
export const DIAGNOSTIC_CODE_ENTRIES = {
    "unsupported-pine-version": {
        code: "pine-converter/parse/unsupported-pine-version",
        severity: "error",
        defaultMessage: "Only Pine Script v6 is supported.",
        defaultSuggestion: "Change the directive to `//@version=6`.",
    },
    "missing-version-directive": {
        code: "pine-converter/parse/missing-version-directive",
        severity: "error",
        defaultMessage: "Script must start with a `//@version=6` directive.",
        defaultSuggestion: "Add `//@version=6` as the first line.",
    },
    "unsupported-strategy": {
        code: "pine-converter/parse/unsupported-strategy",
        severity: "error",
        defaultMessage: "`strategy(...)` declarations are not supported.",
        defaultSuggestion:
            "Strip the backtester and convert the signal logic as an `indicator(...)`.",
    },
    "unsupported-library": {
        code: "pine-converter/parse/unsupported-library",
        severity: "error",
        defaultMessage: "`library(...)` declarations are not supported.",
        defaultSuggestion: "Inline the exported functions into an `indicator(...)` script.",
    },
    "unsupported-for-in": {
        code: "pine-converter/parse/unsupported-for-in",
        severity: "error",
        defaultMessage: "`for ... in` loops are not supported.",
        defaultSuggestion: "Rewrite as a literal-bounded `for i = a to b` loop.",
    },
    "unsupported-while": {
        code: "pine-converter/parse/unsupported-while",
        severity: "error",
        defaultMessage: "`while` loops are not supported.",
        defaultSuggestion: "Rewrite as a literal-bounded `for i = a to b` loop.",
    },
    "expected-token": {
        code: "pine-converter/parse/expected-token",
        severity: "error",
        defaultMessage: "Expected a different token here.",
    },
    "unexpected-token": {
        code: "pine-converter/parse/unexpected-token",
        severity: "error",
        defaultMessage: "Unexpected token.",
    },
    "unsupported-udt": {
        code: "pine-converter/parse/unsupported-udt",
        severity: "error",
        defaultMessage: "User-defined `type` declarations are not supported.",
        defaultSuggestion: "Replace the UDT with plain variables or arrays of primitives.",
    },
    "unsupported-method": {
        code: "pine-converter/parse/unsupported-method",
        severity: "error",
        defaultMessage: "`method` declarations are not supported.",
        defaultSuggestion: "Rewrite the method as a free function call.",
    },
    "unsupported-library-import": {
        code: "pine-converter/parse/unsupported-library-import",
        severity: "error",
        defaultMessage: "`import` of a Pine library is not supported.",
        defaultSuggestion: "Inline the imported library's logic into this script.",
    },
    "mixed-named-positional-args": {
        code: "pine-converter/parse/mixed-named-positional-args",
        severity: "error",
        defaultMessage: "A positional argument cannot follow a named argument.",
        defaultSuggestion: "Move all positional arguments before the named ones.",
    },
    "chained-ternary-warning": {
        code: "pine-converter/parse/chained-ternary-warning",
        severity: "info",
        defaultMessage: "Chained ternary; chartlang codegen prefers an if/else.",
        defaultSuggestion: "Consider rewriting `a ? b : c ? d : e` as nested if/else.",
    },
    "accidental-shadowing": {
        code: "pine-converter/semantic/accidental-shadowing",
        severity: "warning",
        defaultMessage: "Assignment with `=` re-declares a variable from an enclosing scope.",
        defaultSuggestion:
            "Use `:=` to reassign the existing variable, or rename to declare a new one.",
    },
    "history-on-non-series": {
        code: "pine-converter/semantic/history-on-non-series",
        severity: "warning",
        defaultMessage: "History access `[n]` applied to a non-series value.",
        defaultSuggestion: "History can only be taken on a series; check the operand's type.",
    },
    "unknown-identifier": {
        code: "pine-converter/semantic/unknown-identifier",
        severity: "error",
        defaultMessage: "Reference to an undeclared identifier.",
        defaultSuggestion: "Declare the variable, or check for a typo in a built-in name.",
    },
    "dynamic-handle-collection": {
        code: "pine-converter/semantic/dynamic-handle-collection",
        severity: "info",
        defaultMessage:
            "Bounded drawing collection with no explicit eviction; relying on the indicator cap.",
        defaultSuggestion: "Add a `max_*_count` argument or an explicit ring-buffer eviction.",
    },
    "unbounded-handle-collection": {
        code: "pine-converter/semantic/unbounded-handle-collection",
        severity: "error",
        defaultMessage: "Drawing collection has no detectable cap; no faithful chartlang analogue.",
        defaultSuggestion:
            "Cap the collection with a `max_*_count` argument or a ring-buffer eviction.",
    },
    "unsupported-tuple-destructuring": {
        code: "pine-converter/semantic/unsupported-tuple-destructuring",
        severity: "info",
        defaultMessage: "Tuple destructuring is outside the v1 drawing scope.",
        defaultSuggestion: "Assign each returned value to its own variable.",
    },
    "requires-bar-interval": {
        code: "pine-converter/transform/requires-bar-interval",
        severity: "error",
        defaultMessage:
            "Future `bar_index + N` anchor needs a bar interval, but `barInterval` is null.",
        defaultSuggestion: "Pass `barInterval` (ms per bar) in the converter options.",
    },
    "dynamic-bar-index": {
        code: "pine-converter/transform/dynamic-bar-index",
        severity: "warning",
        defaultMessage:
            "Non-literal arithmetic on `bar_index`; the offset direction is a best-effort guess.",
        defaultSuggestion:
            "Use a literal offset (`bar_index + 10`) so the anchor resolves deterministically.",
    },
    "unresolved-bar-index": {
        code: "pine-converter/transform/unresolved-bar-index",
        severity: "warning",
        defaultMessage:
            "Coordinate argument is not a recognised `bar_index` pattern; using offset 0.",
        defaultSuggestion: "Anchor on `bar_index`, `bar_index[N]`, or `bar_index + N`.",
    },
    "chart-point-from-index-without-xloc": {
        code: "pine-converter/transform/chart-point-from-index-without-xloc",
        severity: "warning",
        defaultMessage:
            "`chart.point.from_index` used on a drawing whose `xloc` is `bar_time`; treated as `bar_index`.",
        defaultSuggestion: "Use `chart.point.from_time` for `xloc.bar_time` drawings.",
    },
    "indicator-arg-not-mapped": {
        code: "pine-converter/transform/indicator-arg-not-mapped",
        severity: "warning",
        defaultMessage: "This `indicator(...)` argument has no chartlang analogue and was dropped.",
        defaultSuggestion: "Remove the argument or replicate its effect in the chartlang adapter.",
    },
    "drawing-only-script": {
        code: "pine-converter/transform/drawing-only-script",
        severity: "info",
        defaultMessage:
            "Script emits only drawings; converted as a `defineDrawing` (plot capability dropped).",
        defaultSuggestion:
            "Add a `plot(...)` call if the script should remain a `defineIndicator`.",
    },
    "strategy-as-indicator": {
        code: "pine-converter/transform/strategy-as-indicator",
        severity: "info",
        defaultMessage:
            "`strategy(...)` was stripped to a `defineIndicator`; backtester args were dropped.",
        defaultSuggestion:
            "Re-create order logic as `alert(...)` emissions in the converted script.",
    },
    "computed-indicator-title": {
        code: "pine-converter/transform/computed-indicator-title",
        severity: "error",
        defaultMessage:
            "The indicator title is computed; chartlang requires a string-literal `name`.",
        defaultSuggestion: "Replace the computed title with a string literal.",
    },
    "max-count-out-of-range": {
        code: "pine-converter/transform/max-count-out-of-range",
        severity: "warning",
        defaultMessage:
            "A `max_*_count` value exceeds the chartlang bucket cap; clamped to the cap.",
        defaultSuggestion: "Lower the `max_*_count` value to within the chartlang bucket limit.",
    },
    "input-enum-rejected": {
        code: "pine-converter/transform/input-enum-rejected",
        severity: "error",
        defaultMessage: "`input.enum(...)` is not supported; Pine enums are UDT-backed in v6.",
        defaultSuggestion: "Replace the enum input with an `input.string(...)` of allowed values.",
    },
    "unknown-input-primitive": {
        code: "pine-converter/transform/unknown-input-primitive",
        severity: "warning",
        defaultMessage: "Unrecognised `input.*` primitive; no chartlang analogue, input dropped.",
        defaultSuggestion: "Use one of the supported `input.*` primitives.",
    },
    "non-literal-source-input": {
        code: "pine-converter/transform/non-literal-source-input",
        severity: "error",
        defaultMessage:
            "`input.source(...)` default must be an OHLCV built-in; a computed source is not supported.",
        defaultSuggestion: "Pass `close`, `open`, `high`, `low`, `volume`, `hl2`, `hlc3`, etc.",
    },
    "non-literal-input-default": {
        code: "pine-converter/transform/non-literal-input-default",
        severity: "error",
        defaultMessage: "`input.*` default value must be a compile-time literal.",
        defaultSuggestion: "Replace the computed default with a literal value.",
    },
    "input-arg-not-mapped": {
        code: "pine-converter/transform/input-arg-not-mapped",
        severity: "warning",
        defaultMessage: "This `input.*` argument has no chartlang analogue and was dropped.",
        defaultSuggestion: "Remove the argument; chartlang inputs do not model it.",
    },
    "inline-input-promoted": {
        code: "pine-converter/transform/inline-input-promoted",
        severity: "info",
        defaultMessage: "An inline `input.*` call was promoted to a named top-level input.",
        defaultSuggestion: "Name the input explicitly (`len = input.int(20)`) to control its key.",
    },
    "yloc-padding-approximated": {
        code: "pine-converter/transform/yloc-padding-approximated",
        severity: "info",
        defaultMessage:
            "`yloc.abovebar`/`yloc.belowbar` was approximated as a fixed fraction of the bar range.",
        defaultSuggestion:
            "Tune the `0.001` bar-range padding fraction in the generated anchor if the default offset is too tight.",
    },
    "varip-approximated": {
        code: "pine-converter/transform/varip-approximated",
        severity: "info",
        defaultMessage:
            "`varip` drawing-handle persistence has no exact chartlang analogue; intra-bar rollback is not reproduced.",
        defaultSuggestion: "Confirm the handle does not rely on Pine's tick-rollback semantics.",
    },
    "cross-mount-state-not-preserved": {
        code: "pine-converter/transform/cross-mount-state-not-preserved",
        severity: "info",
        defaultMessage:
            "A `var` handle with a non-`na` initial value is reset to its creation branch on a cold mount.",
        defaultSuggestion:
            "Re-create the handle inside a `barstate.isfirst` guard if cold-restart parity matters.",
    },
    "label-style-not-mapped": {
        code: "pine-converter/transform/label-style-not-mapped",
        severity: "warning",
        defaultMessage: "This `label.style_*` value has no chartlang analogue and was dropped.",
        defaultSuggestion: "Use a `label.style_*` value with a chartlang `draw.*` mapping.",
    },
    "setter-fold-cross-branch": {
        code: "pine-converter/transform/setter-fold-cross-branch",
        severity: "info",
        defaultMessage:
            "A drawing handle is mutated across multiple branches; one `update({...})` is emitted per branch.",
        defaultSuggestion: "No action needed; the per-branch folding preserves the Pine behaviour.",
    },
    "set-path-unsupported": {
        code: "pine-converter/transform/set-path-unsupported",
        severity: "info",
        defaultMessage:
            "A single-coordinate setter (`set_x1`/`set_y1`/…) cannot be folded into the tuple patch and was dropped.",
        defaultSuggestion:
            "Use the whole-anchor setter (`set_xy1`/`set_xy2`) so both coordinates fold together.",
    },
    "ring-eviction-implicit": {
        code: "pine-converter/transform/ring-eviction-implicit",
        severity: "info",
        defaultMessage:
            "The explicit `array.shift`/`*.delete` FIFO eviction was removed; the ring buffer evicts implicitly.",
        defaultSuggestion: "No action needed; the ring's modulo-K write reproduces the eviction.",
    },
    "cap-mismatch": {
        code: "pine-converter/transform/cap-mismatch",
        severity: "info",
        defaultMessage:
            "The Pine cap exceeds the chartlang bucket cap; the ring capacity was clamped to the bucket limit.",
        defaultSuggestion: "Lower the Pine eviction cap to within the chartlang bucket limit.",
    },
    "anchor-mirror-required": {
        code: "pine-converter/transform/anchor-mirror-required",
        severity: "warning",
        defaultMessage:
            "A ring-update loop references a handle's prior anchor, which the ring does not store; a TODO was left.",
        defaultSuggestion:
            "Recompute the anchor from the original creation expression, or mirror it in a state slot.",
    },
    "ring-buffer-zero-cap": {
        code: "pine-converter/transform/ring-buffer-zero-cap",
        severity: "error",
        defaultMessage:
            "The ring-buffer capacity resolved to zero or negative; the site was skipped.",
        defaultSuggestion: "Give the collection a positive `max_*_count` / eviction cap.",
    },
    "negative-array-index": {
        code: "pine-converter/transform/negative-array-index",
        severity: "error",
        defaultMessage: "Negative array indices are not supported on a chartlang ring buffer.",
        defaultSuggestion:
            "Use `array.last(...)` for the newest element instead of `array.get(.., -1)`.",
    },
    "linefill-over-ring": {
        code: "pine-converter/transform/linefill-over-ring",
        severity: "error",
        defaultMessage:
            "`linefill.new` over ring-buffer elements has no chartlang analogue (Camp C territory).",
        defaultSuggestion: "Draw the fill as an explicit `draw.rectangle`/`draw.frame` instead.",
    },
    "camp-c-heuristic-applied": {
        code: "pine-converter/transform/camp-c-heuristic-applied",
        severity: "info",
        defaultMessage:
            "A dynamic drawing collection was folded into a bounded ring by a Camp C heuristic.",
        defaultSuggestion:
            "Confirm the inferred cap matches Pine's runtime eviction; add an explicit `max_*_count` to be sure.",
    },
    "dynamic-handle-index": {
        code: "pine-converter/transform/dynamic-handle-index",
        severity: "error",
        defaultMessage:
            "`array.get(arr, expr)` with a non-literal-bounded index has no faithful ring analogue.",
        defaultSuggestion:
            "Replace dynamic indexing with a `for i = 0 to K - 1` loop where K is a literal.",
    },
    "cross-collection-linefill": {
        code: "pine-converter/transform/cross-collection-linefill",
        severity: "error",
        defaultMessage: "`linefill.new` across two collections has no chartlang analogue.",
        defaultSuggestion: "Use a single `draw.path(...)` over the pair of anchor points instead.",
    },
    "polyline-dynamic-points": {
        code: "pine-converter/transform/polyline-dynamic-points",
        severity: "error",
        defaultMessage:
            "`polyline.new` over a dynamically-sized anchor array has no chartlang analogue.",
        defaultSuggestion:
            "Build the anchor list in a literal-bounded `for (let i = 0; i < K; i++)` loop.",
    },
    "handle-copy": {
        code: "pine-converter/transform/handle-copy",
        severity: "error",
        defaultMessage:
            "Drawing `*.copy(handle)` has no chartlang analogue (handles aren't first-class values).",
        defaultSuggestion: "Re-create the drawing at the new location instead of copying it.",
    },
    "handle-store-in-udt": {
        code: "pine-converter/transform/handle-store-in-udt",
        severity: "error",
        defaultMessage: "A drawing handle stored in a user-defined type is not supported in v1.",
        defaultSuggestion:
            "Hoist the handle into a `var line/label/box` declaration at the script top level.",
    },
    "for-in-line-all": {
        code: "pine-converter/transform/for-in-line-all",
        severity: "error",
        defaultMessage:
            "Bulk iteration over `line.all`/`box.all`/`label.all` (or `for ... in array`) is not supported.",
        defaultSuggestion: "Track the handles explicitly in a `var array<line>` (Camp B).",
    },
    "table-multi-init": {
        code: "pine-converter/transform/table-multi-init",
        severity: "warning",
        defaultMessage:
            "A `table` variable is initialised by more than one `table.new(...)`; the first wins.",
        defaultSuggestion: "Create the table once; mutate its cells rather than re-creating it.",
    },
    "table-cell-out-of-bounds": {
        code: "pine-converter/transform/table-cell-out-of-bounds",
        severity: "error",
        defaultMessage:
            "A `table.cell(...)` write addresses a cell outside the declared `(columns, rows)` grid.",
        defaultSuggestion:
            "Raise the `table.new(position, columns, rows)` counts or fix the index.",
    },
    "table-dynamic-loop": {
        code: "pine-converter/transform/table-dynamic-loop",
        severity: "error",
        defaultMessage:
            "A loop that writes table cells has a non-literal bound; chartlang requires a literal-bounded unroll.",
        defaultSuggestion:
            "Use a literal `for i = 0 to N` bound so the cell writes can be unrolled.",
    },
    "table-merge-fallback": {
        code: "pine-converter/transform/table-merge-fallback",
        severity: "warning",
        defaultMessage:
            "`table.merge_cells(...)` has no chartlang analogue; the merged span keeps the top-left cell and blanks the rest.",
        defaultSuggestion:
            "Lay the data out in unmerged cells, or accept the top-left-only fallback.",
    },
    "table-clear-noop": {
        code: "pine-converter/transform/table-clear-noop",
        severity: "info",
        defaultMessage:
            "`table.clear(...)` is a no-op; the converted table is rebuilt from scratch each `barstate.islast` tick.",
        defaultSuggestion: "No action needed; the rebuild already starts from an empty grid.",
    },
    "table-bucket-cap-adjusted": {
        code: "pine-converter/transform/table-bucket-cap-adjusted",
        severity: "info",
        defaultMessage: "The `other` drawing-bucket cap was raised to fit the converted tables.",
        defaultSuggestion: "No action needed; the cap was widened to match the table count.",
    },
    "table-formatting-not-mapped": {
        code: "pine-converter/transform/table-formatting-not-mapped",
        severity: "warning",
        defaultMessage:
            "Pine's `text_formatting`/`text_font_family`/`text_wrap` cell options have no chartlang analogue and were dropped.",
        defaultSuggestion: "chartlang `TableCell` models text, colors, alignment, and size only.",
    },
    "polyline-curved-anchors-warning": {
        code: "pine-converter/transform/polyline-curved-anchors-warning",
        severity: "warning",
        defaultMessage:
            "`polyline.new(curved=true)` with more than 3 anchors maps to a straight `draw.polyline`; chartlang's smooth `draw.curve` takes exactly 3 anchors.",
        defaultSuggestion:
            "Split the curve into 3-anchor segments, or accept the straight polyline.",
    },
    "polyline-closed-info": {
        code: "pine-converter/transform/polyline-closed-info",
        severity: "info",
        defaultMessage: "`polyline.new(closed=true)` maps to `draw.path(..., { closed: true })`.",
        defaultSuggestion: "No action needed; the path closes the anchor loop.",
    },
    "linefill-series-fill": {
        code: "pine-converter/transform/linefill-series-fill",
        severity: "info",
        defaultMessage:
            "A `linefill` between two bar-by-bar updated lines lowers to a single `draw.fillBetween` band that tracks the two lines' latest anchors each bar.",
        defaultSuggestion: "No action needed; the band re-anchors to both lines every bar.",
    },
    "linefill-color-transp-approximated": {
        code: "pine-converter/transform/linefill-color-transp-approximated",
        severity: "info",
        defaultMessage:
            "`color.new(color, transp)` was folded to a `#RRGGBBAA` hex with the transparency converted to an alpha channel.",
        defaultSuggestion: "No action needed; the alpha hex preserves the Pine transparency.",
    },
    "ta-signature-divergence": {
        code: "pine-converter/transform/ta-signature-divergence",
        severity: "warning",
        defaultMessage:
            "This `ta.*` call maps to a chartlang member whose signature differs; the arguments were passed through as-is.",
        defaultSuggestion: "Check the chartlang `ta.*` signature and adjust the arguments by hand.",
    },
    "ta-not-mapped": {
        code: "pine-converter/transform/ta-not-mapped",
        severity: "warning",
        defaultMessage:
            "This `ta.*` member has no chartlang analogue; the call was passed through unchanged.",
        defaultSuggestion:
            "Replace the call with a supported `ta.*` member or an inline computation.",
    },
    "math-not-mapped": {
        code: "pine-converter/transform/math-not-mapped",
        severity: "warning",
        defaultMessage:
            "This `math.*` member has no chartlang analogue (or is rejected); the call was passed through unchanged.",
        defaultSuggestion: "Replace the call with a supported `math.*`/`Math.*` member.",
    },
    "str-format-not-mapped": {
        code: "pine-converter/transform/str-format-not-mapped",
        severity: "warning",
        defaultMessage:
            "This `str.format`/`str.tostring` format string could not be lowered; the call was passed through unchanged.",
        defaultSuggestion: 'Use a simple "#.##" precision format, or format the value by hand.',
    },
    "str-not-mapped": {
        code: "pine-converter/transform/str-not-mapped",
        severity: "warning",
        defaultMessage:
            "This `str.*` member has no chartlang analogue; the call was passed through unchanged.",
        defaultSuggestion:
            "Use one of the supported `str.*` members or a plain JavaScript string op.",
    },
    "fill-not-mapped": {
        code: "pine-converter/transform/fill-not-mapped",
        severity: "error",
        defaultMessage:
            "This `fill(...)` form has no chartlang analogue: only `fill(hline, hline)` / `fill(plot, plot)` bands lower to `draw.fillBetween`; gradient (`top_color`/`bottom_color`/`top_value`/`bottom_value`) and `fillgaps` fills are deferred.",
        defaultSuggestion:
            "Drop the gradient / `fillgaps` styling, or draw the band as an explicit `draw.rectangle`/`draw.path` instead.",
    },
    "plot-offset-needs-ta-call": {
        code: "pine-converter/transform/plot-offset-needs-ta-call",
        severity: "warning",
        defaultMessage:
            "Pine plot `offset=` only maps when the plotted value is a direct `ta.*` call; chartlang's offset lives on the `ta.*` opts. Offset dropped.",
        defaultSuggestion:
            "Wrap the value in a `ta.*` primitive (e.g. `ta.sma(value, 1)`), or set the offset on the indicator's `ta.*` call.",
    },
    "plot-offset-overrides-ta-offset": {
        code: "pine-converter/transform/plot-offset-overrides-ta-offset",
        severity: "warning",
        defaultMessage:
            "The Pine plot-level `offset=` replaced the `offset` already set on the plotted `ta.*` call; the plot-level offset is the source of truth.",
        defaultSuggestion:
            "Remove the `offset` argument on the `ta.*` call, or drop the plot-level `offset=` so the two no longer conflict.",
    },
    "request-security-different-symbol": {
        code: "pine-converter/transform/request-security-different-symbol",
        severity: "info",
        defaultMessage:
            "`request.security` on a different symbol was mapped to chartlang multi-symbol (`{ symbol, interval }`); the adapter must advertise the `multiSymbol` capability or the series degrades to NaN.",
        defaultSuggestion:
            "Confirm your adapter supports `multiSymbol`; otherwise drop the cross-symbol read or request the chart's own symbol.",
    },
    "request-security-lookahead-not-supported": {
        code: "pine-converter/transform/request-security-lookahead-not-supported",
        severity: "warning",
        defaultMessage:
            "The `lookahead` parameter on `request.security` has no chartlang analogue and was dropped.",
        defaultSuggestion:
            "Remove the `lookahead` argument; chartlang MTF reads are non-repainting.",
    },
    "request-security-not-mapped": {
        code: "pine-converter/transform/request-security-not-mapped",
        severity: "error",
        defaultMessage:
            "This `request.security(...)` shape is outside the v1 single-symbol intraday MTF subset.",
        defaultSuggestion:
            'Use `request.security(syminfo.tickerid, "<timeframe>", <ohlcv>)` with a string-literal timeframe.',
    },
    "strategy-signal-only": {
        code: "pine-converter/transform/strategy-signal-only",
        severity: "info",
        defaultMessage:
            "A `strategy.*` order call was lowered to an `alert(...)`; order sizing/fills are not reproduced.",
        defaultSuggestion:
            "Wire the alert into your own execution layer if you need order semantics.",
    },
    "dynamic-series-index": {
        code: "pine-converter/transform/dynamic-series-index",
        severity: "error",
        defaultMessage:
            "Series history `x[n]` with a non-literal `n` is not supported in chartlang.",
        defaultSuggestion:
            "Use a literal offset, or read the value through a `ta.*` window primitive.",
    },
    "loop-bounds-not-literal-for-stateful-body": {
        code: "pine-converter/transform/loop-bounds-not-literal-for-stateful-body",
        severity: "error",
        defaultMessage:
            "A `for` loop whose body calls a stateful primitive (`plot`/`hline`/`alert`/`ta.*`/`draw.*`) needs compile-time-resolvable bounds so it can be unrolled.",
        defaultSuggestion:
            "Lift the stateful call out of the loop, or use a literal `for i = 0 to N` bound.",
    },
    "loop-body-unrolled": {
        code: "pine-converter/transform/loop-body-unrolled",
        severity: "info",
        defaultMessage:
            "A `for` loop with a stateful body was unrolled at convert time into one statement per iteration.",
        defaultSuggestion:
            "No action needed; the unrolled copies reproduce the per-iteration call sites.",
    },
    "mtf-series-to-scalar-conversion": {
        code: "pine-converter/transform/mtf-series-to-scalar-conversion",
        severity: "info",
        defaultMessage:
            "`request.security(...)` returns a series; `.current` was inserted where a scalar value is expected.",
        defaultSuggestion: "No action needed; `.current` reads the latest secondary-stream value.",
    },
    "loop-unroll-frozen-at-input-default": {
        code: "pine-converter/transform/loop-unroll-frozen-at-input-default",
        severity: "info",
        defaultMessage:
            "A `for` loop bound came from an `input.int` default; the unrolled iteration count is frozen at that default and will not follow the input at runtime.",
        defaultSuggestion:
            "Use a literal bound if the iteration count must stay fixed, or accept the frozen default.",
    },
    "scalar-state-type-defaulted": {
        code: "pine-converter/transform/scalar-state-type-defaulted",
        severity: "info",
        defaultMessage:
            "A `var`/`varip` scalar's type could not be inferred from its initializer; it was defaulted to `state.float`.",
        defaultSuggestion: "Give the variable a literal initial value so its type can be inferred.",
    },
    "partial-anchor-filled": {
        code: "pine-converter/transform/partial-anchor-filled",
        severity: "info",
        defaultMessage:
            "A whole-anchor setter moved only one endpoint; the unset anchor was filled from the creation expression so the patch is a complete tuple. The filled endpoint re-evaluates each bar instead of staying frozen.",
        defaultSuggestion:
            "Set both `set_xy1` and `set_xy2`, or mirror the fixed endpoint in a state slot if it must stay put.",
    },
    "multi-return-not-mapped": {
        code: "pine-converter/transform/multi-return-not-mapped",
        severity: "warning",
        defaultMessage:
            "A tuple destructuring `[a, b] = …` reads from a call that is not a recognised multi-output `ta.*`; the elements were left unresolved.",
        defaultSuggestion:
            "Destructure a supported multi-output (`ta.macd`/`ta.bb`/`ta.kc`/`ta.dmi`/`ta.supertrend`), or assign each output to its own variable.",
    },
    "multi-return-arity-mismatch": {
        code: "pine-converter/transform/multi-return-arity-mismatch",
        severity: "warning",
        defaultMessage:
            "A tuple destructuring binds more outputs than the chartlang result exposes (e.g. `ta.dmi`'s ADX); the extra names were left unresolved.",
        defaultSuggestion:
            "Drop the unsupported output, or read it from its dedicated primitive (e.g. ADX via `ta.adx`).",
    },
    "multi-return-arg-dropped": {
        code: "pine-converter/transform/multi-return-arg-dropped",
        severity: "info",
        defaultMessage:
            "A Pine argument has no chartlang equivalent on the multi-output primitive and was dropped (e.g. `ta.kc`'s explicit source / `useTrueRange`).",
        defaultSuggestion:
            "No action needed if the default matches your script; otherwise adjust the chartlang call by hand.",
    },
    "series-history-non-numeric": {
        code: "pine-converter/transform/series-history-non-numeric",
        severity: "info",
        defaultMessage:
            "History indexing on a `color` `var` is not supported in chartlang v1 (`bool`/`string` history lowers to a persistent series; `color` history does not).",
        defaultSuggestion:
            "Track the color history yourself, or store a numeric/boolean discriminator and index that instead.",
    },
    "varip-series-approximated": {
        code: "pine-converter/transform/varip-series-approximated",
        severity: "info",
        defaultMessage:
            "A history-indexed `varip` scalar lowers to a (non-tick) `state.series`; intra-bar tick-rollback of the history is not reproduced.",
        defaultSuggestion:
            "Confirm the series history does not rely on Pine's `varip` tick-rollback semantics.",
    },
    "explicit-plot-zorder-default": {
        code: "pine-converter/transform/explicit-plot-zorder-default",
        severity: "info",
        defaultMessage:
            "Pine `explicit_plot_zorder` is the default in chartlang (marks layer by declaration order within their group); no flag is needed and none is emitted.",
        defaultSuggestion:
            "Remove the argument; chartlang always orders marks by declaration order, so the flag is a no-op either way.",
    },
    "array-collection-non-numeric": {
        code: "pine-converter/transform/array-collection-non-numeric",
        severity: "info",
        defaultMessage:
            "Persistent non-numeric collections are not supported in chartlang v1 (only numeric `state.array`).",
        defaultSuggestion:
            "Hold numeric values in the array, or track the non-numeric data with scalar `state.*` slots.",
    },
    "unbounded-array-collection": {
        code: "pine-converter/transform/unbounded-array-collection",
        severity: "error",
        defaultMessage:
            "A persistent numeric array with no detectable capacity cannot be bounded; chartlang has no unbounded collection.",
        defaultSuggestion:
            "Add a FIFO eviction guard (`if array.size(coll) > K` → `array.shift(coll)`) or size the array via `array.new<float>(K)` so the capacity is a literal.",
    },
    "array-reduction-not-mapped": {
        code: "pine-converter/transform/array-reduction-not-mapped",
        severity: "warning",
        defaultMessage:
            "This `array.*` reduction has no chartlang analogue (nearest-rank percentile is deferred; only linear interpolation ships in v1), so it was left as a `Number.NaN` placeholder.",
        defaultSuggestion:
            "Use `array.percentile_linear_interpolation(...)` (→ `array.percentile`), or maintain the reduction yourself over the `state.array<number>` window.",
    },
    "array-sort-returns-copy": {
        code: "pine-converter/transform/array-sort-returns-copy",
        severity: "info",
        defaultMessage:
            "Pine `array.sort` sorts the array in place; chartlang `array.sort` / `<slot>.sort` returns a fresh sorted COPY and never mutates the ring, so reads of the original window after the sort are unchanged.",
        defaultSuggestion:
            'Capture the sorted copy (`const sorted = win.sort("desc")`) and read from it, instead of re-reading the original array.',
    },
    "time-builtin-not-mapped": {
        code: "pine-converter/transform/time-builtin-not-mapped",
        severity: "warning",
        defaultMessage:
            "This calendar built-in call shape is not mapped (only `time()`, `time_close()`, and `dayofweek(t[, tz])` lower in v1).",
        defaultSuggestion:
            'Use the bare epoch (`bar.time`) with the `time.*` / `session.*` accessors — e.g. `session.isOpen(bar.time, "0930-1600")` instead of the `time(timeframe, session)` form.',
    },
    "math-rolling-window-unmapped": {
        code: "pine-converter/transform/math-rolling-window-unmapped",
        severity: "warning",
        defaultMessage:
            "Pine `math.sum`/`math.avg(source, length)` is a rolling-window reduction; chartlang's scalar `math.sum`/`math.avg` is variadic-scalar, not rolling, and there is no `ta` rolling-sum analogue (`ta.cum` is unmapped), so the call was passed through unchanged.",
        defaultSuggestion:
            "Maintain the window yourself with a `state.array<number>(length)` (push the source each bar, sum/average the elements), or use a `ta.*` moving average where one fits.",
    },
    "nz-scalar-assumed": {
        code: "pine-converter/transform/nz-scalar-assumed",
        severity: "info",
        defaultMessage:
            "Pine `nz(...)` was lowered to the scalar `math.nz(...)`. chartlang separates scalar NaN-coalescing (`math.nz`) from the series form (`ta.nz`); the scalar form was assumed.",
        defaultSuggestion:
            "If the argument is a series whose history you coalesce, switch the emitted `math.nz(...)` to `ta.nz(...)` by hand.",
    },
    "map-capacity-synthesized": {
        code: "pine-converter/transform/map-capacity-synthesized",
        severity: "info",
        defaultMessage:
            "Pine `map.new<K, V>()` is unbounded, but chartlang `state.map<K, V>(capacity)` requires a compile-time literal capacity (so the keyed store is bounded and snapshot-clean), so a default bound of 1000 was synthesized.",
        defaultSuggestion:
            "Set a real bound on the emitted `state.map<number, number>(1000)` based on how many distinct keys the map can hold (a new key over capacity evicts the oldest-inserted one).",
    },
    "map-collection-non-numeric": {
        code: "pine-converter/transform/map-collection-non-numeric",
        severity: "info",
        defaultMessage:
            "This `map.new(...)` has a non-numeric value type (`map<K, bool|string|color>`); chartlang `state.map`'s v1 value type is `number`, so the map was left as-is rather than lowered to a `state.map` slot.",
        defaultSuggestion:
            "Restructure the map to a numeric `value` type, or maintain the keyed string/bool state yourself outside a `state.map`.",
    },
    "map-builtin-not-mapped": {
        code: "pine-converter/transform/map-builtin-not-mapped",
        severity: "warning",
        defaultMessage:
            "This `map.*` member has no chartlang analogue over a `state.map` slot (key/value iteration — `map.keys`/`map.values` — is unsupported in v1; chartlang exposes `keyAt(i)` + `size` bounded indexing, not iterators), so it was left as a `Number.NaN` placeholder.",
        defaultSuggestion:
            "Walk the map with a literal-bounded `for (let i = 0; i < <slot>.size; i++)` over `<slot>.keyAt(i)` instead of `map.keys`/`map.values`.",
    },
    "codegen-output-invalid": {
        code: "pine-converter/codegen/codegen-output-invalid",
        severity: "error",
        defaultMessage:
            "The converted chartlang source failed to compile through `@invinite-org/chartlang-compiler`.",
        defaultSuggestion:
            "Open the emitted `.chart.ts`, address the compiler diagnostics, or file a converter bug with the source.",
    },
    "break-continue-outside-loop": {
        code: "pine-converter/transform/break-continue-outside-loop",
        severity: "error",
        defaultMessage:
            "A `break`/`continue` appears outside any `for` loop; it has no loop to control and was dropped.",
        defaultSuggestion: "Move the `break`/`continue` inside a `for` loop, or remove it.",
    },
    "stateful-loop-with-break": {
        code: "pine-converter/transform/stateful-loop-with-break",
        severity: "error",
        defaultMessage:
            "A `for` loop with a `break`/`continue` AND a stateful primitive (`plot`/`hline`/`alert`/`ta.*`/`draw.*`) in its body cannot be converted: chartlang forbids a stateful call inside a loop, and a `break`/`continue` body cannot be unrolled.",
        defaultSuggestion:
            "Lift the stateful call out of the loop, or drop the `break`/`continue` so the loop can unroll.",
    },
    "nested-ta-lowered": {
        code: "pine-converter/transform/nested-ta-lowered",
        severity: "info",
        defaultMessage:
            "A nested `ta.*` call in a scalar position (an operator operand, a ternary arm, or a `math.*` argument) was projected to its per-bar `.current` scalar so the surrounding arithmetic type-checks.",
        defaultSuggestion:
            "No action needed — the `.current` projection is the per-bar number Pine uses; the `ta.*` series keeps its own per-call-site history.",
    },
    "nested-ta-not-lowered": {
        code: "pine-converter/transform/nested-ta-not-lowered",
        severity: "warning",
        defaultMessage:
            "A `ta.*` call was left as a `Series` in a scalar position because its name is unmapped or rejected; the generated arithmetic may not type-check (a `Series<number>` where a `number` is required).",
        defaultSuggestion:
            "Map the `ta.*` name (or rewrite the expression by hand), then read its `.current` scalar before the surrounding arithmetic.",
    },
    "udf-typed-param-unsupported": {
        code: "pine-converter/parse/udf-typed-param-unsupported",
        severity: "warning",
        defaultMessage:
            "A user-defined function parameter has a type annotation; Pine v1 UDF params are treated as untyped, so the type was dropped and the bare name kept.",
        defaultSuggestion:
            "Remove the parameter type (`f(x) =>` instead of `f(float x) =>`); the converter infers types from usage.",
    },
    "udf-param-default-unsupported": {
        code: "pine-converter/parse/udf-param-default-unsupported",
        severity: "error",
        defaultMessage:
            "A user-defined function parameter has a default value; default-valued UDF params are not supported in v1, so the whole declaration was skipped.",
        defaultSuggestion:
            "Drop the parameter default and pass the value explicitly at every call site.",
    },
    "udf-arity-mismatch": {
        code: "pine-converter/semantic/udf-arity-mismatch",
        severity: "warning",
        defaultMessage:
            "A user-defined function is called with a different number of arguments than it declares.",
        defaultSuggestion: "Pass exactly one argument per declared parameter at the call site.",
    },
    "udf-recursive-rejected": {
        code: "pine-converter/semantic/udf-recursive-rejected",
        severity: "error",
        defaultMessage:
            "A user-defined function is recursive (it calls itself directly or through a cycle); chartlang cannot inline a recursive call graph.",
        defaultSuggestion:
            "Rewrite the helper iteratively (a literal-bounded `for` loop), or unfold the recursion by hand.",
    },
    "udf-emitted-function": {
        code: "pine-converter/transform/udf-emitted-function",
        severity: "info",
        defaultMessage:
            "A pure (state-free) user-defined function was emitted as a reusable chartlang arrow function at the top of `compute`, and every call site reuses it (no inlining needed — a pure helper is referentially transparent).",
        defaultSuggestion:
            "No action needed — a single shared function is semantically identical to Pine's per-call evaluation for a state-free helper.",
    },
    "udf-inlined": {
        code: "pine-converter/transform/udf-inlined",
        severity: "info",
        defaultMessage:
            "A stateful user-defined function call was inline-expanded at its call site so each `ta.*`/`state.*` it contains gets an independent slot (Pine instances stateful helper state per call site; a shared function would cross-contaminate it).",
        defaultSuggestion:
            "No action needed — inlining reproduces Pine's per-call-site state instancing for a stateful helper.",
    },
    "udf-arg-hoisted": {
        code: "pine-converter/transform/udf-arg-hoisted",
        severity: "info",
        defaultMessage:
            "A non-trivial argument to an inlined stateful user-defined function was hoisted to a temporary so it is evaluated exactly once (Pine evaluates each argument once; substituting it inline could re-evaluate it or duplicate its `ta.*` state).",
        defaultSuggestion:
            "No action needed — the temporary preserves Pine's evaluate-once argument semantics.",
    },
    "switch-expression-unsupported": {
        code: "pine-converter/parse/switch-expression-unsupported",
        severity: "error",
        defaultMessage:
            "A `switch` used as a value (e.g. `x = switch s ...`) is not yet supported.",
        defaultSuggestion:
            'Rewrite it as a chained ternary, or assign the result inside each `switch` arm body (`switch s\\n  "A" => x := ...`).',
    },
    "input-string-options-default-mismatch": {
        code: "pine-converter/transform/input-string-options-default-mismatch",
        severity: "warning",
        defaultMessage:
            "An `input.string(default, options=[…])` default is not one of the listed options; the `input.enum` is still emitted with the given default.",
        defaultSuggestion:
            "Set the default to one of the `options=` values so the dropdown opens on a valid selection.",
    },
    "input-string-options-not-literal": {
        code: "pine-converter/transform/input-string-options-not-literal",
        severity: "warning",
        defaultMessage:
            "An `input.string(options=[…])` list is not a uniform set of string literals (a non-literal or mixed-type element); it could not become an `input.enum`, so the options were dropped and a plain `input.string` was emitted.",
        defaultSuggestion:
            'List the dropdown choices as plain string literals (`options=["SMA", "EMA"]`).',
    },
    "color-transp-approximated": {
        code: "pine-converter/transform/color-transp-approximated",
        severity: "info",
        defaultMessage:
            "A `color.new(base, transp)` / `color.rgb(r, g, b, transp)` plot/hline/table colour was lowered with its Pine transparency converted to an alpha channel — a `#RRGGBBAA` hex for a literal base, or a `color.withAlpha(...)` call for a dynamic base.",
        defaultSuggestion: "No action needed; the alpha preserves the Pine transparency.",
    },
    "fill-handle-unresolved": {
        code: "pine-converter/transform/fill-handle-unresolved",
        severity: "error",
        defaultMessage:
            "A `fill(...)` handle argument does not resolve to a top-level `hline`/`plot` handle (or an inline `hline`/`plot` call), so the band edges cannot be built.",
        defaultSuggestion:
            "Pass two `hline(...)` / `plot(...)` handles (or inline calls) to `fill(a, b, color)`.",
    },
    "alert-frequency-not-mapped": {
        code: "pine-converter/transform/alert-frequency-not-mapped",
        severity: "info",
        defaultMessage:
            "An `alert(message, alert.freq_*)` frequency argument was dropped: chartlang's `AlertOpts` has no firing-frequency contract, so the cadence cannot be honored. The message and its enclosing `if` are preserved.",
        defaultSuggestion:
            "No action needed for a once-per-bar-close trigger inside an `if`; if you need explicit deduplication, gate the `alert(...)` behind your own `state.*` flag.",
    },
    "security-tuple-arity-mismatch": {
        code: "pine-converter/semantic/security-tuple-arity-mismatch",
        severity: "warning",
        defaultMessage:
            "A tuple `request.security([a, b] = …, [s1, s2])` binds a different number of names than its source list has elements; the overlapping positions were bound and the extras left unresolved.",
        defaultSuggestion: "Match the destructured name count to the `[…]` source-list length.",
    },
    "security-tuple-source-not-list": {
        code: "pine-converter/semantic/security-tuple-source-not-list",
        severity: "error",
        defaultMessage:
            "A tuple `request.security([a, b] = …, <source>)` must pass an array-literal source list (`[high, low]`); a non-list third argument cannot be split into per-element reads.",
        defaultSuggestion:
            "Pass the sources as an array literal, e.g. `[a, b] = request.security(sym, tf, [high, low])`.",
    },
    "plot-display-approximated": {
        code: "pine-converter/transform/plot-display-approximated",
        severity: "warning",
        defaultMessage:
            "A `plot(..., display=...)` target has no chartlang analogue beyond `display.all`/`display.none`; only the show/hide toggle maps to `{ visible }`, so the `display=` argument was dropped and the plot left visible.",
        defaultSuggestion:
            "Use `display = <cond> ? display.all : display.none` (or a bare `display.none`) for the visibility toggle; chartlang does not model `status_line`/`price_scale`/`pane`/`data_window` placement.",
    },
} as const satisfies Record<string, DiagnosticCodeEntry>;

/**
 * The converter's diagnostic registry keyed by the full, stable code STRING
 * (e.g. `"pine-converter/transform/cap-mismatch"`). Derived from
 * {@link DIAGNOSTIC_CODE_ENTRIES} so the two views never drift. Reporting and
 * formatting code (which only sees a {@link Diagnostic}'s `code` string, not a
 * short registry key) looks an entry up here.
 *
 * @since 0.1
 * @stable
 * @example
 *     DIAGNOSTIC_CODES.get("pine-converter/parse/unsupported-strategy")?.severity; // "error"
 */
export const DIAGNOSTIC_CODES: ReadonlyMap<string, DiagnosticCodeEntry> = new Map(
    Object.values(DIAGNOSTIC_CODE_ENTRIES).map((entry) => [entry.code, entry]),
);

/**
 * The set of diagnostic-code registry KEYS (short kebab-case slugs). Named
 * `ParserDiagnosticCode` for historical reasons — it now spans every stage,
 * not just the parser.
 *
 * @since 0.1
 * @stable
 * @example
 *     const key: ParserDiagnosticCode = "unsupported-strategy";
 *     void key;
 */
export type ParserDiagnosticCode = keyof typeof DIAGNOSTIC_CODE_ENTRIES;

/**
 * Build a {@link Diagnostic} from a registry key, a {@link SourceSpan}, and
 * an optional message override (used to inject the specific token text into
 * a generic `expected-token`/`unexpected-token` message). The severity,
 * stable code string, and default suggestion come from the registry.
 *
 * @since 0.1
 * @stable
 * @example
 *     const diag = makeDiagnostic("unsupported-strategy", {
 *         startLine: 2,
 *         startColumn: 1,
 *         endLine: 2,
 *         endColumn: 15,
 *     });
 *     diag.code; // "pine-converter/parse/unsupported-strategy"
 */
export function makeDiagnostic(
    key: ParserDiagnosticCode,
    span: SourceSpan,
    messageOverride?: string,
): Diagnostic {
    const entry: DiagnosticCodeEntry = DIAGNOSTIC_CODE_ENTRIES[key];
    const base = {
        code: entry.code,
        severity: entry.severity,
        message: messageOverride ?? entry.defaultMessage,
        span,
    };
    return entry.defaultSuggestion === undefined
        ? base
        : { ...base, suggestion: entry.defaultSuggestion };
}
