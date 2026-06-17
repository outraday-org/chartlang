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
 * Single-source registry of the parser- and semantic-stage diagnostic
 * codes. Every code is namespaced by stage (`pine-converter/parse/...`,
 * `pine-converter/semantic/...`) so it never collides with a lexer code
 * (`pine-converter/lex/...`). Add a code here, never inline a literal at the
 * call site.
 *
 * @since 0.1
 * @experimental
 * @example
 *     DIAGNOSTIC_CODES["unsupported-strategy"].severity; // "error"
 */
export const DIAGNOSTIC_CODES = {
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
} as const satisfies Record<string, DiagnosticCodeEntry>;

/**
 * The set of parser-stage diagnostic-code keys.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const key: ParserDiagnosticCode = "unsupported-strategy";
 *     void key;
 */
export type ParserDiagnosticCode = keyof typeof DIAGNOSTIC_CODES;

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
    const entry: DiagnosticCodeEntry = DIAGNOSTIC_CODES[key];
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
