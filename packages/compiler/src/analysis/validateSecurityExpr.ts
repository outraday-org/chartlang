// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

import { type CompileDiagnostic, createDiagnostic } from "../diagnostics.js";
import { resolveCoreSymbolName } from "../transformers/resolveCallee.js";

/**
 * Validate that a `request.security({ interval }, (bar) => …)` expression
 * callback references only its `bar` parameter (and locals derived from it),
 * the ambient `ta` namespace, `inputs`, safe `Math.*` globals, and literal
 * constants. Any other free identifier is a captured outer binding — it would
 * smuggle the main-timeline clock into the higher-timeframe expression — and
 * is rejected with `request-security-expr-captures-local`.
 *
 * Function / arrow expressions nested deeper inside the callback are out of
 * the v1 subset and rejected too (keeps the expression unit flat), as is a
 * `this` reference. Parameter default initialisers are walked alongside the
 * body so a default that captures an outer binding is flagged too.
 *
 * @since 0.7
 * @stable
 * @example
 *     // Inside extractRequestAnalysis, once per expression callsite:
 *     //   validateSecurityExpr(callback, checker, diagnostics, sourcePath);
 *     const fn: typeof validateSecurityExpr = validateSecurityExpr;
 *     void fn;
 */
export function validateSecurityExpr(
    callback: ts.ArrowFunction | ts.FunctionExpression,
    checker: ts.TypeChecker,
    diagnostics: CompileDiagnostic[],
    sourcePath: string,
): void {
    const sourceFile = callback.getSourceFile();
    const bound = collectBoundNames(callback);

    const visit = (node: ts.Node): void => {
        // Nested functions/arrows are out of the flat v1 subset.
        if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
            diagnostics.push(
                createDiagnostic({
                    severity: "error",
                    code: "request-security-expr-captures-local",
                    message:
                        "A request.security expression callback may not contain a nested function. Keep the expression flat.",
                    file: sourcePath,
                    node,
                    sourceFile,
                }),
            );
            return;
        }
        // `this` is not a value the flat expression subset may read — in a
        // function-expression callback it would be `undefined` under the
        // module's strict mode and throw at runtime.
        if (node.kind === ts.SyntaxKind.ThisKeyword) {
            diagnostics.push(
                createDiagnostic({
                    severity: "error",
                    code: "request-security-expr-captures-local",
                    message: "A request.security expression callback may not use `this`.",
                    file: sourcePath,
                    node,
                    sourceFile,
                }),
            );
            return;
        }
        if (ts.isIdentifier(node) && isFreeReference(node)) {
            if (!isAllowedReference(node, bound, checker)) {
                diagnostics.push(
                    createDiagnostic({
                        severity: "error",
                        code: "request-security-expr-captures-local",
                        message: `A request.security expression callback may not capture the outer binding \`${node.text}\`. Inline it as a literal or read it from \`inputs\`.`,
                        file: sourcePath,
                        node,
                        sourceFile,
                    }),
                );
            }
        }
        ts.forEachChild(node, visit);
    };

    // A parameter default (`(bar = outer) => …`) is a value read of whatever it
    // initialises to, so it must be checked for captures alongside the body.
    for (const parameter of callback.parameters) {
        if (parameter.initializer !== undefined) visit(parameter.initializer);
    }
    visit(callback.body);
}

/**
 * Collect every name bound *inside* the callback: the parameter identifiers
 * plus any `const` / `let` / `var` declared in the body. A binding's
 * initialiser is still walked by the caller, so an initialiser that captures
 * an outer name is still flagged.
 */
function collectBoundNames(
    callback: ts.ArrowFunction | ts.FunctionExpression,
): ReadonlySet<string> {
    const names = new Set<string>();
    for (const parameter of callback.parameters) {
        addBindingNames(parameter.name, names);
    }
    const visit = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node)) {
            addBindingNames(node.name, names);
        }
        ts.forEachChild(node, visit);
    };
    visit(callback.body);
    return names;
}

function addBindingNames(name: ts.BindingName, into: Set<string>): void {
    if (ts.isIdentifier(name)) {
        into.add(name.text);
        return;
    }
    for (const element of name.elements) {
        if (ts.isBindingElement(element)) addBindingNames(element.name, into);
    }
}

/**
 * Whether an identifier is a *free reference* — an actual value read, not a
 * property name (`bar.close` → `close`), a property-assignment key, or a
 * binding/declaration name (handled by `collectBoundNames`).
 *
 * A shorthand property (`{ offset }`) is deliberately NOT excluded: the
 * identifier there is both the key and the value read, so `{ outerLength }`
 * inside an opts object must still be checked against the allowed subset.
 */
function isFreeReference(node: ts.Identifier): boolean {
    const parent = node.parent;
    if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
    if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
    if (ts.isBindingElement(parent) && parent.propertyName === node) return false;
    if (ts.isVariableDeclaration(parent) && parent.name === node) return false;
    return true;
}

/**
 * Pure value globals that carry no main-timeline data and are morally literals.
 * They cannot smuggle the outer clock in, so they are allowed alongside `Math`.
 * Genuinely hostile globals (`Date`, `fetch`, …) are rejected separately by the
 * file-level `forbiddenConstructs` pass, which also covers the inline callback.
 */
const SAFE_VALUE_GLOBALS: ReadonlySet<string> = new Set(["undefined", "NaN", "Infinity"]);

/**
 * Whether a free identifier is in the allowed subset: a name bound inside the
 * callback (`bar` + locals), a {@link SAFE_VALUE_GLOBALS} constant, the ambient
 * `ta` / `inputs` namespaces, or the `Math` global (individual hostile members
 * such as `Math.random` are rejected by the separate hostile-global pass, not
 * here).
 */
function isAllowedReference(
    node: ts.Identifier,
    bound: ReadonlySet<string>,
    checker: ts.TypeChecker,
): boolean {
    if (bound.has(node.text)) return true;
    if (node.text === "Math") return true;
    if (SAFE_VALUE_GLOBALS.has(node.text)) return true;
    const canonical = resolveCoreSymbolName(checker, node);
    return canonical === "ta" || canonical === "inputs";
}
