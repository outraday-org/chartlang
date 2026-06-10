// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { StatefulPrimitiveEntry } from "@invinite-org/chartlang-core";
import ts from "typescript";

import { type CompileDiagnostic, createDiagnostic } from "../diagnostics.js";
import { resolveCalleeName } from "../transformers/resolveCallee.js";

/**
 * Walk the source file and flag every stateful primitive call that sits
 * inside any loop kind (`for`, `for-of`, `for-in`, `while`, `do-while`).
 * Mirrors Pine's identical restriction: a stateful call inside a loop would
 * receive one slot id per iteration, silently corrupting per-call state.
 * `slot: false` entries (e.g. `ta.nz`) are flagged too — they're stateless
 * but Pine still forbids them in loops, and the diagnostic message stays
 * the same.
 *
 * The walk runs on the **original** AST (positions match the user's source).
 * Loop ancestry detection uses `node.parent` directly — the source file is
 * created with `setParentNodes: true` so `.parent` is populated.
 *
 * @since 0.1
 * @example
 *     // const diagnostics = runStatefulCallInLoop(
 *     //     sourceFile, checker, "demo.chart.ts", STATEFUL_PRIMITIVES_BY_NAME,
 *     // );
 *     const fn: typeof runStatefulCallInLoop = runStatefulCallInLoop;
 *     void fn;
 */
export function runStatefulCallInLoop(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    sourcePath: string,
    statefulByName: ReadonlyMap<string, StatefulPrimitiveEntry>,
): ReadonlyArray<CompileDiagnostic> {
    const diagnostics: CompileDiagnostic[] = [];

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
            const calleeName = resolveCalleeName(node, checker);
            if (calleeName !== null && statefulByName.has(calleeName)) {
                if (insideLoop(node)) {
                    diagnostics.push(
                        createDiagnostic({
                            severity: "error",
                            code: "stateful-call-inside-loop",
                            message: `Stateful primitive \`${calleeName}\` cannot be called inside a loop.`,
                            file: sourcePath,
                            node,
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

function insideLoop(node: ts.Node): boolean {
    let current: ts.Node | undefined = node.parent;
    while (current) {
        if (
            ts.isForStatement(current) ||
            ts.isForOfStatement(current) ||
            ts.isForInStatement(current) ||
            ts.isWhileStatement(current) ||
            ts.isDoStatement(current)
        ) {
            return true;
        }
        current = current.parent;
    }
    return false;
}
