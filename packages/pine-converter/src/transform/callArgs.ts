// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallArgument, CallExpression } from "../ast/index.js";
import type { SourceSpan } from "../index.js";

/**
 * The dotted member name of a bare-rooted callee (`line.new`, `array.push`),
 * or `null` when the callee is not a bare `a.b[.c]` member chain (e.g. a
 * computed receiver or a plain identifier call). Shared by every transform
 * that dispatches on a Pine builtin's dotted name.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { dottedCallee } from "./callArgs.js";
 *     // dottedCallee of `line.new(...)` → "line.new"
 *     void dottedCallee;
 */
export function dottedCallee(call: CallExpression): string | null {
    const callee = call.callee;
    if (callee.kind === "member-access-expression" && callee.head === null) {
        return callee.chain.join(".");
    }
    return null;
}

/**
 * The positional (unnamed) arguments of a call, in source order — every
 * `CallArgument` whose `name` is `null`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { positionalArgs } from "./callArgs.js";
 *     // positionalArgs of `f(1, x = 2, 3)` → [1, 3]
 *     void positionalArgs;
 */
export function positionalArgs(args: readonly CallArgument[]): readonly CallArgument[] {
    return args.filter((arg) => arg.name === null);
}

/**
 * The first named argument whose key matches `name`, or `null` when absent.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { namedArg } from "./callArgs.js";
 *     // namedArg of `f(x = 2)`, "x" → the `x = 2` argument
 *     void namedArg;
 */
export function namedArg(args: readonly CallArgument[], name: string): CallArgument | null {
    return args.find((arg) => arg.name === name) ?? null;
}

/**
 * A stable string key for a {@link SourceSpan} (`"startLine:startColumn:endLine
 * :endColumn"`). Used to associate an AST node with side-table data across a
 * transform that may CLONE the node (e.g. `udfInline`'s `expandNode` rebuilds
 * every node with `{ ...node }`, so node-identity `Map` keys break — but the
 * 1-based span is preserved). Spans are unique per source location.
 *
 * @since 0.4
 * @stable
 * @example
 *     import { spanKey } from "./callArgs.js";
 *     spanKey({ startLine: 3, startColumn: 5, endLine: 3, endColumn: 9 }); // "3:5:3:9"
 */
export function spanKey(span: SourceSpan): string {
    return `${span.startLine}:${span.startColumn}:${span.endLine}:${span.endColumn}`;
}
