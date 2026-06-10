// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { StatefulPrimitiveEntry } from "@invinite-org/chartlang-core";
import ts from "typescript";

import { type CompileDiagnostic, createDiagnostic } from "../diagnostics.js";
import { resolveCalleeName, resolveCoreSymbolForElementAccess } from "./resolveCallee.js";

/**
 * Output of `injectCallsiteIds` — the rewritten source file plus any
 * diagnostics produced during the rewrite. Only `callsite-id-conflict`
 * surfaces here; every other transformer-related check lives in the
 * `analysis/` modules.
 *
 * @since 0.1
 * @example
 *     // const { transformed, diagnostics } = injectCallsiteIds(src, checker, opts);
 *     const shape: { transformed: unknown; diagnostics: ReadonlyArray<unknown> } = {
 *         transformed: null,
 *         diagnostics: [],
 *     };
 *     void shape;
 */
export type InjectCallsiteIdsResult = Readonly<{
    transformed: ts.SourceFile;
    diagnostics: ReadonlyArray<CompileDiagnostic>;
}>;

/**
 * Inject a `__slot` string-literal first argument into every stateful
 * primitive call. Slot id format per PLAN.md §5.5:
 * `<sourcePath>:<line>:<col>#<callIndex>`. `callIndex` is hardcoded to `0`
 * for hand-written code (Phase 1 reserves non-zero for future macros).
 *
 * The transformer is a pure rewrite — input nodes are never mutated. Lines
 * and columns are 1-based and read from the **input** source file before
 * any rewrite happens. Duplicate ids at the same `(line, col)` (impossible
 * in hand-written TS but reachable by future macros) trigger a
 * `callsite-id-conflict` diagnostic; only the first call at the duplicated
 * position gets the slot.
 *
 * @since 0.1
 * @example
 *     // Input:  ta.ema(close, 20)
 *     // Output: ta.ema("demo.chart.ts:5:13#0", close, 20)
 *     const fn: typeof injectCallsiteIds = injectCallsiteIds;
 *     void fn;
 */
export function injectCallsiteIds(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    opts: {
        readonly sourcePath: string;
        readonly statefulByName: ReadonlyMap<string, StatefulPrimitiveEntry>;
        readonly slotsSeen?: Map<string, ts.CallExpression>;
    },
): InjectCallsiteIdsResult {
    const { sourcePath, statefulByName } = opts;
    const slotsSeen = opts.slotsSeen ?? new Map<string, ts.CallExpression>();
    const diagnostics: CompileDiagnostic[] = [];

    const factory: ts.TransformerFactory<ts.SourceFile> = (context) => {
        const visit: ts.Visitor = (node) => {
            if (ts.isCallExpression(node)) {
                // Element-access calls (`ta["ema"](...)`, `alert?.[chan](...)`)
                // bypass slot-id injection because the property name is not
                // statically known. Detecting these explicitly turns the
                // silent-state-corruption footgun into a compile-time error.
                if (ts.isElementAccessExpression(node.expression)) {
                    const coreName = resolveCoreSymbolForElementAccess(node.expression, checker);
                    if (coreName !== null) {
                        diagnostics.push(
                            createDiagnostic({
                                severity: "error",
                                code: "stateful-call-element-access",
                                message: `Element-access calls on the \`${coreName}\` namespace bypass callsite-id injection. Use the property-access form (\`${coreName}.<name>(...)\`).`,
                                file: sourcePath,
                                node,
                                sourceFile,
                            }),
                        );
                        return ts.visitEachChild(node, visit, context);
                    }
                }
                const calleeName = resolveCalleeName(node, checker);
                const entry = calleeName === null ? undefined : statefulByName.get(calleeName);
                if (entry?.slot) {
                    const start = node.getStart(sourceFile);
                    const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
                    const slotId = `${sourcePath}:${line + 1}:${character + 1}#0`;
                    const existing = slotsSeen.get(slotId);
                    if (existing !== undefined) {
                        diagnostics.push(
                            createDiagnostic({
                                severity: "error",
                                code: "callsite-id-conflict",
                                message: `Two stateful calls share the same slot id "${slotId}".`,
                                file: sourcePath,
                                node,
                                sourceFile,
                            }),
                        );
                        return ts.visitEachChild(node, visit, context);
                    }
                    slotsSeen.set(slotId, node);
                    const visitedArguments = node.arguments.map((argument) =>
                        ts.visitNode(argument, visit, ts.isExpression),
                    ) as ReadonlyArray<ts.Expression>;
                    const updatedArguments = ts.factory.createNodeArray<ts.Expression>([
                        ts.factory.createStringLiteral(slotId),
                        ...visitedArguments,
                    ]);
                    const visitedCallee = ts.visitNode(
                        node.expression,
                        visit,
                        ts.isExpression,
                    ) as ts.Expression;
                    return ts.factory.updateCallExpression(
                        node,
                        visitedCallee,
                        node.typeArguments,
                        updatedArguments,
                    );
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
        diagnostics: Object.freeze(diagnostics.slice()),
    });
}
