// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

import type { DepGraph } from "../analysis/extractDependencyGraph.js";
import type { CompileDiagnostic } from "../diagnostics.js";

/**
 * Result of `rewriteDependencyAccessors`. `transformed` is the new
 * source file where every consumer-side `<binding>.output("title")`
 * call has been replaced with the synthesised
 * `__chartlang_depOutput("slotId", "localId", "title")` call the
 * runtime's dep executor (Phase 7 / Task 4) consumes.
 *
 * @since 0.7
 * @stable
 * @example
 *     const r: RewriteDependencyAccessorsResult = {
 *         transformed: undefined as unknown as ts.SourceFile,
 *         diagnostics: [],
 *     };
 *     void r;
 */
export type RewriteDependencyAccessorsResult = Readonly<{
    readonly transformed: ts.SourceFile;
    readonly diagnostics: ReadonlyArray<CompileDiagnostic>;
}>;

const DEP_OUTPUT_HELPER = "__chartlang_depOutput";

/**
 * Rewrite every consumer-side `<binding>.output("title")` call into
 * `__chartlang_depOutput("slotId", "localId", "title")`. The receiver
 * traces back to a binding declared in the file's
 * {@link DepGraph}; the slot id follows the existing
 * `<sourcePath>:<line>:<col>#0` format (Phase 1 §5.5) read from the
 * **input** source file before any rewrite. Bindings that are not
 * part of the dep graph (zero consumes, unknown receivers) are
 * left untouched — they would already have raised diagnostics during
 * `extractDependencyGraph`.
 *
 * Runs **before** `injectCallsiteIds` so the synthesised
 * `__chartlang_depOutput` carries a slot id read from the original
 * source positions.
 *
 * @since 0.7
 * @stable
 * @example
 *     // Input:  fastTrend.output("line")
 *     // Output: __chartlang_depOutput("demo.chart.ts:6:14#0", "fastTrend", "line")
 *     const fn: typeof rewriteDependencyAccessors = rewriteDependencyAccessors;
 *     void fn;
 */
export function rewriteDependencyAccessors(
    sourceFile: ts.SourceFile,
    depGraph: DepGraph,
    sourcePath: string,
): RewriteDependencyAccessorsResult {
    const knownLocalIds = new Set<string>();
    for (const drawn of depGraph.drawn) knownLocalIds.add(drawn.bindingName);
    for (const dep of depGraph.privateDeps) knownLocalIds.add(dep.localId);

    const factory: ts.TransformerFactory<ts.SourceFile> = (context) => {
        const visit: ts.Visitor = (node) => {
            if (
                ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                node.expression.name.text === "output"
            ) {
                const arg = node.arguments[0];
                if (arg !== undefined && ts.isStringLiteral(arg)) {
                    const receiverRoot = resolveReceiverRoot(node.expression.expression);
                    if (receiverRoot !== null && knownLocalIds.has(receiverRoot.text)) {
                        const start = node.getStart(sourceFile);
                        const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
                        const slotId = `${sourcePath}:${line + 1}:${character + 1}#0`;
                        return ts.factory.createCallExpression(
                            ts.factory.createIdentifier(DEP_OUTPUT_HELPER),
                            undefined,
                            [
                                ts.factory.createStringLiteral(slotId),
                                ts.factory.createStringLiteral(receiverRoot.text),
                                ts.factory.createStringLiteral(arg.text),
                            ],
                        );
                    }
                }
            }
            return ts.visitEachChild(node, visit, context);
        };
        return (file) => ts.visitNode(file, visit, ts.isSourceFile) as ts.SourceFile;
    };

    const result = ts.transform(sourceFile, [factory]);
    const transformed = result.transformed[0];
    result.dispose();
    return Object.freeze({
        transformed,
        diagnostics: Object.freeze([] as ReadonlyArray<CompileDiagnostic>),
    });
}

function resolveReceiverRoot(receiver: ts.Expression): ts.Identifier | null {
    // extractDependencyGraph validates that every `.output(...)` call
    // reaching the rewriter has a bare identifier receiver (or a
    // withInputs-aliased binding name we already collapsed in the
    // graph). The defensive null return is exercised by the
    // "leaves unknown .output() receivers untouched" test case where
    // the receiver type isn't an Identifier (it's a PropertyAccess).
    if (ts.isIdentifier(receiver)) return receiver;
    return null;
}
