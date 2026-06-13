// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

/**
 * Return `true` when an offset lands inside the string-literal argument
 * of a `<binding>.output("...")` call. The binding name itself is not
 * validated here — the resolver inspects bindings when collecting
 * completions or hovers.
 *
 * @since 0.7
 * @stable
 * @example
 *     const inside = isInsideOutputStringLiteral('baseTrend.output("line")', 19);
 *     void inside;
 */
export function isInsideOutputStringLiteral(source: string, offset: number): boolean {
    const sourceFile = ts.createSourceFile("script.chart.ts", source, ts.ScriptTarget.Latest, true);
    let matched = false;

    const visit = (node: ts.Node): void => {
        if (matched) return;
        if (
            ts.isStringLiteral(node) &&
            offset > node.getStart(sourceFile) &&
            offset < node.getEnd()
        ) {
            matched = isOutputCallArgument(node);
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return matched;
}

function isOutputCallArgument(node: ts.StringLiteral): boolean {
    const parent = node.parent;
    if (!ts.isCallExpression(parent)) return false;
    if (parent.arguments[0] !== node) return false;
    const callee = parent.expression;
    if (!ts.isPropertyAccessExpression(callee)) return false;
    return callee.name.text === "output";
}
