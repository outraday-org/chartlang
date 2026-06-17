// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * The Pine Script v6 reserved keyword set. An identifier whose text is a
 * member is lexed as a `keyword` token; everything else (including
 * built-in references like `open`/`close`/`syminfo`) stays an
 * `identifier` and is resolved later in semantic analysis.
 *
 * Source: TradingView Pine Script v6 language reference —
 * https://www.tradingview.com/pine-script-docs/language/ (keywords).
 *
 * @since 0.1
 * @experimental
 * @example
 *     PINE_V6_KEYWORDS.has("if"); // true
 *     PINE_V6_KEYWORDS.has("close"); // false
 */
export const PINE_V6_KEYWORDS: ReadonlySet<string> = new Set([
    "and",
    "or",
    "not",
    "if",
    "else",
    "for",
    "to",
    "by",
    "in",
    "while",
    "switch",
    "case",
    "default",
    "var",
    "varip",
    "true",
    "false",
    "na",
    "break",
    "continue",
    "return",
    "import",
    "export",
    "type",
    "method",
    "this",
]);
