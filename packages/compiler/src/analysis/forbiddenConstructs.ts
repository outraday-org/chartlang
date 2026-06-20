// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

import { type CompileDiagnostic, createDiagnostic } from "../diagnostics.js";
import { parseBoundedForLoop } from "./loopBounds.js";

const HOSTILE_GLOBAL_NAMES = new Set([
    "fetch",
    "setTimeout",
    "setInterval",
    "queueMicrotask",
    "Promise",
    "requestAnimationFrame",
    "Date",
    "eval",
    "require",
    // Phase 7 — the indicator-composition rewriter synthesises calls to
    // this helper; user scripts must not name-collide with the slot.
    "__chartlang_depOutput",
]);

/**
 * Walk the source file and emit a diagnostic for every forbidden construct:
 *
 * - `while` / `do-while` / `for-of` / `for-in` / unbounded `for` →
 *   `unbounded-loop`.
 * - Self-recursive function declaration → `recursion-not-allowed`.
 * - References to hostile globals (`Math.random`, `Date.*`, `fetch`,
 *   `setTimeout`, `setInterval`, `queueMicrotask`, `Promise`,
 *   `requestAnimationFrame`), plus `require(...)`, dynamic `import(...)`,
 *   `eval(...)`, `new Function(...)` → `hostile-global`.
 *
 * @since 0.1
 * @example
 *     // const diagnostics = runForbiddenConstructs(sourceFile, "demo.chart.ts");
 *     const fn: typeof runForbiddenConstructs = runForbiddenConstructs;
 *     void fn;
 */
export function runForbiddenConstructs(
    sourceFile: ts.SourceFile,
    sourcePath: string,
): ReadonlyArray<CompileDiagnostic> {
    const diagnostics: CompileDiagnostic[] = [];

    function emit(
        node: ts.Node,
        code: "unbounded-loop" | "recursion-not-allowed" | "hostile-global",
        message: string,
    ): void {
        diagnostics.push(
            createDiagnostic({
                severity: "error",
                code,
                message,
                file: sourcePath,
                node,
                sourceFile,
            }),
        );
    }

    function isInsideAncestor(node: ts.Node, predicate: (parent: ts.Node) => boolean): boolean {
        let current: ts.Node | undefined = node.parent;
        while (current) {
            if (predicate(current)) return true;
            current = current.parent;
        }
        return false;
    }

    function isDeclarationName(parent: ts.Node, node: ts.Identifier): boolean {
        const named = parent as { readonly name?: ts.Node };
        if (named.name !== node) return false;
        return (
            ts.isFunctionDeclaration(parent) ||
            ts.isFunctionExpression(parent) ||
            ts.isClassDeclaration(parent) ||
            ts.isClassExpression(parent) ||
            ts.isVariableDeclaration(parent) ||
            ts.isParameter(parent) ||
            ts.isInterfaceDeclaration(parent) ||
            ts.isTypeAliasDeclaration(parent) ||
            ts.isEnumDeclaration(parent) ||
            ts.isModuleDeclaration(parent)
        );
    }

    function enclosingFunctionName(node: ts.Node): string | null {
        let current: ts.Node | undefined = node.parent;
        while (current) {
            if (ts.isFunctionDeclaration(current) && current.name) {
                return current.name.text;
            }
            if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
                const initializer = current.initializer;
                if (
                    initializer &&
                    (ts.isFunctionExpression(initializer) || ts.isArrowFunction(initializer))
                ) {
                    return current.name.text;
                }
            }
            current = current.parent;
        }
        return null;
    }

    const visit = (node: ts.Node): void => {
        if (ts.isWhileStatement(node)) {
            emit(node, "unbounded-loop", "`while` loops are not allowed.");
        } else if (ts.isDoStatement(node)) {
            emit(node, "unbounded-loop", "`do…while` loops are not allowed.");
        } else if (ts.isForOfStatement(node)) {
            emit(node, "unbounded-loop", "`for…of` loops are not allowed in Phase 1.");
        } else if (ts.isForInStatement(node)) {
            emit(node, "unbounded-loop", "`for…in` loops are not allowed.");
        } else if (ts.isForStatement(node)) {
            if (parseBoundedForLoop(node) === null) {
                emit(
                    node,
                    "unbounded-loop",
                    "`for` loops must use literal numeric bounds: for (let i = <num>; i </<= <num>; i++).",
                );
            }
        } else if (ts.isCallExpression(node)) {
            const expression = node.expression;
            if (ts.isIdentifier(expression)) {
                if (expression.text === "eval") {
                    emit(node, "hostile-global", "`eval` is not allowed.");
                } else if (expression.text === "require") {
                    emit(node, "hostile-global", "`require` is not allowed.");
                }
            } else if (expression.kind === ts.SyntaxKind.ImportKeyword) {
                emit(node, "hostile-global", "Dynamic `import()` is not allowed.");
            }
            const functionName = enclosingFunctionName(node);
            if (
                functionName !== null &&
                ts.isIdentifier(expression) &&
                expression.text === functionName
            ) {
                emit(
                    node,
                    "recursion-not-allowed",
                    `Self-recursive call to \`${functionName}\` is not allowed.`,
                );
            }
        } else if (ts.isNewExpression(node)) {
            const expression = node.expression;
            if (ts.isIdentifier(expression) && expression.text === "Function") {
                emit(node, "hostile-global", "`new Function(...)` is not allowed.");
            }
        } else if (ts.isPropertyAccessExpression(node)) {
            const objectName = node.expression;
            if (ts.isIdentifier(objectName) && objectName.text === "Math") {
                if (node.name.text === "random") {
                    emit(node, "hostile-global", "`Math.random` is not allowed.");
                }
            } else if (ts.isIdentifier(objectName) && objectName.text === "Date") {
                emit(node, "hostile-global", "`Date.*` is not allowed.");
            }
        } else if (ts.isIdentifier(node)) {
            if (!HOSTILE_GLOBAL_NAMES.has(node.text)) {
                ts.forEachChild(node, visit);
                return;
            }
            const parent = node.parent;
            if (parent && isDeclarationName(parent, node)) {
                ts.forEachChild(node, visit);
                return;
            }
            if (
                parent &&
                (ts.isPropertyAccessExpression(parent) ||
                    ts.isPropertyAssignment(parent) ||
                    ts.isPropertySignature(parent) ||
                    ts.isBindingElement(parent) ||
                    ts.isImportSpecifier(parent) ||
                    ts.isExportSpecifier(parent))
            ) {
                ts.forEachChild(node, visit);
                return;
            }
            const isInsideTypeContext = isInsideAncestor(
                node,
                (ancestor) => ts.isTypeNode(ancestor) || ts.isTypeReferenceNode(ancestor),
            );
            if (isInsideTypeContext) {
                ts.forEachChild(node, visit);
                return;
            }
            emit(node, "hostile-global", `\`${node.text}\` is not allowed.`);
        }
        ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);

    return Object.freeze(diagnostics.slice());
}
