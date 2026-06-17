// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Diagnostic, DiagnosticSeverity, SourceSpan } from "../index.js";

/**
 * A single entry in the converter's diagnostic-code registry: the stable
 * `code`, its default `severity`, the advisory `defaultMessage`, and an
 * optional `defaultSuggestion` describing the manual rewrite.
 *
 * @since 0.1
 * @experimental
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
 * @experimental
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
            "Tune `__YLOC_PAD_FRAC` in the generated script if the default offset is too tight.",
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
            "A `linefill` between two bar-by-bar updated lines is a series fill; chartlang has no plot-fill primitive yet, so it is approximated as a single updated quad.",
        defaultSuggestion: "Revisit when chartlang ships a `plot(...)` series-fill primitive.",
    },
    "linefill-color-transp-approximated": {
        code: "pine-converter/transform/linefill-color-transp-approximated",
        severity: "info",
        defaultMessage:
            "`color.new(color, transp)` was folded to a `#RRGGBBAA` hex with the transparency converted to an alpha channel.",
        defaultSuggestion: "No action needed; the alpha hex preserves the Pine transparency.",
    },
    "linefill-rotatedrect-approximated": {
        code: "pine-converter/transform/linefill-rotatedrect-approximated",
        severity: "info",
        defaultMessage:
            "`linefill.new(lineA, lineB)` is approximated as a filled `draw.rotatedRectangle` quad over the two lines' endpoints; chartlang has no dedicated fill-between-lines primitive.",
        defaultSuggestion:
            "Accept the quad approximation, or revisit when a fill-between-series primitive ships.",
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
            "`fill(plot1, plot2, ...)` has no chartlang analogue (no plot-fill primitive in v1).",
        defaultSuggestion: "Draw the band as an explicit `draw.rectangle`/`draw.path` instead.",
    },
    "request-security-different-symbol": {
        code: "pine-converter/transform/request-security-different-symbol",
        severity: "warning",
        defaultMessage:
            "`request.security` on a different symbol than `syminfo.tickerid` is not supported; chartlang's v1 MTF is same-symbol only.",
        defaultSuggestion:
            "Request the same symbol at a different interval, or drop the cross-symbol read.",
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
    "codegen-output-invalid": {
        code: "pine-converter/codegen/codegen-output-invalid",
        severity: "error",
        defaultMessage:
            "The converted chartlang source failed to compile through `@invinite-org/chartlang-compiler`.",
        defaultSuggestion:
            "Open the emitted `.chart.ts`, address the compiler diagnostics, or file a converter bug with the source.",
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
 * @experimental
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
 * @experimental
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
 * @experimental
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
