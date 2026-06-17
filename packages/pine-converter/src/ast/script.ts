// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExpressionNode } from "./expressions.js";
import type { WithSpan } from "./spans.js";
import type { Statement } from "./statements.js";

/**
 * A single declaration-call argument. `name` is `null` for a positional
 * argument and the parameter name for a named argument (`title = "x"`).
 *
 * @since 0.1
 * @experimental
 * @example
 *     const arg: Argument = {
 *         name: "title",
 *         value: {
 *             kind: "literal-expression",
 *             literalKind: "string",
 *             value: "hi",
 *             span: { startLine: 1, startColumn: 11, endLine: 1, endColumn: 15 },
 *         },
 *         span: { startLine: 1, startColumn: 11, endLine: 1, endColumn: 15 },
 *     };
 *     void arg;
 */
export type Argument = WithSpan &
    Readonly<{
        name: string | null;
        value: ExpressionNode;
    }>;

/**
 * The `//@version=N` directive at the head of a script.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const v: VersionDirective = {
 *         kind: "version-directive",
 *         version: 6,
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 13 },
 *     };
 *     void v;
 */
export type VersionDirective = WithSpan &
    Readonly<{
        kind: "version-directive";
        version: number;
    }>;

/**
 * An `indicator(...)` declaration. `args` holds the positional-then-named
 * argument list; argument values are {@link UnknownExpression} placeholders
 * until Task 4.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const d: IndicatorDeclaration = {
 *         kind: "indicator-declaration",
 *         args: [],
 *         span: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 16 },
 *     };
 *     void d;
 */
export type IndicatorDeclaration = WithSpan &
    Readonly<{
        kind: "indicator-declaration";
        args: readonly Argument[];
    }>;

/**
 * A `strategy(...)` declaration. Rejected with an `unsupported-strategy`
 * diagnostic, but still parsed so the body can be walked.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const d: StrategyDeclaration = {
 *         kind: "strategy-declaration",
 *         args: [],
 *         span: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 15 },
 *     };
 *     void d;
 */
export type StrategyDeclaration = WithSpan &
    Readonly<{
        kind: "strategy-declaration";
        args: readonly Argument[];
    }>;

/**
 * A `library(...)` declaration. Rejected with an `unsupported-library`
 * diagnostic, but still parsed so the body can be walked.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const d: LibraryDeclaration = {
 *         kind: "library-declaration",
 *         args: [],
 *         span: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 14 },
 *     };
 *     void d;
 */
export type LibraryDeclaration = WithSpan &
    Readonly<{
        kind: "library-declaration";
        args: readonly Argument[];
    }>;

/**
 * An `import` declaration. The raw module path tokens are kept as text;
 * full resolution is out of scope for v1 and flagged downstream.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const d: ImportDeclaration = {
 *         kind: "import-declaration",
 *         text: "import user/lib/1",
 *         span: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 18 },
 *     };
 *     void d;
 */
export type ImportDeclaration = WithSpan &
    Readonly<{
        kind: "import-declaration";
        text: string;
    }>;

/**
 * The top-level declaration of a script.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const d: Declaration = {
 *         kind: "indicator-declaration",
 *         args: [],
 *         span: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 16 },
 *     };
 *     void d;
 */
export type Declaration =
    | IndicatorDeclaration
    | StrategyDeclaration
    | LibraryDeclaration
    | ImportDeclaration;

/**
 * The root Pine AST node: an optional version directive, an optional
 * top-level {@link Declaration}, and the body statements. `version` and
 * `declaration` are `null` when missing (the parser still returns a
 * `Script` and reports the omission as a diagnostic).
 *
 * @since 0.1
 * @experimental
 * @example
 *     const s: Script = {
 *         kind: "script",
 *         version: null,
 *         declaration: null,
 *         body: [],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *     };
 *     void s;
 */
export type Script = WithSpan &
    Readonly<{
        kind: "script";
        version: VersionDirective | null;
        declaration: Declaration | null;
        body: readonly Statement[];
    }>;
