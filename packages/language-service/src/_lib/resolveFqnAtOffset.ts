// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

/**
 * Resolve the chartlang primitive FQN under a source offset.
 *
 * @since 0.4
 * @experimental
 * @example
 *     const fqn = resolveFqnAtOffset("ta.ema(bar.close, 20)", 4);
 *     void fqn;
 */
export function resolveFqnAtOffset(source: string, offset: number): string | null {
    const sourceFile = ts.createSourceFile("script.chart.ts", source, ts.ScriptTarget.Latest, true);
    const token = findTokenAtOffset(sourceFile, offset);
    if (token === null || !ts.isIdentifier(token)) return null;
    const access = enclosingPropertyAccess(token);
    if (access !== null) return propertyAccessToFqn(access);
    return token.text;
}

/**
 * Find the smallest AST token containing an offset.
 *
 * @since 0.4
 * @experimental
 * @example
 *     const sf = ts.createSourceFile("x.ts", "ta.ema()", ts.ScriptTarget.Latest, true);
 *     const token = findTokenAtOffset(sf, 1);
 *     void token;
 */
export function findTokenAtOffset(sourceFile: ts.SourceFile, offset: number): ts.Node | null {
    let best: ts.Node | null = null;
    const visit = (node: ts.Node): void => {
        const start = node.getStart(sourceFile);
        const end = node.getEnd();
        if (offset < start || offset > end) return;
        best = node;
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return best;
}

function enclosingPropertyAccess(token: ts.Identifier): ts.PropertyAccessExpression | null {
    let current: ts.Node = token;
    let candidate: ts.PropertyAccessExpression | null = null;
    while (current.parent !== undefined) {
        const parent = current.parent;
        if (ts.isPropertyAccessExpression(parent)) {
            candidate = parent;
            current = parent;
            continue;
        }
        break;
    }
    return candidate;
}

function propertyAccessToFqn(access: ts.PropertyAccessExpression): string | null {
    const parts: string[] = [];
    let current: ts.Expression = access;
    while (ts.isPropertyAccessExpression(current)) {
        parts.unshift(current.name.text);
        current = current.expression;
    }
    if (!ts.isIdentifier(current)) return null;
    parts.unshift(current.text);
    return parts.join(".");
}
