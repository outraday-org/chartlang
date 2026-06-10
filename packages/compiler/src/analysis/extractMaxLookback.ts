// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

import { type CompileDiagnostic, createDiagnostic } from "../diagnostics.js";
import { resolveCalleeName } from "../transformers/resolveCallee.js";

const OHLCV_FIELDS = new Set(["close", "open", "high", "low", "volume", "time"]);

/**
 * Maximum literal lookback `N` discovered across every series read in the
 * source plus the inferred `seriesCapacities` record. `dynamicFallback`
 * captures the §6.6 contract: any non-literal series index contributes
 * `5000` so the runtime can size its ring buffers safely.
 *
 * @since 0.1
 * @example
 *     const r: ExtractMaxLookbackResult = {
 *         maxLookback: 20,
 *         seriesCapacities: {},
 *         diagnostics: [],
 *     };
 *     void r;
 */
export type ExtractMaxLookbackResult = Readonly<{
    maxLookback: number;
    seriesCapacities: Readonly<Record<string, number>>;
    diagnostics: ReadonlyArray<CompileDiagnostic>;
}>;

/**
 * Walk the source file's `ElementAccessExpression` nodes and infer
 * `maxLookback` plus any `dynamicFallback` capacity from non-literal index
 * reads on Phase-1 series shapes: `bar.<ohlcv>[N]`, `ta.<name>(...)[N]`,
 * and identifier-bound series variables (`const e = ta.ema(...); e[N];`).
 *
 * @since 0.1
 * @example
 *     // const { maxLookback, seriesCapacities, diagnostics } =
 *     //     extractMaxLookback(sourceFile, checker, "demo.chart.ts");
 *     const fn: typeof extractMaxLookback = extractMaxLookback;
 *     void fn;
 */
export function extractMaxLookback(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    sourcePath: string,
): ExtractMaxLookbackResult {
    let maxLookback = 0;
    const seriesCapacities: Record<string, number> = {};
    const diagnostics: CompileDiagnostic[] = [];

    const seriesVarNames = collectSeriesVarNames(sourceFile, checker);

    const visit = (node: ts.Node): void => {
        if (ts.isElementAccessExpression(node)) {
            if (isSeriesShapedAccess(node, checker, seriesVarNames)) {
                const argument = node.argumentExpression;
                if (ts.isNumericLiteral(argument)) {
                    const n = Number(argument.text);
                    if (Number.isFinite(n) && n > maxLookback) maxLookback = n;
                } else {
                    diagnostics.push(
                        createDiagnostic({
                            severity: "warning",
                            code: "dynamic-series-index",
                            message:
                                "Non-literal series index — runtime will use the 5000-slot dynamic fallback buffer.",
                            file: sourcePath,
                            node: argument,
                            sourceFile,
                        }),
                    );
                    seriesCapacities.dynamicFallback = 5000;
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);

    return Object.freeze({
        maxLookback,
        seriesCapacities: Object.freeze({ ...seriesCapacities }),
        diagnostics: Object.freeze(diagnostics.slice()),
    });
}

function collectSeriesVarNames(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
): ReadonlySet<string> {
    const names = new Set<string>();
    const visit = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
            const initializer = node.initializer;
            if (initializer && ts.isCallExpression(initializer)) {
                const calleeName = resolveCalleeName(initializer, checker);
                if (calleeName?.startsWith("ta.")) {
                    names.add(node.name.text);
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
    return names;
}

function isSeriesShapedAccess(
    node: ts.ElementAccessExpression,
    checker: ts.TypeChecker,
    seriesVarNames: ReadonlySet<string>,
): boolean {
    const expression = node.expression;
    if (ts.isPropertyAccessExpression(expression)) {
        if (OHLCV_FIELDS.has(expression.name.text)) return true;
    }
    if (ts.isCallExpression(expression)) {
        const calleeName = resolveCalleeName(expression, checker);
        if (calleeName?.startsWith("ta.")) return true;
    }
    if (ts.isIdentifier(expression)) {
        if (seriesVarNames.has(expression.text)) return true;
    }
    return false;
}
