// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

import { type CompileDiagnostic, createDiagnostic } from "../diagnostics.js";
import { resolveCalleeName } from "../transformers/resolveCallee.js";
import { collectConstNumberEnv, resolveIndexUpperBound } from "./resolveIndexBound.js";

/**
 * The largest `capacity` a `state.array<T>(capacity)` allocation may request.
 * The collection is bounded-execution-safe only because its size is fixed at
 * compile time: a hard ceiling caps memory, caps the JSON snapshot size, and —
 * crucially — caps the per-tick two-ring `Float64Array` copy the runtime does
 * on every tick rollback. `100_000` is generous (the dominant rolling-window /
 * event-log cases are ≤ a few hundred) while still keeping the snapshot and
 * the per-tick copy bounded.
 *
 * @since 1.3
 * @stable
 * @example
 *     // state.array<number>(20)        → 20 <= MAX_STATE_ARRAY_CAPACITY  (OK)
 *     // state.array<number>(1_000_000) → exceeds the cap                 (error)
 *     const cap: number = MAX_STATE_ARRAY_CAPACITY;
 *     void cap;
 */
export const MAX_STATE_ARRAY_CAPACITY = 100_000;

/**
 * Walk the source file and flag every `state.array<T>(capacity)` allocation
 * whose `capacity` argument is not a compile-time-resolvable positive integer
 * within `MAX_STATE_ARRAY_CAPACITY`. This pins the bounded-execution +
 * bounded-snapshot invariant at the compiler boundary: a non-literal capacity
 * would make the backing ring's size — and therefore its snapshot size and
 * per-tick rollback cost — non-deterministic.
 *
 * Capacity resolution reuses `resolveIndexUpperBound` + `collectConstNumberEnv`
 * (the same machinery that sizes a series index), so a bare numeric literal,
 * a parenthesised / unary-`±` literal, and a `const` numeric-literal binding
 * (`const K = 20; state.array(K)`) are all accepted; a `let`, an input, or any
 * runtime expression resolves to `null` and is rejected.
 *
 * Two error codes:
 * - `state-array-capacity-not-literal` — the capacity is missing or does not
 *   resolve to a compile-time number.
 * - `state-array-capacity-exceeds-max` — the capacity resolves but is `<= 0`,
 *   non-integer, or `> MAX_STATE_ARRAY_CAPACITY`.
 *
 * The walk runs on the **original** AST (positions match the user's source,
 * and — running pre-injection — the capacity is `node.arguments[0]`, before
 * the slot-id literal is injected as the leading argument). The element-access
 * form `state["array"](cap)` is rejected upstream as
 * `stateful-call-element-access` and never matches `"state.array"` here, so it
 * is not double-reported. A `state.array(...)` inside a loop additionally
 * errors `stateful-call-inside-loop`; both passes are independent.
 *
 * @since 1.3
 * @example
 *     // const diagnostics = runStateArrayCapacity(
 *     //     sourceFile, checker, "demo.chart.ts",
 *     // );
 *     const fn: typeof runStateArrayCapacity = runStateArrayCapacity;
 *     void fn;
 */
export function runStateArrayCapacity(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    sourcePath: string,
): ReadonlyArray<CompileDiagnostic> {
    const diagnostics: CompileDiagnostic[] = [];

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && resolveCalleeName(node, checker) === "state.array") {
            const capacity = node.arguments[0];
            if (capacity === undefined) {
                diagnostics.push(
                    createDiagnostic({
                        severity: "error",
                        code: "state-array-capacity-not-literal",
                        message:
                            "`state.array` requires a numeric-literal capacity (a `const` numeric binding is accepted).",
                        file: sourcePath,
                        node,
                        sourceFile,
                    }),
                );
            } else {
                const constEnv = collectConstNumberEnv(capacity, sourceFile);
                const bound = resolveIndexUpperBound(capacity, node, { constEnv, checker });
                if (bound === null) {
                    diagnostics.push(
                        createDiagnostic({
                            severity: "error",
                            code: "state-array-capacity-not-literal",
                            message:
                                "`state.array` capacity must be a numeric literal (a `const` numeric binding is accepted), not a runtime value.",
                            file: sourcePath,
                            node: capacity,
                            sourceFile,
                        }),
                    );
                } else if (
                    bound <= 0 ||
                    !Number.isInteger(bound) ||
                    bound > MAX_STATE_ARRAY_CAPACITY
                ) {
                    diagnostics.push(
                        createDiagnostic({
                            severity: "error",
                            code: "state-array-capacity-exceeds-max",
                            message: `\`state.array\` capacity must be a positive integer in 1..${MAX_STATE_ARRAY_CAPACITY}; got ${bound}.`,
                            file: sourcePath,
                            node: capacity,
                            sourceFile,
                        }),
                    );
                }
            }
        }
        ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
    return Object.freeze(diagnostics.slice());
}
