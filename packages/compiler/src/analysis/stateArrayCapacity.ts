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
 * Fully-qualified callee names whose first argument is a required
 * compile-time numeric-literal capacity. The bounded-collection primitives
 * (`state.array` FIFO ring, `state.map` keyed store) share one guard rather
 * than forking a parallel pass — both serialise only because their size is
 * fixed at compile time. Adding a future bounded collection = append its name
 * here.
 */
const CAPACITY_GUARDED_NAMES: ReadonlySet<string | null> = new Set<string | null>([
    "state.array",
    "state.map",
]);

/**
 * Validate one bounded-collection callsite's `capacity` argument and return the
 * diagnostic it earns, or `null` when the capacity is a resolvable positive
 * integer within `MAX_STATE_ARRAY_CAPACITY`. Pulled out of the AST walk so the
 * `visit` arrow stays flat (the three failure arms would otherwise nest five
 * blocks deep). `capacity` is `call.arguments[0]` because the pass runs
 * pre-injection (see `runStateArrayCapacity`).
 */
function checkBoundedCapacity(
    call: ts.CallExpression,
    name: string,
    sourceFile: ts.SourceFile,
    sourcePath: string,
    checker: ts.TypeChecker,
): CompileDiagnostic | null {
    const capacity = call.arguments[0];
    if (capacity === undefined) {
        return createDiagnostic({
            severity: "error",
            code: "state-array-capacity-not-literal",
            message: `\`${name}\` requires a numeric-literal capacity (a \`const\` numeric binding is accepted).`,
            file: sourcePath,
            node: call,
            sourceFile,
        });
    }
    const constEnv = collectConstNumberEnv(capacity, sourceFile);
    const bound = resolveIndexUpperBound(capacity, call, { constEnv, checker });
    if (bound === null) {
        return createDiagnostic({
            severity: "error",
            code: "state-array-capacity-not-literal",
            message: `\`${name}\` capacity must be a numeric literal (a \`const\` numeric binding is accepted), not a runtime value.`,
            file: sourcePath,
            node: capacity,
            sourceFile,
        });
    }
    if (bound <= 0 || !Number.isInteger(bound) || bound > MAX_STATE_ARRAY_CAPACITY) {
        return createDiagnostic({
            severity: "error",
            code: "state-array-capacity-exceeds-max",
            message: `\`${name}\` capacity must be a positive integer in 1..${MAX_STATE_ARRAY_CAPACITY}; got ${bound}.`,
            file: sourcePath,
            node: capacity,
            sourceFile,
        });
    }
    return null;
}

/**
 * Walk the source file and flag every bounded-collection allocation
 * (`state.array<T>(capacity)` / `state.map<K, V>(capacity)`) whose `capacity`
 * argument is not a compile-time-resolvable positive integer within
 * `MAX_STATE_ARRAY_CAPACITY`. This pins the bounded-execution +
 * bounded-snapshot invariant at the compiler boundary: a non-literal capacity
 * would make the backing store's size — and therefore its snapshot size and
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
 * form `state["array"](cap)` / `state["map"](cap)` is rejected upstream as
 * `stateful-call-element-access` and never matches a `CAPACITY_GUARDED_NAMES`
 * dotted name here, so it is not double-reported. A guarded call inside a loop
 * additionally errors `stateful-call-inside-loop`; both passes are independent.
 * The diagnostic message names the matched primitive; the codes are shared.
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
        if (ts.isCallExpression(node)) {
            const name = resolveCalleeName(node, checker);
            if (name !== null && CAPACITY_GUARDED_NAMES.has(name)) {
                const diagnostic = checkBoundedCapacity(
                    node,
                    name,
                    sourceFile,
                    sourcePath,
                    checker,
                );
                if (diagnostic !== null) {
                    diagnostics.push(diagnostic);
                }
            }
        }
        ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
    return Object.freeze(diagnostics.slice());
}
