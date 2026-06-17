// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallArgument, CallExpression } from "../ast/index.js";

/**
 * The dotted member name of a bare-rooted callee (`line.new`, `array.push`),
 * or `null` when the callee is not a bare `a.b[.c]` member chain (e.g. a
 * computed receiver or a plain identifier call). Shared by every transform
 * that dispatches on a Pine builtin's dotted name.
 *
 * @since 0.1
 * @experimental
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
 * @experimental
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
 * @experimental
 * @example
 *     import { namedArg } from "./callArgs.js";
 *     // namedArg of `f(x = 2)`, "x" → the `x = 2` argument
 *     void namedArg;
 */
export function namedArg(args: readonly CallArgument[], name: string): CallArgument | null {
    return args.find((arg) => arg.name === name) ?? null;
}
